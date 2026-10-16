#!/usr/bin/env node
/**
 * ONE command that starts everything:   npm install && npm start
 *
 *   npm start        → builds the web app once (if needed), then runs
 *                      the API (:4000) + the web app (:3000, proxies /api/*)
 *   npm run dev      → same, with hot reload (next dev)
 *
 * Plain Node, no shell — works the same on Windows, macOS and Linux.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");
const webDir = path.join(root, "apps/web");
const TSX = path.join(root, "node_modules/tsx/dist/cli.mjs");
const NEXT = path.join(root, "node_modules/next/dist/bin/next");
const WEB_PORT = process.env.PORT ?? "3000";
const API_PORT = process.env.LAYERFLOW_API_PORT ?? "4000";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Layerflow needs Node 22.13+ (for the built-in node:sqlite and --permission). You have ${process.versions.node}.`);
  process.exit(1);
}
if (!existsSync(TSX) || !existsSync(NEXT)) {
  console.error("Dependencies are missing — run `npm install` first.");
  process.exit(1);
}

const color = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);
const children = [];

function run(name, c, args, cwd, env = {}) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  const tag = color(c, `[${name}]`);
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const l of lines) if (l.trim()) out.write(`${tag} ${l}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`${tag} exited (${code})`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try {
      // Windows: kill the whole tree (the API's sandbox runners, Next's workers)
      if (process.platform === "win32" && c.pid) spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], { stdio: "ignore" });
      else c.kill("SIGTERM");
    } catch {
      /* gone */
    }
  }
  setTimeout(() => process.exit(code), 400);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

/** Newest modification time under the web app's sources — a build older than this is stale. */
function newestSource() {
  let newest = 0;
  const visit = (p) => {
    const s = statSync(p);
    if (s.isDirectory()) for (const f of readdirSync(p)) visit(path.join(p, f));
    else newest = Math.max(newest, s.mtimeMs);
  };
  for (const p of ["app", "components", "lib", "public", "next.config.ts", "package.json"]) {
    const full = path.join(webDir, p);
    if (existsSync(full)) visit(full);
  }
  return newest;
}

const buildId = path.join(webDir, ".next/BUILD_ID");
const stale = existsSync(buildId) && statSync(buildId).mtimeMs < newestSource();
if (!dev && (!existsSync(buildId) || stale)) {
  console.log(color("36", "[build]") + (stale ? " web sources changed — rebuilding the web app (~1 min)…" : " first run — building the web app (one-time, ~1 min)…"));
  const b = spawnSync(process.execPath, [NEXT, "build"], { cwd: webDir, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  if (b.status !== 0) {
    console.error("Web build failed — see the output above.");
    process.exit(b.status ?? 1);
  }
}

run("api", "33", [TSX, path.join(root, "apps/api/src/server.ts")], root, { LAYERFLOW_API_PORT: API_PORT, LAYERFLOW_PARENT_PID: String(process.pid) });
const started = Date.now();
const wait = async (url) => {
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() - started > 240_000) throw new Error(`timed out waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 700));
  }
};

// The web app starts once the API answers (first boot seeds the demo learners first).
await wait(`http://127.0.0.1:${API_PORT}/api/health`);
run("web", "36", [NEXT, dev ? "dev" : "start", "-p", WEB_PORT], webDir, { LAYERFLOW_API_URL: `http://127.0.0.1:${API_PORT}`, NEXT_TELEMETRY_DISABLED: "1" });

// Banner once the API answers through the web proxy.
const poll = setInterval(async () => {
  try {
    const r = await fetch(`http://127.0.0.1:${WEB_PORT}/api/health`);
    if (r.ok) {
      clearInterval(poll);
      const line = "─".repeat(58);
      console.log(`\n${color("32", line)}\n  Layerflow is running   (${((Date.now() - started) / 1000).toFixed(0)} s)\n`);
      console.log(`  Learners  →  http://localhost:${WEB_PORT}`);
      console.log(`  Judges    →  http://localhost:${WEB_PORT}/judges`);
      console.log(`  API       →  http://localhost:${WEB_PORT}/api/health   (also :${API_PORT} directly)`);
      console.log(`  Public URL:  npm run url   (ngrok http ${WEB_PORT})`);
      console.log(`${color("32", line)}\n`);
    }
  } catch {
    /* not up yet */
  }
  if (Date.now() - started > 240_000) clearInterval(poll);
}, 1500);
