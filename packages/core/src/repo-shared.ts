/**
 * Repo Analyse — shared pieces: the report's types, path helpers, stack /
 * kind detection, the layer map and the secret scanner. Imports nothing from
 * the other repo-* modules, so there are no import cycles.
 */

export interface RepoFile {
  path: string;
  size: number;
}

export interface RepoSnapshot {
  source: "github" | "local";
  owner?: string;
  name: string;
  url?: string;
  description?: string | null;
  stars?: number;
  default_branch?: string;
  languages?: Record<string, number>;
  files: RepoFile[];
  /** text of the files we sampled (key config + the most central source files) */
  contents: Record<string, string>;
  truncated?: boolean;
}

export type Severity = "high" | "medium" | "low";
export type Area = "security" | "structure" | "testing" | "quality" | "docs" | "dependencies" | "devops" | "scalability";

export interface RepoFinding {
  id: string;
  severity: Severity;
  area: Area;
  title: string;
  /** why it matters — plain words */
  why: string;
  /** what to do — plain words */
  fix: string;
  learn?: string;
  files?: string[];
}

export interface RepoLayer {
  id: "ui" | "api" | "logic" | "data" | "config" | "tests" | "infra" | "docs";
  label: string;
  simple: string;
  present: boolean;
  paths: string[];
  files: number;
}

/** The big pieces a beginner thinks in: "where's the frontend? the backend? the database?" */
export type PartId = "frontend" | "backend" | "database" | "mobile" | "ml" | "devops" | "tests" | "tooling";

export interface RepoPart {
  id: PartId;
  label: string;
  simple: string;
  languages: string[];
  tech: string[];
  folders: string[];
  files: number;
}

export interface RepoLanguage {
  name: string;
  files: number;
  /** estimated: counted for files we read, size / 34 for the rest */
  lines: number;
  share: number;
  color: string;
  /** one beginner sentence: what this language is for */
  what: string;
  kind: "code" | "markup" | "style" | "data" | "docs";
}

export interface RepoTech {
  name: string;
  kind: string;
  what: string;
  part: PartId;
}

export interface RepoOverview {
  summary: string;
  parts: RepoPart[];
  languages: RepoLanguage[];
  tech: RepoTech[];
  folders: { path: string; files: number; role: string }[];
  start_here: { path: string; why: string }[];
  how_it_runs: string[];
  /** the same steps as how_it_runs, each tagged with the part it happens in (for the diagram) */
  flow: { part: PartId | "user"; text: string }[];
  commands: { label: string; cmd: string }[];
}

export type BugCategory = "logic" | "security" | "crash" | "async" | "performance" | "data";

/** A code-level bug found by a readable, line-based rule. Snippets never contain a line that looks like a secret. */
export interface RepoBug {
  id: string;
  severity: Severity;
  confidence: "likely" | "possible";
  category: BugCategory;
  title: string;
  file: string;
  line: number;
  snippet: { start: number; lines: string[] };
  /** other lines in the same file with the same problem */
  also?: number[];
  why: string;
  fix: string;
  learn: string;
  practice?: { label: string; href: string };
}

export interface RepoReport {
  repo: { name: string; owner?: string; url?: string; source: "github" | "local"; description?: string | null; stars?: number; branch?: string };
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  verdict: string;
  kind: string;
  stack: string[];
  metrics: {
    files: number;
    code_files: number;
    test_files: number;
    sampled_files: number;
    est_lines: number;
    largest: { path: string; lines: number }[];
    languages: { name: string; share: number }[];
    top_folders: { path: string; files: number }[];
    max_depth: number;
  };
  layers: RepoLayer[];
  findings: RepoFinding[];
  strengths: { title: string; detail: string }[];
  roadmap: { step: number; title: string; detail: string; area: Area }[];
  target: { kind: string; layers: { label: string; holds: string; rule: string }[]; note: string };
  learn: { topic: string; why: string }[];
  areas: { area: Area; label: string; score: number }[];
  review: string;
  truncated: boolean;
  /** the project explained for a beginner: its parts, languages, folders, where to start, how to run it */
  overview: RepoOverview;
  /** code-level bugs, most serious first (≤ 40, one per rule + file) */
  bugs: RepoBug[];
}

