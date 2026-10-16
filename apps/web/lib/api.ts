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
  streak: { current: number; longest: number; today_done: boolean; at_risk: boolean; points: number };
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

export type RepoPartId = "frontend" | "backend" | "database" | "mobile" | "ml" | "devops" | "tests" | "tooling";

export interface RepoPart {
  id: RepoPartId;
  label: string;
  simple: string;
  languages: string[];
  tech: string[];
  folders: string[];
  files: number;
}

export interface RepoOverview {
  summary: string;
  parts: RepoPart[];
  languages: { name: string; files: number; lines: number; share: number; color: string; what: string; kind: "code" | "markup" | "style" | "data" | "docs" }[];
  tech: { name: string; kind: string; what: string; part: RepoPartId }[];
  folders: { path: string; files: number; role: string }[];
  start_here: { path: string; why: string }[];
  how_it_runs: string[];
  flow: { part: RepoPartId | "user"; text: string }[];
  commands: { label: string; cmd: string }[];
}

export type BugCategory = "logic" | "security" | "crash" | "async" | "performance" | "data";

export interface RepoBug {
  id: string;
  severity: Severity;
  confidence: "likely" | "possible";
  category: BugCategory;
  title: string;
  file: string;
  line: number;
  snippet: { start: number; lines: string[] };
  why: string;
  fix: string;
  learn: string;
  practice?: { label: string; href: string };
}

export type SiteCategory = "security" | "performance" | "seo" | "accessibility" | "best";

export interface SiteIssue {
  id: string;
  category: SiteCategory;
  severity: Severity;
  title: string;
  detail: string;
  why: string;
  fix: string;
  evidence: string[];
}

/** Website Analyse — a live URL instead of a repo (see packages/core/src/site-audit.ts). */
export interface SiteReport {
  id: string;
  kind: "site";
  site: { input: string; url: string; host: string; title: string | null; description: string | null; favicon: string | null; image: string | null; lang: string | null; https: boolean; status: number; server: string | null; redirects: string[] };
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  summary: string;
  categories: { id: SiteCategory; label: string; score: number; passed: number; total: number }[];
  tech: { name: string; kind: string; version: string | null; evidence: string }[];
  issues: SiteIssue[];
  passed: { category: SiteCategory; title: string }[];
  metrics: { html_kb: number; ttfb_ms: number; total_ms: number; scripts: number; external_scripts: number; styles: number; images: number; links: number; tags: number; third_party: string[]; sampled: number; sampled_kb: number; inline_script_kb: number };
  review?: string;
  truncated: boolean;
}

export const isSiteReport = (r: RepoReport | SiteReport | null): r is SiteReport => !!r && (r as SiteReport).kind === "site" && "site" in r;

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
  /** optional: reports saved before the beginner overview and bug detection existed don't have them */
  overview?: RepoOverview;
  bugs?: RepoBug[];
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
  /** who replied (no bodies) — only on the posts list */
  replies_lite?: { id: number; author_id: string; author_name: string; author_role: Role; author_avatar: string | null; ai: boolean; score: number; created_at: string }[];
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

/* ── Rewards (streak · points · redeem) ── */

export interface StreakView {
  current: number;
  longest: number;
  today_done: boolean;
  at_risk: boolean;
  today: string;
  last7: { day: string; done: boolean }[];
  active_days: number;
  next_milestone: number;
}

export interface Goodie {
  id: string;
  name: string;
  blurb: string;
  points: number;
  emoji: string;
  image?: string;
  sizes?: string[];
  tint: "green" | "purple" | "orange" | "sky" | "amber";
  inr: string;
  affordable: boolean;
}

export type RedemptionStatus = "requested" | "approved" | "paid" | "shipped" | "delivered" | "rejected" | "cancelled";

