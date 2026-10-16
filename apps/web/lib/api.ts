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

/* ── Mentoring ── */

export interface Mentor {
  id: string;
  name: string;
  title: string;
  avatar: string;
}

export interface MentorProblem {
  challenge_id: string;
  title: string;
  signature: string;
  difficulty: "easy" | "medium" | "hard";
  bug_factory: boolean;
  attempts: number;
  passed: boolean;
  ever_passed: boolean;
  last_at: string;
  submission_id: string;
  tags: string[];
  tags_seen: string[];
  tag_labels: string[];
  headline: string;
  culprit_line: number | null;
  hints_used: number;
  status: "solved" | "struggling";
}

export interface MentorOverview {
  mentor: Mentor;
  learner_id: string;
  learner_name: string;
  problems: MentorProblem[];
  recurring: { tag: string; label: string; where: string[] }[];
  one_off: { tag: string; label: string; where: string[] }[];
  next: { challenge_id: string; title: string; reason: string };
  fresh: { challenge_id: string; title: string; difficulty: string }[];
  totals: { attempted: number; solved: number; struggling: number };
}

export type MentorVisual =
  | { kind: "intro"; title: string; signature: string; attempts: number; status: "solved" | "struggling" | "new" }
  | { kind: "tests"; visible: SubmitResult["visible"]; hidden: SubmitResult["hidden"] }
  | { kind: "trace"; step: number }
  | { kind: "linemap"; line: number; reason: string }
  | { kind: "pattern"; tag: string; label: string; rule: string; example: string; where: string[] }
  | { kind: "plan"; steps: string[]; next?: { challenge_id: string; title: string; reason: string } };

export interface MentorSegment {
  id: string;
  title: string;
  say: string;
  speech: string;
  visual: MentorVisual;
}

export interface MentorSession {
  mentor: Mentor;
  learner_name: string;
  challenge: Challenge;
  submission_id: string | null;
  passed: boolean;
  code: string;
  visible: SubmitResult["visible"];
  hidden: SubmitResult["hidden"];
  tags: string[];
  line_map: { culprit_line: number | null; confidence: string; reason: string } | null;
  trace: TraceResult | null;
  segments: MentorSegment[];
  lang?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  suggestions: string[];
  source: "ai" | "built-in";
  model: string | null;
  intent: string;
}

export interface VoiceStatus {
  tts: "elevenlabs" | "browser";
  stt: "groq" | "browser";
  chat: string;
  providers: string[];
  mentor: Mentor;
}

/* ── Repo Analyse ── */

export type Severity = "high" | "medium" | "low";

export interface RepoFinding {
  id: string;
  severity: Severity;
  area: string;
  title: string;
  why: string;
  fix: string;
  learn?: string;
  files?: string[];
}

export interface RepoReport {
  id: string;
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
  layers: { id: string; label: string; simple: string; present: boolean; paths: string[]; files: number }[];
  findings: RepoFinding[];
  strengths: { title: string; detail: string }[];
  roadmap: { step: number; title: string; detail: string; area: string }[];
  target: { kind: string; layers: { label: string; holds: string; rule: string }[]; note: string };
  learn: { topic: string; why: string }[];
  areas: { area: string; label: string; score: number }[];
  review: string;
  review_model?: string | null;
  truncated: boolean;
  created_at?: string;
}

/* ── Community ── */

export type Role = "student" | "teacher" | "mentor_ai";
export type PostKind = "question" | "discussion" | "tip" | "showcase";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  avatar: string | null;
  bio: string | null;
  created_at: string;
}

interface Authored {
  author_id: string;
  author_name: string;
  author_role: Role;
  author_avatar: string | null;
  spoiler: boolean;
  locked: boolean;
  score: number;
  my_vote: number;
  created_at: string;
}

export interface Post extends Authored {
  id: number;
  kind: PostKind;
  title: string;
  body: string;
  challenge_id: string | null;
  challenge_title: string | null;
  accepted_reply_id: number | null;
  reply_count: number;
  teacher_replies: number;
}

export interface Reply extends Authored {
  id: number;
  post_id: number;
  body: string;
  ai: boolean;
}

export interface CommunityStats {
  posts: number;
  replies: number;
  teachers: number;
  students: number;
  answered: number;
}

export interface TeacherDesk {
  students: {
    learner_id: string;
    name: string;
    submissions: number;
    pass_rate: number;
    last_at: string | null;
    recurring: { tag: string; label: string; where: string[] }[];
    stuck_on: { challenge_id: string; title: string }[];
    open_questions: number;
    need: number;
    suggestion: string;
  }[];
  open_questions: { id: number; title: string; author_name: string; challenge_id: string | null; created_at: string }[];
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
  health: () => req<{ ok: boolean; llm: string | null; ai?: string | null; challenges: number; sandbox: { warm: number; live: number } | null }>("GET", "/api/health"),
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

  // ── Mentoring · voice · chat ──
  mentor: (learner: string) => req<MentorOverview>("GET", `/api/mentor/${encodeURIComponent(learner)}`),
  mentorSession: (learner_id: string, challenge_id: string, lang?: string) => req<MentorSession>("POST", "/api/mentor/session", { learner_id, challenge_id, lang }),
  voiceStatus: () => req<VoiceStatus>("GET", "/api/voice/status"),
  chat: (body: { learner_id?: string | null; message: string; history?: ChatTurn[]; lang?: string; context?: { page?: string; challenge_id?: string; code?: string; repo_report_id?: string } }) =>
    req<ChatReply>("POST", "/api/chat", { ...body, learner_id: body.learner_id ?? undefined }),

  // ── Repo Analyse ──
  analyzeRepo: (body: { url?: string; local?: boolean; learner_id?: string | null }) => req<RepoReport>("POST", "/api/repo/analyze", { ...body, learner_id: body.learner_id ?? undefined }),
  repoReports: (learner_id?: string | null) => req<{ reports: { id: string; repo: string; source: string; score: number; grade: string; created_at: string }[] }>("GET", `/api/repo/reports${learner_id ? `?learner_id=${encodeURIComponent(learner_id)}` : ""}`),
  repoReport: (id: string) => req<RepoReport>("GET", `/api/repo/reports/${encodeURIComponent(id)}`),

  // ── Community ──
  communityMeta: () => req<{ kinds: { kind: PostKind; label: string; emoji: string; help: string }[]; challenges: { id: string; title: string }[]; mentor: Mentor }>("GET", "/api/community/meta"),
  posts: (q: { viewer?: string | null; kind?: string; challenge_id?: string; q?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return req<{ posts: Post[]; stats: CommunityStats }>("GET", `/api/community/posts${qs ? "?" + qs : ""}`);
  },
  thread: (id: number, viewer?: string | null) => req<Post & { replies: Reply[] }>("GET", `/api/community/posts/${id}${viewer ? `?viewer=${encodeURIComponent(viewer)}` : ""}`),
  createPost: (b: { author_id: string; kind: PostKind; title: string; body: string; challenge_id?: string | null }) => req<{ id: number; spoiler: boolean; spoiler_reason: string | null }>("POST", "/api/community/posts", b),
  reply: (postId: number, b: { author_id: string; body: string }) => req<{ id: number; spoiler: boolean }>("POST", `/api/community/posts/${postId}/replies`, b),
  accept: (postId: number, actor_id: string, reply_id: number | null) => req<{ ok: boolean }>("POST", `/api/community/posts/${postId}/accept`, { actor_id, reply_id }),
  vote: (voter_id: string, target: "post" | "reply", id: number, value: 1 | -1 | 0) => req<{ score: number }>("POST", "/api/community/vote", { voter_id, target, id, value }),
  people: () => req<{ mentor: Mentor; teachers: Profile[]; students: (Profile & { submissions: number; passes: number })[]; stats: CommunityStats }>("GET", "/api/community/people"),
  teacherDesk: () => req<TeacherDesk>("GET", "/api/community/teacher-desk"),
  profile: (id: string) => req<Profile>("GET", `/api/profile/${encodeURIComponent(id)}`),
  saveProfile: (b: { id: string; display_name?: string; role?: "student" | "teacher"; bio?: string }) => req<Profile>("POST", "/api/profile", b),
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