/* ───────────────────────── helpers ───────────────────────── */

export const CODE_EXT = /\.(m?[jt]sx?|cjs|py|java|go|rb|php|cs|rs|kt|swift|vue|svelte|c|cc|cpp|h|hpp|dart|scala)$/i;
export const JUNK_DIR = /(^|\/)(node_modules|\.venv|venv|env|__pycache__|\.next|dist|build|out|coverage|\.pytest_cache|\.idea|target|vendor)\//;
export const TEST_PATH = /(^|\/)(tests?|__tests__|spec|specs|e2e|harness)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.(py|go)$/i;
export const SCRIPTISH = /(^|\/)(scripts?|bin|tools|harness|fixtures?|seed|examples?|docs?|migrations)\/|seed|fixture|redteam|mock/i;
/**
 * Files that hold deliberately broken or hostile code ON PURPOSE — practice targets (bug bounty, bug
 * factory), red-team programs, fixtures. They are never judged as the project's own bugs or findings.
 */
export const PRACTICE_FILE = /(^|\/)(fixtures?|__fixtures__|__mocks__)\/|(^|\/)fixtures?\.[a-z]+$|challenge-bank|redteam|bounty-programs/i;
/** Code that isn't the product itself (examples, docs, mocks, seed data) — skipped by the bug detectors. */
export const NOT_PRODUCT = /(^|\/)(examples?|samples?|demos?|docs?|mocks?|seeds?)\/|(^|\/)seed[\w-]*\.[a-z]+$|\.(stories|story)\.[jt]sx?$/i;

export function isCode(p: string): boolean {
  return CODE_EXT.test(p) && !/\.d\.ts$/.test(p) && !/\.min\.js$/.test(p);
}

export function lineCount(text: string): number {
  return text ? text.split(/\r?\n/).length : 0;
}

export function estLines(f: RepoFile, contents: Record<string, string>): number {
  const t = contents[f.path];
  return t !== undefined ? lineCount(t) : Math.round(f.size / 34);
}

export function base(p: string) {
  return p.split("/").pop() ?? p;
}

