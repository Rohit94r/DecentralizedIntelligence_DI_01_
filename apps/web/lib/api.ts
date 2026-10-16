/**
 * Typed client for the Layerflow API. Same origin (/api is proxied to the
 * Fastify server by next.config.ts), so no CORS and one URL for the judges.
 * The browser never receives a hidden test — these types have no room for one.
 */
export type Outcome = "passed" | "wrong_output" | "runtime_error" | "timeout";

export interface ChallengeSummary {
  id: string;
  title: string;
  signature: string;
  difficulty: "easy" | "medium" | "hard";
  concepts: string[];
  concept_labels: string[];
  visible_count: number;
  hidden_count: number;
  bug_factory: { tag: string } | null;
}

export interface Challenge extends ChallengeSummary {
  fn: string;
  description: string;
  inputs: string;
  starter: string;
  visible: { test: number; call: string; expected: string }[];
  probes: { kind: string; label: string; call: string }[];
  targets: string[];
  source: string;
}

export interface SubmitResult {
  submission_id: string;
  learner_id: string;
  challenge_id: string;
  visible: { test: number; call: string; expected: string; got: string; outcome: Outcome }[];
  hidden: { test: number; outcome: Outcome }[];
  mistake_tags: string[];
  explanation: string;
  debug?: { culprit_line: number | null; confidence: string | null; reason: string | null; trace_ref: string; passed: boolean; detail: string | null; headline?: string };
}

export interface HintResult {
  submission_id: string;
  hint_index: number;
  rung: number;
  rung_name?: string;
  hint: string;
  remaining: number;
  note?: string;
}

export interface TraceStep {
  step: number;
  line: number;
  event: "line" | "return" | "exception";
  locals: Record<string, string>;
  note?: string;
  flag?: boolean;
}

export interface TraceResult {
  ok: boolean;
  call: string;
  steps: TraceStep[];
  result?: string;
  error?: string;
  firstWrongStep: number | null;
  truncated: boolean;
  used_kind?: string;
  kinds?: { kind: string; label: string }[];
}

export interface LearnerView {
  learner_id: string;
  recurring_mistakes: string[];
  one_off_mistakes: string[];
  mastery: Record<string, number>;
  next_challenge: { challenge_id: string; reason: string };
  history: { submission_id: string; challenge_id: string; at: string; tags: string[]; passed: boolean; hints_used: number }[];
  next_basis: string;
  recurring_where: Record<string, string[]>;
  touched_concepts: string[];
  concept_labels: Record<string, string>;
  tag_labels: Record<string, string>;
  mastery_timeline: { at: string; label: string; mastery: Record<string, number> }[];
  streak_days: number;
  totals: { submissions: number; passes: number; challenges_cleared: number; first_try_passes: number; hints: number };
  bug_factory: { challenge_id: string; tag: string; reason: string };
  activity: { day: string; n: number }[];
}

export interface LedgerEntry {
  id: number;
  ts: string;
  kind: string;
  learner_id: string | null;
  submission_id: string | null;
  prompt: string;
  response: string;
  model: string | null;
  rejected_for_code: boolean;
}

export interface TaxonomyEntry {
  tag: string;
  label: string;
  optional?: boolean;
  rule: string;
  signals: string;
  example: string;
  exampleChallenge: string;
  unitTest: string;
  color: string;
}

export interface HostileProgram {
  id: number;
  name: string;
  category: string;
  challenge: string;
  code: string;
  outcomes: string[];
  details?: string[];
  why: string;
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  health: () => req<{ ok: boolean; llm: string | null; challenges: number; sandbox: { warm: number; live: number } | null }>("GET", "/api/health"),
  challenges: () => req<{ challenges: ChallengeSummary[]; judge_challenges: string[]; concept_labels: Record<string, string> }>("GET", "/api/challenges"),
  challenge: (id: string) => req<Challenge>("GET", `/api/challenges/${encodeURIComponent(id)}`),
  submit: (learner_id: string, challenge_id: string, code: string) => req<SubmitResult>("POST", "/api/submit", { learner_id, challenge_id, code }),
  hint: (submission_id: string, message?: string) => req<HintResult>("POST", "/api/hint", { submission_id, message }),
  replay: (submission_id: string, opts: { kind?: string; args_source?: string } = {}) => req<TraceResult>("POST", "/api/replay", { submission_id, ...opts }),
  learner: (id: string) => req<LearnerView>("GET", `/api/learner/${encodeURIComponent(id)}`),
  learners: () => req<{ learners: { id: string; submissions: number; passes: number; last_at: string | null }[] }>("GET", "/api/learners"),
  ledger: (q: { learner_id?: string; submission_id?: string; kind?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return req<{ stats: { total: number; hints: number; explanations: number; rejected: number; llm: number }; entries: LedgerEntry[] }>("GET", `/api/ledger${qs ? "?" + qs : ""}`);
  },
  taxonomy: () => req<{ categories: TaxonomyEntry[]; recurrence_rule: string; priority_rule: string; mastery_rules: Record<string, unknown> }>("GET", "/api/taxonomy"),
  redteam: () => req<{ programs: HostileProgram[]; escapes: HostileProgram[] }>("GET", "/api/redteam"),
  stats: () => req<{ submissions: number; passes: number; learners: number; hints: number; rejected: number; contained: number; challenges: number; hostile_programs: number }>("GET", "/api/stats"),
  feed: () => req<{ items: { submission_id: string; learner_id: string; challenge_id: string; title: string; passed: boolean; tags: string[]; hints: number; duration_ms: number; at: string }[] }>("GET", "/api/feed"),
  bugFactory: (learner: string, challenge?: string) =>
    req<{ challenge: Challenge; tag: string; tag_label: string; reason: string; found: boolean; attempts: number; templates?: { challenge_id: string; tag: string; title: string }[] }>(
      "GET",
      challenge ? `/api/bug-factory/${encodeURIComponent(learner)}/${encodeURIComponent(challenge)}` : `/api/bug-factory/${encodeURIComponent(learner)}`,
    ),
  locate: (learner_id: string, challenge_id: string, line: number) => req<{ correct: boolean; attempts: number; message: string; lesson?: string }>("POST", "/api/bug-factory/locate", { learner_id, challenge_id, line }),
  reset: () => req<{ ok: boolean }>("POST", "/api/dev/reset", {}),
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  passed: "passed",
  wrong_output: "wrong output",
  runtime_error: "runtime error",
  timeout: "timeout",
};

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
