/**
 * Bug Bounty — learn to hunt bugs the way security researchers do.
 *
 * Three kinds of program:
 *   • platform     — Layerflow's own practice targets (bounty-programs.ts):
 *                    real code with planted bugs, triaged instantly by matching
 *                    the reported line + kind of bug against the planted list.
 *   • company      — posted by a company: scope, rules, a repo or product to
 *                    test; the company triages each report by hand.
 *   • open_source  — a public repository; same as company, owned by its maintainer.
 *
 * Rewards are Layerflow points (100 points = ₹10, see rewards.ts). A company
 * program only pays points from the reward pool its plan unlocked — so nobody
 * can mint points by posting a program and approving their own reports.
 */
import { BUILT_IN_PROGRAMS, type BuiltInProgram, type PlantedBug } from "./bounty-programs.ts";

export type BountySeverity = "critical" | "high" | "medium" | "low";
export type BountyCategory =
  | "injection"
  | "broken_access"
  | "auth"
  | "xss"
  | "business_logic"
  | "race_condition"
  | "data_exposure"
  | "crypto"
  | "logic"
  | "crash";

export const SEVERITIES: { id: BountySeverity; label: string; color: string; simple: string }[] = [
  { id: "critical", label: "Critical", color: "#b42318", simple: "An attacker takes over accounts, money or the whole database." },
  { id: "high", label: "High", color: "#c64e27", simple: "Other people's data or money is at risk." },
  { id: "medium", label: "Medium", color: "#f59e0b", simple: "Real harm, but it needs extra conditions or leaks less." },
  { id: "low", label: "Low", color: "#0586d2", simple: "A small bug: wrong results or a crash, no data at risk." },
];

export const CATEGORIES: { id: BountyCategory; label: string; simple: string }[] = [
  { id: "injection", label: "Injection (SQL / command)", simple: "User input gets run as code or as part of a query." },
  { id: "broken_access", label: "Broken access control / IDOR", simple: "You can read or change something that isn't yours." },
  { id: "auth", label: "Broken authentication", simple: "Logging in, tokens or OTPs can be faked or guessed." },
  { id: "xss", label: "Cross-site scripting (XSS)", simple: "Someone's text runs as JavaScript in other people's browsers." },
  { id: "business_logic", label: "Business logic flaw", simple: "The rules can be bent: prices, quantities, money, limits." },
  { id: "race_condition", label: "Race condition", simple: "Two requests at the same moment break an assumption." },
  { id: "data_exposure", label: "Sensitive data exposure", simple: "Secrets or personal data end up where they shouldn't." },
  { id: "crypto", label: "Weak crypto / randomness", simple: "Passwords, tokens or codes are protected with the wrong tool." },
  { id: "logic", label: "Logic bug (off-by-one, boundary)", simple: "The code gives the wrong answer at an edge." },
  { id: "crash", label: "Crash / unhandled error", simple: "A normal input makes the app throw an error." },
];

export const SEVERITY_RANK: Record<BountySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const DEFAULT_REWARDS: Record<BountySeverity, number> = { critical: 2000, high: 1000, medium: 400, low: 150 };

/** Reports a learner may file per program per day — line-guessing doesn't scale. */
export const REPORTS_PER_DAY = 10;

/* ───────────────────────── company plans (paid through Dodo) ───────────────────────── */

export interface BountyPlan {
  id: "community" | "starter" | "growth";
  name: string;
  price_inr: number;
  /** reward points the plan unlocks for hunters */
  points_pool: number;
  perks: string[];
}

export const BOUNTY_PLANS: BountyPlan[] = [
  {
    id: "community",
    name: "Community",
    price_inr: 0,
    points_pool: 0,
    perks: ["Public program page", "Reports from Layerflow hunters", "You triage every report", "Hunters earn reputation, not points"],
  },
  {
    id: "starter",
    name: "Starter",
    price_inr: 1999,
    points_pool: 10_000,
    perks: ["Everything in Community", "10,000 reward points for valid bugs (₹1,000 for hunters)", "Featured for 30 days"],
  },
  {
    id: "growth",
    name: "Growth",
    price_inr: 4999,
    points_pool: 30_000,
    perks: ["Everything in Starter", "30,000 reward points for valid bugs (₹3,000 for hunters)", "Pinned at the top of Bug Bounty"],
  },
];

export function getPlan(id: string): BountyPlan | undefined {
  return BOUNTY_PLANS.find((p) => p.id === id);
}

/* ───────────────────────── built-in programs ───────────────────────── */

export function builtInProgram(id: string): BuiltInProgram | undefined {
  return BUILT_IN_PROGRAMS.find((p) => p.id === id);
}

function lineOf(p: BuiltInProgram, bug: PlantedBug): number {
  const f = p.files.find((x) => x.path === bug.file);
  if (!f) throw new Error(`bounty ${p.id}: no file ${bug.file}`);
  const hits = f.content.split("\n").flatMap((l, i) => (l.includes(bug.anchor) ? [i + 1] : []));
  if (hits.length !== 1) throw new Error(`bounty ${p.id}/${bug.id}: anchor matches ${hits.length} lines`);
  return hits[0];
}

/** The planted bugs with their resolved line ranges. API-only. */
export function plantedBugs(p: BuiltInProgram): (PlantedBug & { line: number; from: number; to: number })[] {
  return p.bugs.map((b) => {
    const line = lineOf(p, b);
    return { ...b, line, from: line - b.span[0], to: line + b.span[1] };
  });
}

export interface PublicBuiltIn {
  id: string;
  kind: "platform";
  company: string;
  logo: string;
  title: string;
  tagline: string;
  difficulty: BuiltInProgram["difficulty"];
  stack: string[];
  summary: string;
  scope: string[];
  out_of_scope: string[];
  rules: string[];
  rewards: Record<BountySeverity, number>;
  files: { path: string; language: string; content: string; lines: number }[];
  bug_count: number;
  by_severity: Record<BountySeverity, number>;
  max_points: number;
}

/** What the browser may see: the code and the counts — never where the bugs are. */
export function publicBuiltIn(p: BuiltInProgram): PublicBuiltIn {
  const by: Record<BountySeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const b of p.bugs) by[b.severity]++;
  return {
    id: p.id,
    kind: "platform",
    company: p.company,
    logo: p.logo,
    title: p.title,
    tagline: p.tagline,
    difficulty: p.difficulty,
    stack: p.stack,
    summary: p.summary,
    scope: p.scope,
    out_of_scope: p.out_of_scope,
    rules: p.rules,
    rewards: p.rewards,
    files: p.files.map((f) => ({ path: f.path, language: f.language, content: f.content, lines: f.content.split("\n").length - (f.content.endsWith("\n") ? 1 : 0) })),
    bug_count: p.bugs.length,
    by_severity: by,
    max_points: p.bugs.reduce((n, b) => n + p.rewards[b.severity], 0),
  };
}

/* ───────────────────────── reports ───────────────────────── */

export interface ReportInput {
  title: string;
  category: string;
  severity: string;
  file?: string | null;
  line?: number | null;
  description: string;
  steps?: string | null;
  impact?: string | null;
  fix?: string | null;
}

export function validateReport(r: ReportInput, needsLocation: boolean): string | null {
  if (!r.title || r.title.trim().length < 8) return "Give the report a clear title (at least 8 characters), e.g. “SQL injection in product search”.";
  if (r.title.length > 140) return "Keep the title under 140 characters.";
  if (!CATEGORIES.some((c) => c.id === r.category)) return "Pick what kind of bug it is.";
  if (!SEVERITIES.some((s) => s.id === r.severity)) return "Pick a severity.";
  if (needsLocation) {
    if (!r.file) return "Choose the file the bug is in.";
    if (!Number.isInteger(r.line) || (r.line as number) < 1) return "Click the line where the bug is.";
  }
  if (!r.description || r.description.trim().length < 40) return "Explain the bug and what an attacker could do with it (at least 40 characters).";
  if (r.description.length > 6000 || (r.steps?.length ?? 0) > 4000 || (r.impact?.length ?? 0) > 2000 || (r.fix?.length ?? 0) > 2000) return "That report is too long — keep it focused.";
  return null;
}

export type Triage =
  | { status: "valid"; bug: PlantedBug & { line: number } }
  | { status: "needs_info"; message: string }
  | { status: "invalid"; message: string };

/**
 * Instant triage for a platform program: the report must point inside a
 * planted bug's range AND name the right kind of bug. Right place, wrong kind
 * → "needs info" (try again); anything else → "not reproducible".
 */
export function triageBuiltIn(p: BuiltInProgram, r: { file?: string | null; line?: number | null; category: string }): Triage {
  const file = (r.file ?? "").replace(/^\.?\//, "");
  const line = Number(r.line);
  const near = plantedBugs(p).filter((b) => b.file === file && line >= b.from && line <= b.to);
  const hit = near
    .filter((b) => b.category === r.category || b.alsoAccept?.includes(r.category as BountyCategory))
    .sort((a, b) => Math.abs(a.line - line) - Math.abs(b.line - line))[0];
  if (hit) return { status: "valid", bug: hit };
  if (near.length)
    return {
      status: "needs_info",
      message: "You're looking at the right place — but that's not the kind of bug it is. Ask what an attacker could actually do here, then file it again with the right category.",
    };
  return {
    status: "invalid",
    message: "The triage team couldn't confirm a security or logic bug at that spot. Re-read the scope, follow the user's input through the code, and try again.",
  };
}

/** Points for a confirmed bug: half if the hunter took a nudge first. */
export function rewardFor(rewards: Record<BountySeverity, number>, severity: BountySeverity, nudged: boolean): number {
  const base = rewards[severity] ?? 0;
  return nudged ? Math.floor(base / 2) : base;
}

/* ───────────────────────── company / open-source programs ───────────────────────── */

export interface ProgramInput {
  owner_id: string;
  kind: "company" | "open_source";
  company: string;
  title: string;
  summary: string;
  repo_url?: string | null;
  website?: string | null;
  scope: string[];
  out_of_scope: string[];
  rewards: Record<BountySeverity, number>;
  plan: string;
}

export function validateProgram(p: ProgramInput): string | null {
  if (!p.company || p.company.trim().length < 2) return "Add the company or project name.";
  if (!p.title || p.title.trim().length < 6) return "Give the program a title (at least 6 characters).";
  if (!p.summary || p.summary.trim().length < 30) return "Describe what hunters will test in a sentence or two (at least 30 characters).";
  if (p.repo_url && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(p.repo_url.trim())) return "The repository must be a GitHub link like https://github.com/owner/repo.";
  if (p.website && !/^https:\/\/[^\s]+$/.test(p.website.trim())) return "The website must start with https://";
  if (p.kind === "open_source" && !p.repo_url) return "An open-source program needs its GitHub repository.";
  if (!p.repo_url && !p.website) return "Add a GitHub repository or a website hunters are allowed to test.";
  if (!p.scope.length || p.scope.some((s) => !s.trim())) return "List at least one thing that is in scope.";
  if (p.scope.length > 20 || p.out_of_scope.length > 20) return "Keep scope lists under 20 items each.";
  for (const s of SEVERITIES) {
    const v = p.rewards?.[s.id];
    if (!Number.isInteger(v) || v < 0 || v > 50_000) return `Set the ${s.label.toLowerCase()} reward in points (0–50,000).`;
  }
  if (!(p.rewards.critical >= p.rewards.high && p.rewards.high >= p.rewards.medium && p.rewards.medium >= p.rewards.low)) return "Rewards should go down with severity: critical ≥ high ≥ medium ≥ low.";
  if (!getPlan(p.plan)) return "Pick a plan.";
  return null;
}

/** Common, readable fallback for the "how to hunt" guide shown on company programs. */
export const HUNTING_CHECKLIST = [
  "Read the scope twice. Only test what's listed — and only with your own test accounts.",
  "Map the inputs: forms, URL parameters, headers, uploads, anything the user controls.",
  "Follow each input to where it's used: SQL, HTML, file paths, money, other users' data.",
  "Ask the classic questions: is this mine? what if it's negative, empty or huge? what if two requests race?",
  "Prove it with the smallest possible example — never touch real users' data, never slow the service down.",
  "Write it up: title, location, steps, impact, suggested fix. Then wait for the company — don't publish it.",
];