/** lower-case the first letter for mid-sentence use — but leave acronyms ("SQL", "CI") alone */
export function lc(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** "owner/name", github.com URLs (with .git, /tree/…, ?query) → { owner, name } */
export function parseRepoUrl(input: string): { owner: string; name: string } | null {
  const s = input.trim().replace(/\.git$/, "").replace(/[?#].*$/, "");
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i) ?? s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

/**
 * Which files to read in full. Key config/docs first, then the most central
 * source files (entry points, routes, services, models) and the biggest ones.
 * ~70 source files (≈90 reads in all) keeps a GitHub analysis under ~10 s:
 * these are reads from raw.githubusercontent.com, which don't count against
 * the 60/hour REST limit (the API makes only 3 REST calls per repo).
 */
export function pickFilesToRead(files: RepoFile[], max = 70): string[] {
  const clean = files.filter((f) => !JUNK_DIR.test(f.path) && f.size < 200_000);
  const key = clean.filter((f) => {
    const b = base(f.path).toLowerCase();
    const depth = f.path.split("/").length;
    return (
      (depth <= 3 && /^(readme(\.\w+)?|package\.json|requirements[\w-]*\.txt|pyproject\.toml|setup\.py|pipfile|tsconfig\.json|dockerfile|docker-compose\.ya?ml|compose\.ya?ml|\.gitignore|\.env\.example|\.env\.sample|go\.mod|cargo\.toml|pom\.xml|build\.gradle|composer\.json|gemfile|manage\.py|settings\.py|next\.config\.\w+|vite\.config\.\w+|license(\.\w+)?)$/.test(b)) ||
      /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f.path) ||
      /(^|\/)\.env(\.[\w-]+)?$/.test(f.path)
    );
  });
  const central = /(^|\/)(main|index|app|server|api|routes?|controllers?|handlers?|services?|models?|db|database|repositor(y|ies)|views|urls|schema|store)(\/|\.)/i;
  const code = clean
    .filter((f) => isCode(f.path) && !TEST_PATH.test(f.path) && !PRACTICE_FILE.test(f.path))
    .sort((a, b) => Number(central.test(b.path)) - Number(central.test(a.path)) || b.size - a.size);
  const tests = clean.filter((f) => TEST_PATH.test(f.path) && isCode(f.path)).slice(0, 3);
  // a repo of many small projects has a README + requirements.txt in every folder: keep the root's key
  // files and nested manifests (they mark apps), skip nested READMEs/licences, and cap them so source files
  // always get their share of the reads
  const depth = (p: string) => p.split("/").length;
  const keep = key
    .filter((f) => depth(f.path) === 1 || !/^(readme|license)/i.test(base(f.path)))
    .sort((a, b) => depth(a.path) - depth(b.path))
    .slice(0, 22);
  return uniq([...keep.map((f) => f.path), ...code.slice(0, max).map((f) => f.path), ...tests.map((f) => f.path)]).slice(0, max + 25);
}

/* ───────────────────────── stack + kind ───────────────────────── */

export function packageJsons(s: RepoSnapshot): Record<string, unknown>[] {
  return Object.entries(s.contents)
    .filter(([p]) => base(p) === "package.json")
    .map(([, t]) => {
      try {
        return JSON.parse(t) as Record<string, unknown>;
      } catch {
        return {};
      }
    });
}

export function allDeps(s: RepoSnapshot): Set<string> {
  const out = new Set<string>();
  for (const pj of packageJsons(s)) {
    for (const k of ["dependencies", "devDependencies", "peerDependencies"]) {
      const d = pj[k];
      if (d && typeof d === "object") for (const n of Object.keys(d)) out.add(n);
    }
  }
  const py = Object.entries(s.contents)
    .filter(([p]) => /requirements[\w-]*\.txt$|pyproject\.toml$|pipfile$/i.test(p))
    .map(([, t]) => t.toLowerCase())
    .join("\n");
  for (const m of py.matchAll(/^\s*["']?([a-z0-9_.-]+)/gm)) out.add("py:" + m[1]);
  return out;
}

export function detectStack(s: RepoSnapshot, deps: Set<string>): string[] {
  const paths = s.files.map((f) => f.path);
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const d = (n: string) => deps.has(n);
  const py = (n: string) => deps.has("py:" + n);
  const stack: string[] = [];
  if (has(/\.tsx?$/)) stack.push("TypeScript");
  else if (has(/\.m?jsx?$/)) stack.push("JavaScript");
  if (has(/\.py$/)) stack.push("Python");
  if (has(/\.java$/)) stack.push("Java");
  if (has(/\.go$/)) stack.push("Go");
  if (has(/\.rs$/)) stack.push("Rust");
  if (has(/\.php$/)) stack.push("PHP");
  if (has(/\.rb$/)) stack.push("Ruby");
  if (d("next")) stack.push("Next.js");
  else if (d("react")) stack.push("React");
  if (d("vue") || d("nuxt")) stack.push("Vue");
  if (d("svelte") || d("@sveltejs/kit")) stack.push("Svelte");
  if (d("@angular/core")) stack.push("Angular");
  if (d("express")) stack.push("Express");
  if (d("fastify")) stack.push("Fastify");
  if (d("@nestjs/core")) stack.push("NestJS");
  if (d("koa")) stack.push("Koa");
  if (d("hono")) stack.push("Hono");
  if (py("django") || has(/manage\.py$/)) stack.push("Django");
  if (py("flask")) stack.push("Flask");
  if (py("fastapi")) stack.push("FastAPI");
  if (py("streamlit")) stack.push("Streamlit");
  if (d("tailwindcss")) stack.push("Tailwind CSS");
  if (d("prisma") || d("@prisma/client") || has(/schema\.prisma$/)) stack.push("Prisma");
  if (d("drizzle-orm")) stack.push("Drizzle");
  if (d("mongoose") || d("mongodb") || py("pymongo")) stack.push("MongoDB");
  if (d("pg") || d("postgres") || py("psycopg2") || py("psycopg2-binary") || py("asyncpg")) stack.push("PostgreSQL");
  if (d("mysql") || d("mysql2") || py("pymysql")) stack.push("MySQL");
  if (d("sqlite3") || d("better-sqlite3") || has(/\.sqlite3?$|\.db$/) || has(/schema\.sql$/)) stack.push("SQLite / SQL");
  if (d("redis") || d("ioredis") || py("redis")) stack.push("Redis");
  if (d("@supabase/supabase-js")) stack.push("Supabase");
  if (d("firebase") || d("firebase-admin")) stack.push("Firebase");
  if (py("sqlalchemy")) stack.push("SQLAlchemy");
  if (d("jest")) stack.push("Jest");
  if (d("vitest")) stack.push("Vitest");
  if (py("pytest")) stack.push("pytest");
  if (d("@playwright/test") || d("playwright")) stack.push("Playwright");
  if (has(/(^|\/)dockerfile$/i)) stack.push("Docker");
  if (has(/^\.github\/workflows\//)) stack.push("GitHub Actions");
  return uniq(stack);
}

export function detectKind(s: RepoSnapshot, stack: string[]): string {
  const paths = s.files.map((f) => f.path);
  const root = packageJsons(s)[0] as { workspaces?: unknown } | undefined;
  if (root?.workspaces || (paths.some((p) => p.startsWith("apps/")) && paths.some((p) => p.startsWith("packages/")))) return "Monorepo (several apps in one repo)";
  const ui = stack.some((x) => ["Next.js", "React", "Vue", "Svelte", "Angular", "Streamlit"].includes(x));
  const api = stack.some((x) => ["Express", "Fastify", "NestJS", "Koa", "Hono", "Django", "Flask", "FastAPI"].includes(x));
  if (stack.includes("Next.js") || (ui && api)) return "Full-stack web app";
  if (ui) return "Web front-end";
  if (api) return "API / back-end service";
  // plain HTML + CSS + JavaScript sites (no framework)
  if (paths.some((p) => /\.html?$/i.test(p) && !/(^|\/)(templates|docs?|coverage)\//i.test(p)) && paths.some((p) => /\.(css|m?js)$/i.test(p)) && !paths.some((p) => p.endsWith(".py"))) return "Web front-end";
  if (stack.includes("Python")) return paths.filter((p) => p.endsWith(".py")).length <= 3 ? "Python script" : "Python project";
  if (paths.filter(isCode).length <= 4) return "Small project / script";
  return "Code library or project";
}

/* ───────────────────────── layers ───────────────────────── */

export const LAYER_DEFS: { id: RepoLayer["id"]; label: string; simple: string; re: RegExp }[] = [
  { id: "ui", label: "Screens (UI)", simple: "What the user sees and clicks.", re: /(^|\/)(components?|pages|views|templates|screens|layouts|ui|frontend|client|static|styles|public)\/|\.(tsx|jsx|vue|svelte|html|css|scss)$|(^|\/)app\/.*page\.\w+$/i },
  { id: "api", label: "API / routes", simple: "The doors requests come in through.", re: /(^|\/)(routes?|api|controllers?|handlers?|endpoints?|resolvers?|graphql|server)\/|(^|\/)(urls|views|server|app|routes?)\.(py|[jt]s|mjs)$/i },
  { id: "logic", label: "Logic (services)", simple: "The rules of your app — what it actually decides.", re: /(^|\/)(services?|core|domain|usecases?|business|logic|lib|engine|utils?|helpers?)\//i },
  { id: "data", label: "Data access", simple: "The only code that talks to the database.", re: /(^|\/)(models?|db|database|repositor(y|ies)|dao|entities|prisma|migrations?|schemas?|store)\/|\.sql$|schema\.prisma$|(^|\/)models\.py$/i },
  { id: "config", label: "Config", simple: "Settings that change between laptop and server.", re: /(^|\/)(config|settings)\/|\.env\.example$|\.env\.sample$|(^|\/)settings\.py$|\.config\.(m?[jt]s|json)$|(^|\/)config\.(py|[jt]s|json|ya?ml)$/i },
  { id: "tests", label: "Tests", simple: "Code that checks your code still works.", re: TEST_PATH },
  { id: "infra", label: "Ship & run", simple: "How it gets built, checked and deployed.", re: /(^|\/)(dockerfile|docker-compose\.ya?ml|compose\.ya?ml|procfile|vercel\.json|netlify\.toml|fly\.toml|render\.ya?ml)$|^\.github\/workflows\/|(^|\/)(k8s|helm|terraform|infra|deploy)\//i },
  { id: "docs", label: "Docs", simple: "How a new person understands and runs it.", re: /(^|\/)(docs?)\/|(^|\/)readme(\.\w+)?$|(^|\/)contributing\.md$/i },
];

export function detectLayers(files: RepoFile[]): RepoLayer[] {
  return LAYER_DEFS.map((d) => {
    const hits = files.filter((f) => d.re.test(f.path));
    const dirs = uniq(hits.map((f) => (f.path.includes("/") ? f.path.split("/").slice(0, Math.min(2, f.path.split("/").length - 1)).join("/") + "/" : f.path)));
    return { id: d.id, label: d.label, simple: d.simple, present: hits.length > 0, paths: dirs.slice(0, 5), files: hits.length };
  });
}

/* ───────────────────────── checks ───────────────────────── */

export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", re: /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/ },
  { name: "OpenAI-style key", re: /\bsk-(proj-)?[A-Za-z0-9_-]{24,}/ },
  { name: "Anthropic key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "Groq key", re: /\bgsk_[A-Za-z0-9]{24,}/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "Stripe live key", re: /\b(sk|rk)_live_[A-Za-z0-9]{16,}/ },
  { name: "private key", re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: "database URL with a password", re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^:\s/'"]+:[^@\s'"]{3,}@/ },
];
export const GENERIC_SECRET = /\b(password|passwd|pwd|secret|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']([^"'\s]{6,})["']/i;
export const PLACEHOLDER = /your|xxx|changeme|example|placeholder|dummy|test|sample|<|\$\{|process\.env|os\.environ|getenv|\*\*\*|redacted|todo/i;

export function scanSecrets(contents: Record<string, string>): { file: string; line: number; kind: string }[] {
  const out: { file: string; line: number; kind: string }[] = [];
  for (const [file, text] of Object.entries(contents)) {
    if (/\.env\.(example|sample|template)$|\.md$/i.test(file) || PRACTICE_FILE.test(file)) continue;
    const lines = text.split(/\r?\n/);
    lines.forEach((l, i) => {
      if (l.length > 2000) return;
      for (const p of SECRET_PATTERNS) if (p.re.test(l)) return void out.push({ file, line: i + 1, kind: p.name });
      const g = l.match(GENERIC_SECRET);
      if (g && !PLACEHOLDER.test(g[2]) && !TEST_PATH.test(file)) out.push({ file, line: i + 1, kind: `hard-coded ${g[1].toLowerCase()}` });
    });
  }
  return out.slice(0, 12);
}

/** Stricter than scanSecrets on purpose: any line that might hold a secret is never shown in a snippet. */
export function looksSecret(line: string): boolean {
  return (
    SECRET_PATTERNS.some((p) => p.re.test(line)) ||
    GENERIC_SECRET.test(line) ||
    /\b(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key)\w*\s*(===?|!==?|[:=])\s*["'`][^"'`\s]{6,}["'`]/i.test(line)
  );
}

export const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };