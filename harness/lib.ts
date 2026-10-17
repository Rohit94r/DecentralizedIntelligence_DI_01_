/**
 * Shared harness plumbing. By default each run boots the REAL product in
 * process (real Fastify app, real Pyodide runners, a throw-away SQLite file)
 * and talks to it over Fastify's HTTP injection — the same router, schemas and
 * serializer the judges hit. Pass `--url http://host:3000` to run the very
 * same checks against a live server instead.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../apps/api/src/app.ts";
import { createRuntime, type Runtime } from "../apps/api/src/context.ts";

export interface Api {
  get(url: string): Promise<{ status: number; body: any; raw: string }>;
  post(url: string, body: unknown): Promise<{ status: number; body: any; raw: string }>;
  /** POST an exact byte string with extra headers (signed webhooks). */
  postRaw(url: string, raw: string, headers: Record<string, string>): Promise<{ status: number; body: any; raw: string }>;
  rt: Runtime | null;
  close(): Promise<void>;
  mode: string;
}

export const CANARY = `layerflow-canary-${Math.random().toString(36).slice(2, 10)}`;

function urlArg(): string | null {
  const i = process.argv.indexOf("--url");
  return i > 0 ? process.argv[i + 1] : (process.env.LAYERFLOW_URL ?? null);
}

let shared: Api | null = null;

export async function connect(): Promise<Api> {
  if (shared) return shared;
  process.env.LAYERFLOW_CANARY_SECRET = CANARY; // the API process has a secret; the sandbox must never see it
  process.env.LAYERFLOW_LIMITS ??= "off"; // suites measure behaviour, not the Free plan; T8 turns limits on to test them
  process.removeAllListeners("warning");
  const live = urlArg();
  if (live) {
    const base = live.replace(/\/$/, "");
    const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
      const res = await fetch(base + url, {
        method,
        headers: body !== undefined ? { "content-type": "application/json", ...headers } : headers,
        body: typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
      });
      const raw = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* not JSON */
      }
      return { status: res.status, body: parsed, raw };
    };
    shared = { get: (u) => call("GET", u), post: (u, b) => call("POST", u, b), postRaw: (u, raw, h) => call("POST", u, raw, h), rt: null, close: async () => {}, mode: `live ${base}` };
    return shared;
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), "layerflow-harness-"));
  const rt = createRuntime({ dbFile: path.join(dir, "harness.db"), llm: false, warm: 4 });
  const app = await buildApp({ ...rt, pool: rt.pool, logSubmissions: false });
  const call = async (method: "GET" | "POST", url: string, body?: unknown, headers?: Record<string, string>) => {
    const res = await app.inject({ method, url, payload: body as never, headers: headers ? { "content-type": "application/json", ...headers } : undefined });
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      /* not JSON */
    }
    return { status: res.statusCode, body: parsed, raw: res.body };
  };
  shared = {
    get: (u) => call("GET", u),
    post: (u, b) => call("POST", u, b),
    postRaw: (u, raw, h) => call("POST", u, raw, h),
    rt,
    mode: "in-process (real Fastify + real Pyodide runners)",
    close: async () => {
      await app.close();
      rt.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* windows may hold the WAL briefly */
      }
    },
  };
  return shared;
}

export interface Check {
  name: string;
  ok: boolean;
  info?: string;
}

export interface SuiteResult {
  suite: string;
  points: string;
  checks: Check[];
  summary: string;
  ms: number;
}

export function check(list: Check[], name: string, ok: boolean, info?: string): boolean {
  list.push({ name, ok, info });
  return ok;
}

export function printSuite(r: SuiteResult): void {
  const pass = r.checks.filter((c) => c.ok).length;
  console.log(`\n━━ ${r.suite} (${r.points}) — ${pass}/${r.checks.length} checks — ${r.summary} [${(r.ms / 1000).toFixed(1)} s]`);
  for (const c of r.checks) if (!c.ok || process.argv.includes("--verbose")) console.log(`   ${c.ok ? "✓" : "✗"} ${c.name}${c.info ? "  — " + c.info : ""}`);
}

export const isMain = (meta: string) => process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(meta).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