export interface Redemption {
  id: string;
  kind: "cash" | "goodie";
  item_id: string | null;
  item_name: string | null;
  item_emoji: string | null;
  item_image: string | null;
  size: string | null;
  points: number;
  inr: string;
  upi: string | null;
  ship_to: string | null;
  status: RedemptionStatus;
  note: string | null;
  payout_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface RewardsView {
  learner_id: string;
  streak: StreakView;
  /** a GitHub-style year: 53 weeks × Sun→Sat, solves per day */
  calendar: { day: string; count: number; future: boolean }[];
  points: { balance: number; earned: number; streak: number; bounty: number; redeemed: number; inr: string; earned_inr: string };
  rules: { points_per_day: number; points_per_rupee: number; min_cash_points: number; cash_step_points: number; day_counts_when: string; timezone_offset_min: number; payouts: "demo" | "manual" };
  today_pick: { challenge_id: string; title: string; reason: string };
  ledger: { id: number; delta: number; kind: "streak_day" | "bounty" | "redeem" | "refund" | "adjust"; ref: string; note: string; created_at: string }[];
  redemptions: Redemption[];
  goodies: Goodie[];
  has_pin: boolean;
}

export interface RewardsSummary {
  learner_id: string;
  streak: number;
  today_done: boolean;
  at_risk: boolean;
  points: number;
  inr: string;
  has_pin: boolean;
}

export interface Shipping {
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
}

/* ── Bug Bounty ── */

export type BountySeverity = "critical" | "high" | "medium" | "low";
export type ReportStatus = "triage" | "valid" | "duplicate" | "needs_info" | "invalid";

export interface BountyCategory {
  id: string;
  label: string;
  simple: string;
}

export interface BountySeverityInfo {
  id: BountySeverity;
  label: string;
  color: string;
  simple: string;
}

export interface PlatformProgram {
  id: string;
  kind: "platform";
  company: string;
  logo: string;
  title: string;
  tagline: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  stack: string[];
  summary: string;
  scope: string[];
  out_of_scope: string[];
  rules: string[];
  rewards: Record<BountySeverity, number>;
  bug_count: number;
  by_severity: Record<BountySeverity, number>;
  max_points: number;
  file_count?: number;
  stats: { reports: number; valid: number; hunters: number; found_by_you: number };
}

export interface HostedProgram {
  id: string;
  kind: "company" | "open_source";
  company: string;
  /** a brand mark, or null — then the page shows the company's initial */
  logo: string | null;
  title: string;
  tagline: string;
  summary: string;
  owner_id: string;
  owner_name: string;
  repo_url: string | null;
  website: string | null;
  scope: string[];
  out_of_scope: string[];
  rewards: Record<BountySeverity, number>;
  plan: string;
  plan_name: string;
  points_pool: number;
  points_left: number;
  pays_points: boolean;
  status: "awaiting_payment" | "open" | "paused" | "closed";
  created_at: string;
  stats: { reports: number; valid: number; hunters: number };
}

export interface BountyReport {
  id: string;
  program_id: string;
  learner_id: string;
  title: string;
  category: string;
  severity: string;
  final_severity: string | null;
  file: string | null;
  line: number | null;
  status: ReportStatus;
  points: number;
  triage_note: string | null;
  created_at: string;
  triaged_at: string | null;
  description?: string;
  steps?: string | null;
  impact?: string | null;
  fix?: string | null;
  program_title?: string;
  company?: string;
  reporter_name?: string;
}

export interface FoundBug {
  id: string;
  title: string;
  severity: BountySeverity;
  category: string;
  file: string;
  line: number;
  explanation: string;
  fix: string;
  points: number;
}

export interface BountyPlan {
  id: "community" | "starter" | "growth";
  name: string;
  price_inr: number;
  points_pool: number;
  perks: string[];
}

export interface BountyBoardRow {
  learner_id: string;
  name: string;
  points: number;
  valid: number;
  reports?: number;
  inr?: string;
  signal?: number;
}

export interface BountyList {
  platform: PlatformProgram[];
  company: HostedProgram[];
  open_source: HostedProgram[];
  stats: { reports: number; valid: number; hunters: number; points_paid: number; programs: number; inr_paid: string };
  board: BountyBoardRow[];
  plans: BountyPlan[];
  categories: BountyCategory[];
  severities: BountySeverityInfo[];
  payments_enabled: boolean;
  payments_mode: string | null;
}

interface ProgramCommon {
  board: BountyBoardRow[];
  checklist: string[];
  categories: BountyCategory[];
  severities: BountySeverityInfo[];
  my_reports: BountyReport[];
  reports_left_today: number;
}

export type PlatformProgramDetail = PlatformProgram &
  ProgramCommon & {
    files: { path: string; language: string; content: string; lines: number }[];
    found: FoundBug[];
    nudges_taken: number;
    is_owner: false;
  };

export type HostedProgramDetail = HostedProgram &
  ProgramCommon & {
    is_owner: boolean;
    queue: BountyReport[];
    payments: { id: string; status: string; amount: string; checkout_url: string | null; created_at: string }[];
    payments_enabled: boolean;
  };

export type ProgramDetail = PlatformProgramDetail | HostedProgramDetail;

export type ExplainerVisual =
  | { kind: "title"; heading: string; sub: string }
  | { kind: "flow"; steps: { icon: string; label: string }[] }
  | { kind: "scope"; inside: string[]; outside: string[] }
  | { kind: "recon"; tree: string[]; focus: string; to: string }
  | { kind: "classes"; items: { icon: string; label: string; ask: string }[] }
  | { kind: "prove"; code: string[]; line: number; note: string }
  | { kind: "report"; fields: { label: string; value: string }[] }
  | { kind: "reward"; rows: { severity: string; points: number; color: string }[]; rate: string }
  | { kind: "rules"; rules: { icon: string; text: string }[] }
  | { kind: "outro"; cta: string[] };

export interface ExplainerScene {
  id: string;
  chapter: string;
  say: string;
  visual: ExplainerVisual;
}

export interface FileReportResult {
  report: BountyReport;
  outcome: ReportStatus;
  message: string;
  bug?: FoundBug;
  remaining?: number;
}

export interface PaymentsStatus {
  enabled: boolean;
  ready: boolean;
  message: string;
  mode: string | null;
  webhook: boolean;
  /** dodo = Dodo's hosted checkout; demo = the in-app demo checkout (nothing is charged) */
  checkout?: "dodo" | "demo";
}

export interface DemoCheckout {
  payment: string;
  program_id: string;
  plan: string;
  plan_name: string;
  amount_inr: number;
}

export interface AdminRedemption extends Redemption {
  learner_id: string;
  upi_id: string | null;
  shipping: Shipping | null;
  next: RedemptionStatus[];
}

/** Admin calls carry the token saved on the /admin page (only needed when LAYERFLOW_ADMIN_TOKEN is set). */
function adminToken(): string {
  try {
    return localStorage.getItem("layerflow-admin-token") ?? "";
  } catch {
    return "";
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers["content-type"] = "application/json";
  if (url.startsWith("/api/admin/")) headers["x-admin-token"] = adminToken();
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  health: () => req<{ ok: boolean; llm: string | null; ai?: string | null; challenges: number; sandbox: { warm: number; live: number } | null }>("GET", "/api/health"),
  /** all = also the Bug Factory (training range) programs */
  challenges: (all = false) => req<{ challenges: ChallengeSummary[]; judge_challenges: string[]; concept_labels: Record<string, string> }>("GET", `/api/challenges${all ? "?all=1" : ""}`),
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
  repoReport: (id: string) => req<RepoReport | SiteReport>("GET", `/api/repo/reports/${encodeURIComponent(id)}`),
  analyzeSite: (body: { url: string; learner_id?: string | null }) => req<SiteReport>("POST", "/api/site/analyze", { ...body, learner_id: body.learner_id ?? undefined }),

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

  // ── Rewards ──
  rewards: (id: string) => req<RewardsView>("GET", `/api/rewards/${encodeURIComponent(id)}`),
  rewardsSummary: (id: string) => req<RewardsSummary>("GET", `/api/rewards/${encodeURIComponent(id)}/summary`),
  setPin: (learner_id: string, pin: string) => req<{ ok: boolean }>("POST", "/api/rewards/pin", { learner_id, pin }),
  redeem: (b: { learner_id: string; pin: string; kind: "cash" | "goodie"; points?: number; upi_id?: string; item_id?: string; size?: string; shipping?: Shipping }) =>
    req<{ redemption: Redemption; message: string; payout?: { mode: "demo" | "manual"; ref: string | null } }>("POST", "/api/rewards/redeem", b),
  cancelRedemption: (id: string, learner_id: string, pin: string) => req<{ redemption: Redemption }>("POST", `/api/rewards/redemptions/${encodeURIComponent(id)}/cancel`, { learner_id, pin }),

  // ── Bug Bounty ──
  bountyPrograms: (viewer?: string | null) => req<BountyList>("GET", `/api/bounty/programs${viewer ? `?viewer=${encodeURIComponent(viewer)}` : ""}`),
  bountyProgram: (id: string, viewer?: string | null) => req<ProgramDetail>("GET", `/api/bounty/programs/${encodeURIComponent(id)}${viewer ? `?viewer=${encodeURIComponent(viewer)}` : ""}`),
  bountyReports: (learner_id: string) => req<{ reports: BountyReport[] }>("GET", `/api/bounty/reports?learner_id=${encodeURIComponent(learner_id)}`),
  fileReport: (b: { program_id: string; learner_id: string; title: string; category: string; severity: BountySeverity; file?: string | null; line?: number | null; description: string; steps?: string | null; impact?: string | null; fix?: string | null }) =>
    req<FileReportResult>("POST", "/api/bounty/reports", b),
  bountyNudge: (learner_id: string, program_id: string) => req<{ nudge: string; severity: BountySeverity | null; cost: number; message?: string; all_found: boolean }>("POST", "/api/bounty/nudge", { learner_id, program_id }),
  createProgram: (b: {
    owner_id: string;
    pin: string;
    kind: "company" | "open_source";
    company: string;
    title: string;
    summary: string;
    repo_url?: string | null;
    website?: string | null;
    scope: string[];
    out_of_scope: string[];
    rewards: Record<BountySeverity, number>;
    plan: BountyPlan["id"];
    return_base: string;
  }) => req<{ id: string; status: "open" | "awaiting_payment"; checkout_url: string | null; demo_checkout?: DemoCheckout | null }>("POST", "/api/bounty/programs", b),
  programCheckout: (id: string, owner_id: string, pin: string, return_base: string) => req<{ payment: string; checkout_url: string | null; demo_checkout?: DemoCheckout | null }>("POST", `/api/bounty/programs/${encodeURIComponent(id)}/checkout`, { owner_id, pin, return_base }),
  completeDemoPayment: (payment: string, owner_id: string) => req<{ status: "succeeded" | "failed"; payment_id: string | null }>("POST", "/api/payments/demo/complete", { payment, owner_id }),
  triageReport: (id: string, b: { actor_id: string; pin: string; status: "valid" | "duplicate" | "needs_info" | "invalid"; final_severity?: BountySeverity; note?: string }) =>
    req<{ report: BountyReport }>("POST", `/api/bounty/reports/${encodeURIComponent(id)}/triage`, b),
  explainer: (lang = "en") => req<{ lang: string; scenes: ExplainerScene[] }>("GET", `/api/bounty/explainer?lang=${encodeURIComponent(lang)}`),

  // ── payments (Dodo) ──
  paymentsStatus: () => req<PaymentsStatus>("GET", "/api/payments/status"),
  syncPayment: (payment: string, payment_id: string) => req<{ status: string }>("POST", "/api/payments/sync", { payment, payment_id }),

  // ── admin desk ──
  adminStatus: () => req<{ ok: boolean; open: boolean; payouts: "demo" | "manual"; payments: PaymentsStatus }>("GET", "/api/admin/status"),
  adminRedemptions: (status?: string) => req<{ redemptions: AdminRedemption[] }>("GET", `/api/admin/redemptions${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminUpdateRedemption: (id: string, b: { status: RedemptionStatus; note?: string; payout_ref?: string }) => req<Redemption>("POST", `/api/admin/redemptions/${encodeURIComponent(id)}`, b),
  adminReports: () => req<{ reports: BountyReport[] }>("GET", "/api/admin/reports"),
  adminTriage: (id: string, b: { status: "valid" | "duplicate" | "needs_info" | "invalid"; final_severity?: BountySeverity; note?: string }) =>
    req<{ report: BountyReport }>("POST", `/api/admin/reports/${encodeURIComponent(id)}/triage`, b),
};

/** Tell the header's streak/points chip to refresh (after a pass, a confirmed bug, a redemption). */
export function refreshPoints(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("layerflow-points-refresh"));
}

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
