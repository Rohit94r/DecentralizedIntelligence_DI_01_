/**
 * Builds a RepoSnapshot for Repo Analyse.
 *
 *   GitHub — 3 REST calls (repo, recursive tree, languages) + raw file reads.
 *            Works without a token (60 REST calls / hour); GITHUB_TOKEN raises
 *            the limit and allows private repos the token can see.
 *   local  — `git ls-files` of THIS checkout, so the demo works offline and
 *            only committed files are judged (exactly what GitHub would show).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickFilesToRead, type RepoFile, type RepoSnapshot } from "@layerflow/core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const MAX_TOTAL_BYTES = 3_000_000;

export class RepoError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

const cache = new Map<string, { at: number; snap: RepoSnapshot }>();

function gh(url: string) {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "layerflow-repo-analyse", "x-github-api-version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
}

async function ghJson<T>(url: string): Promise<T> {
  const r = await gh(url).catch(() => null);
  if (!r) throw new RepoError("Couldn't reach GitHub — check your internet connection, or analyse this project offline instead.", 502);
  if (r.status === 404) throw new RepoError("That repository wasn't found. Check the link — it must be public (or add a GITHUB_TOKEN that can see it).", 404);
  if (r.status === 403 || r.status === 429) {
    const reset = Number(r.headers.get("x-ratelimit-reset") ?? 0);
    const mins = reset ? Math.max(1, Math.round((reset * 1000 - Date.now()) / 60_000)) : 60;
    throw new RepoError(`GitHub's free limit (60 requests an hour) is used up — try again in about ${mins} min, add GITHUB_TOKEN to .env, or analyse this project offline.`, 429);
  }
  if (!r.ok) throw new RepoError(`GitHub answered ${r.status}. Try again in a moment.`, 502);
  return (await r.json()) as T;
}

async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export async function fetchGithub(owner: string, name: string): Promise<RepoSnapshot> {
  const key = `${owner}/${name}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.snap;

  const repo = await ghJson<{ name: string; full_name: string; owner: { login: string }; description: string | null; stargazers_count: number; default_branch: string; html_url: string; size: number }>(
    `https://api.github.com/repos/${owner}/${name}`,
  );
  const branch = repo.default_branch;
  const [tree, languages] = await Promise.all([
    ghJson<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(`https://api.github.com/repos/${repo.full_name}/git/trees/${encodeURIComponent(branch)}?recursive=1`),
    ghJson<Record<string, number>>(`https://api.github.com/repos/${repo.full_name}/languages`).catch(() => ({})),
  ]);
  const files: RepoFile[] = tree.tree.filter((t) => t.type === "blob").map((t) => ({ path: t.path, size: t.size ?? 0 }));
  if (!files.length) throw new RepoError("That repository is empty — push some code first.", 422);

  const wanted = pickFilesToRead(files);
  let budget = MAX_TOTAL_BYTES;
  const contents: Record<string, string> = {};
  await mapLimit(wanted, 8, async (p) => {
    const size = files.find((f) => f.path === p)?.size ?? 0;
    if (size > budget) return;
    budget -= size;
    const url = `https://raw.githubusercontent.com/${repo.full_name}/${encodeURIComponent(branch)}/${p.split("/").map(encodeURIComponent).join("/")}`;
    const r = await fetch(url, { headers: process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}, signal: AbortSignal.timeout(12_000) }).catch(() => null);
    if (r?.ok) {
      const text = await r.text();
      if (!text.includes("\u0000")) contents[p] = text;
    }
  });

  const snap: RepoSnapshot = {
    source: "github",
    owner: repo.owner.login,
    name: repo.name,
    url: repo.html_url,
    description: repo.description,
    stars: repo.stargazers_count,
    default_branch: branch,
    languages,
    files,
    contents,
    truncated: tree.truncated,
  };
  cache.set(key, { at: Date.now(), snap });
  if (cache.size > 30) cache.delete(cache.keys().next().value!);
  return snap;
}

/** This checkout — offline, committed files only. */
export function localSnapshot(): RepoSnapshot {
  let paths: string[];
  try {
    paths = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })
      .split("\u0000")
      .filter(Boolean);
  } catch {
    throw new RepoError("Offline mode needs git to list this project's files.", 500);
  }
  const files: RepoFile[] = [];
  for (const p of paths) {
    try {
      files.push({ path: p, size: statSync(path.join(ROOT, p)).size });
    } catch {
      /* deleted but not committed */
    }
  }
  const contents: Record<string, string> = {};
  let budget = MAX_TOTAL_BYTES;
  for (const p of pickFilesToRead(files)) {
    const size = files.find((f) => f.path === p)?.size ?? 0;
    if (size > budget) continue;
    budget -= size;
    try {
      const text = readFileSync(path.join(ROOT, p), "utf8");
      if (!text.includes("\u0000")) contents[p] = text;
    } catch {
      /* unreadable */
    }
  }
  const pkg = (() => {
    try {
      return JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { name?: string; description?: string };
    } catch {
      return {};
    }
  })();
  return {
    source: "local",
    name: pkg.name ?? path.basename(ROOT),
    description: pkg.description ?? "This Layerflow checkout, analysed offline.",
    files,
    contents,
  };
}
