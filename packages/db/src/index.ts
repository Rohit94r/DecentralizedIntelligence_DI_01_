/**
 * @layerflow/db — the ONLY module that touches SQL.
 *
 * node:sqlite (built into Node ≥ 22.13): zero install, no native build, one
 * file, WAL mode so the judges' parallel submissions and readers never block
 * each other, busy_timeout so SQLITE_BUSY never surfaces. node:sqlite is
 * synchronous, so within the API process every write is naturally serialised.
 *
 * Write discipline: one transaction per submission (submission row + every
 * test_results row + mastery update + ledger entries), committed BEFORE the
 * HTTP response is sent — a judge refreshing mid-slot never sees a ghost.
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  bugFactoryChallenges,
  type Concept,
  type HistoryItem,
  type LadderKey,
  type LedgerEntry,
  type LineMap,
  type MasteryDelta,
  type MasteryRow,
  type MistakeTag,
  type Store,
  type SubmissionRecord,
} from "@layerflow/core";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface SubmissionRow {
  id: string;
  learner_id: string;
  challenge_id: string;
  code: string;
  passed: boolean;
  tags: MistakeTag[];
  explanation: string;
  hints_used: number;
  ladder_key: LadderKey;
  analysis: LineMap | null;
  duration_ms: number;
  created_at: string;
}

export interface LedgerRow {
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

type Row = Record<string, unknown>;

export interface Profile {
  id: string;
  display_name: string;
  role: "student" | "teacher" | "mentor_ai";
  avatar: string | null;
  bio: string | null;
  created_at: string;
}

interface Author {
  author_id: string;
  author_name: string;
  author_role: Profile["role"];
  author_avatar: string | null;
}

export interface PostRow extends Author {
  id: number;
  kind: "question" | "discussion" | "tip" | "showcase";
  title: string;
  body: string;
  challenge_id: string | null;
  spoiler: boolean;
  accepted_reply_id: number | null;
  created_at: string;
  reply_count: number;
  teacher_replies: number;
  score: number;
  my_vote: number;
}

export interface ReplyRow extends Author {
  id: number;
  post_id: number;
  body: string;
  spoiler: boolean;
  ai: boolean;
  created_at: string;
  score: number;
  my_vote: number;
}

export type PointsKind = "streak_day" | "bounty" | "redeem" | "refund" | "adjust";

export interface PointsRow {
  id: number;
  delta: number;
  kind: PointsKind;
  ref: string;
  note: string;
  created_at: string;
}

export type RedemptionStatus = "requested" | "approved" | "paid" | "shipped" | "delivered" | "rejected" | "cancelled";

export interface RedemptionRow {
  id: string;
  learner_id: string;
  kind: "cash" | "goodie";
  item_id: string | null;
  size: string | null;
  points: number;
  amount_paise: number;
  upi_id: string | null;
  shipping: { name: string; phone: string; address: string; city: string; pincode: string } | null;
  status: RedemptionStatus;
  note: string | null;
  payout_ref: string | null;
  created_at: string;
  updated_at: string;
}

export type ProgramStatus = "awaiting_payment" | "open" | "paused" | "closed";

export interface ProgramRow {
  id: string;
  owner_id: string;
  kind: "company" | "open_source";
  company: string;
  title: string;
  summary: string;
  repo_url: string | null;
  website: string | null;
  scope: string[];
  out_of_scope: string[];
  rewards: Record<"critical" | "high" | "medium" | "low", number>;
  plan: string;
  points_pool: number;
  points_paid: number;
  status: ProgramStatus;
  created_at: string;
}

export type ReportStatus = "triage" | "valid" | "duplicate" | "needs_info" | "invalid";

export interface ReportRow {
  id: string;
  program_id: string;
  learner_id: string;
  title: string;
  category: string;
  severity: string;
  file: string | null;
  line: number | null;
  description: string;
  steps: string | null;
  impact: string | null;
  fix: string | null;
  status: ReportStatus;
  bug_id: string | null;
  final_severity: string | null;
  points: number;
  triage_note: string | null;
  created_at: string;
  triaged_at: string | null;
}

export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled";

export interface PaymentRow {
  id: string;
  provider: string;
  purpose: "bounty_plan" | "subscription";
  ref: string;
  sku: string;
  /** smallest unit of `currency` — paise for INR, cents for USD */
  amount_paise: number;
  currency: string;
  session_id: string | null;
  payment_id: string | null;
  checkout_url: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

function httpError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

const json = <T>(v: unknown, fallback: T): T => {
  try {
    return v == null ? fallback : (JSON.parse(String(v)) as T);
  } catch {
    return fallback;
  }
};

function toRedemption(r: Row): RedemptionRow {
  return {
    id: String(r.id),
    learner_id: String(r.learner_id),
    kind: r.kind as RedemptionRow["kind"],
    item_id: (r.item_id as string) ?? null,
    size: (r.size as string) ?? null,
    points: Number(r.points),
    amount_paise: Number(r.amount_paise),
    upi_id: (r.upi_id as string) ?? null,
    shipping: json(r.shipping, null),
    status: r.status as RedemptionStatus,
    note: (r.note as string) ?? null,
    payout_ref: (r.payout_ref as string) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function toProgram(r: Row): ProgramRow {
  return {
    id: String(r.id),
    owner_id: String(r.owner_id),
    kind: r.kind as ProgramRow["kind"],
    company: String(r.company),
    title: String(r.title),
    summary: String(r.summary),
    repo_url: (r.repo_url as string) ?? null,
    website: (r.website as string) ?? null,
    scope: json(r.scope, []),
    out_of_scope: json(r.out_of_scope, []),
    rewards: json(r.rewards, { critical: 0, high: 0, medium: 0, low: 0 }),
    plan: String(r.plan),
    points_pool: Number(r.points_pool),
    points_paid: Number(r.points_paid),
    status: r.status as ProgramStatus,
    created_at: String(r.created_at),
  };
}

function toReport(r: Row): ReportRow {
  return {
    id: String(r.id),
    program_id: String(r.program_id),
    learner_id: String(r.learner_id),
    title: String(r.title),
    category: String(r.category),
    severity: String(r.severity),
    file: (r.file as string) ?? null,
    line: r.line == null ? null : Number(r.line),
    description: String(r.description),
    steps: (r.steps as string) ?? null,
    impact: (r.impact as string) ?? null,
    fix: (r.fix as string) ?? null,
    status: r.status as ReportStatus,
    bug_id: (r.bug_id as string) ?? null,
    final_severity: (r.final_severity as string) ?? null,
    points: Number(r.points ?? 0),
    triage_note: (r.triage_note as string) ?? null,
    created_at: String(r.created_at),
    triaged_at: (r.triaged_at as string) ?? null,
  };
}

function toPayment(r: Row): PaymentRow {
  return {
    id: String(r.id),
    provider: String(r.provider),
    purpose: r.purpose as PaymentRow["purpose"],
    ref: String(r.ref),
    sku: String(r.sku),
    amount_paise: Number(r.amount_paise),
    currency: String(r.currency ?? "INR"),
    session_id: (r.session_id as string) ?? null,
    payment_id: (r.payment_id as string) ?? null,
    checkout_url: (r.checkout_url as string) ?? null,
    status: r.status as PaymentStatus,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export interface SubscriptionRow {
  learner_id: string;
  plan: "pro";
  status: "active" | "cancelled" | "expired";
  provider: "razorpay" | "demo" | "dodo";
  currency: string;
  amount: number;
  subscription_id: string | null;
  payment_id: string | null;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

function toSubscription(r: Row): SubscriptionRow {
  return {
    learner_id: String(r.learner_id),
    plan: "pro",
    status: r.status as SubscriptionRow["status"],
    provider: r.provider as SubscriptionRow["provider"],
    currency: String(r.currency),
    amount: Number(r.amount),
    subscription_id: (r.subscription_id as string) ?? null,
    payment_id: (r.payment_id as string) ?? null,
    current_period_end: String(r.current_period_end),
    cancel_at_period_end: Number(r.cancel_at_period_end) === 1,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  organisation: string;
  kind: "college" | "company" | "other";
  seats: number | null;
  message: string | null;
  learner_id: string | null;
  status: "new" | "contacted" | "won" | "lost";
  created_at: string;
}

function toProfile(r: Row): Profile {
  return {
    id: String(r.id),
    display_name: String(r.display_name),
    role: r.role as Profile["role"],
    avatar: (r.avatar as string) ?? null,
    bio: (r.bio as string) ?? null,
    created_at: String(r.created_at),
  };
}

function author(r: Row): Author {
  return {
    author_id: String(r.author_id),
    author_name: (r.display_name as string) ?? String(r.author_id),
    author_role: ((r.role as string) ?? "student") as Profile["role"],
    author_avatar: (r.avatar as string) ?? null,
  };
}

function toPost(r: Row): PostRow {
  return {
    ...author(r),
    id: Number(r.id),
    kind: r.kind as PostRow["kind"],
    title: String(r.title),
    body: String(r.body),
    challenge_id: (r.challenge_id as string) ?? null,
    spoiler: !!r.spoiler,
    accepted_reply_id: r.accepted_reply_id == null ? null : Number(r.accepted_reply_id),
    created_at: String(r.created_at),
    reply_count: Number(r.reply_count ?? 0),
    teacher_replies: Number(r.teacher_replies ?? 0),
    score: Number(r.score ?? 0),
    my_vote: Number(r.my_vote ?? 0),
  };
}

function toReply(r: Row): ReplyRow {
  return {
    ...author(r),
    id: Number(r.id),
    post_id: Number(r.post_id),
    body: String(r.body),
    spoiler: !!r.spoiler,
    ai: !!r.ai,
    created_at: String(r.created_at),
    score: Number(r.score ?? 0),
    my_vote: Number(r.my_vote ?? 0),
  };
}

export class LayerflowStore implements Store {
  readonly db: DatabaseSync;

  constructor(readonly file: string) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
    this.db.exec(readFileSync(path.join(here, "schema.sql"), "utf8"));
    this.migrate();
    this.seedBugTemplates();
  }

  /**
   * Older databases had narrower CHECK constraints: repo_reports without the
   * 'site' source, payments without 'subscription' (and no currency). SQLite
   * can't change a CHECK, so the table is rebuilt once, keeping every row.
   */
  private migrate(): void {
    const schema = readFileSync(path.join(here, "schema.sql"), "utf8");
    const rebuild = (table: string, marker: string, columns: string) => {
      const row = this.db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql?: string } | undefined;
      if (!row?.sql || row.sql.includes(marker)) return;
      this.tx(() => {
        this.db.exec(`ALTER TABLE ${table} RENAME TO ${table}_old`);
        this.db.exec(schema);
        this.db.exec(`INSERT INTO ${table} (${columns}) SELECT ${columns} FROM ${table}_old`);
        this.db.exec(`DROP TABLE ${table}_old`);
        this.db.exec(schema); // indexes went with the old table
      });
    };
    rebuild("repo_reports", "'site'", "id, learner_id, repo, source, score, grade, report, created_at");
    rebuild("payments", "'subscription'", "id, provider, purpose, ref, sku, amount_paise, session_id, payment_id, checkout_url, status, created_at, updated_at");
    rebuild("subscriptions", "'razorpay'", "learner_id, plan, status, provider, currency, amount, subscription_id, payment_id, current_period_end, cancel_at_period_end, created_at, updated_at");
  }

  private tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  private seedBugTemplates(): void {
    const ins = this.db.prepare(
      "INSERT OR REPLACE INTO bug_seeds (challenge_id, mistake_tag, buggy_code, culprit_line, hint, difficulty) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const c of bugFactoryChallenges()) {
      ins.run(c.id, c.bugFactory!.tag, c.starter, c.bugFactory!.culpritLine, c.bugFactory!.lesson, 1);
    }
  }

  /* ── Store port (used by the engine) ── */

  ensureLearner(id: string, at = new Date().toISOString()): void {
    this.db.prepare("INSERT OR IGNORE INTO learners (id, created_at) VALUES (?, ?)").run(id, at);
  }

  nextSubmissionId(): string {
    const r = this.db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM submissions").get() as { n: number };
    return `s_${String(r.n).padStart(4, "0")}`;
  }

  history(learnerId: string): HistoryItem[] {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.challenge_id, s.created_at, s.mistake_tags, s.passed,
                (SELECT COUNT(*) FROM hints h WHERE h.submission_id = s.id) AS hints
           FROM submissions s WHERE s.learner_id = ? ORDER BY s.created_at, s.seq`,
      )
      .all(learnerId) as Row[];
    return rows.map((r) => ({
      submission_id: String(r.id),
      challenge_id: String(r.challenge_id),
      at: String(r.created_at),
      tags: JSON.parse(String(r.mistake_tags)),
      passed: !!r.passed,
      hints_used: Number(r.hints),
    }));
  }

  mastery(learnerId: string): MasteryRow[] {
    return (this.db.prepare("SELECT concept, alpha, beta FROM mastery WHERE learner_id = ?").all(learnerId) as Row[]).map((r) => ({
      concept: r.concept as Concept,
      alpha: Number(r.alpha),
      beta: Number(r.beta),
    }));
  }

  hintsSinceLastPass(learnerId: string, challengeId: string): number {
    const last = this.db
      .prepare("SELECT MAX(created_at) AS t FROM submissions WHERE learner_id = ? AND challenge_id = ? AND passed = 1")
      .get(learnerId, challengeId) as { t: string | null };
    const r = this.db
      .prepare("SELECT COUNT(*) AS n FROM hints WHERE learner_id = ? AND challenge_id = ? AND created_at > ?")
      .get(learnerId, challengeId, last.t ?? "") as { n: number };
    return Number(r.n);
  }

  private applyMastery(learnerId: string, deltas: MasteryDelta[]): void {
    const up = this.db.prepare(
      `INSERT INTO mastery (learner_id, concept, alpha, beta) VALUES (?, ?, 1 + ?, 1 + ?)
       ON CONFLICT (learner_id, concept) DO UPDATE SET alpha = alpha + excluded.alpha - 1, beta = beta + excluded.beta - 1`,
    );
    for (const d of deltas) up.run(learnerId, d.concept, d.dAlpha, d.dBeta);
  }

  private insertLedger(learnerId: string, submissionId: string, entries: LedgerEntry[], at: string): void {
    const ins = this.db.prepare(
      "INSERT INTO ledger (ts, kind, learner_id, submission_id, prompt, response, model, rejected_for_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const e of entries) ins.run(at, e.kind, learnerId, submissionId, e.prompt, e.response, e.model, e.rejected_for_code ? 1 : 0);
  }

  saveSubmission(rec: SubmissionRecord): void {
    this.tx(() => {
      this.ensureLearner(rec.learner_id, rec.created_at);
      const seq = Number(rec.id.replace(/\D/g, ""));
      this.db
        .prepare(
          `INSERT INTO submissions (id, seq, learner_id, challenge_id, code, passed, mistake_tags, explanation, hints_used, ladder_key, analysis, duration_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          rec.id,
          seq,
          rec.learner_id,
          rec.challenge_id,
          rec.code,
          rec.passed ? 1 : 0,
          JSON.stringify(rec.tags),
          rec.explanation,
          rec.hints_used,
          rec.ladder_key,
          rec.analysis ? JSON.stringify(rec.analysis) : null,
          rec.duration_ms,
          rec.created_at,
        );
      const ins = this.db.prepare("INSERT INTO test_results (submission_id, kind, test_no, outcome, detail, got) VALUES (?, ?, ?, ?, ?, ?)");
      for (const r of rec.results) ins.run(rec.id, r.kind, r.test, r.outcome, r.detail, r.kind === "hidden" ? null : r.got);
      this.applyMastery(rec.learner_id, rec.masteryDeltas);
      this.insertLedger(rec.learner_id, rec.id, rec.ledger, rec.created_at);
    });
  }

  /* ── hints ── */

  maxRung(learnerId: string, challengeId: string, ladderKey: string): number {
    const r = this.db
      .prepare("SELECT COALESCE(MAX(rung), 0) AS r FROM hints WHERE learner_id = ? AND challenge_id = ? AND ladder_key = ?")
      .get(learnerId, challengeId, ladderKey) as { r: number };
    return Number(r.r);
  }

  hintsFor(submissionId: string): { idx: number; rung: number; text: string; created_at: string; asked_for_answer: boolean }[] {
    return (this.db.prepare("SELECT idx, rung, text, created_at, asked_for_answer FROM hints WHERE submission_id = ? ORDER BY idx").all(submissionId) as Row[]).map(
      (r) => ({ idx: Number(r.idx), rung: Number(r.rung), text: String(r.text), created_at: String(r.created_at), asked_for_answer: !!r.asked_for_answer }),
    );
  }

  saveHint(h: {
    submission_id: string;
    learner_id: string;
    challenge_id: string;
    ladder_key: string;
    rung: number;
    text: string;
    asked: boolean;
    at?: string;
    ledger: LedgerEntry[];
    masteryDeltas: MasteryDelta[];
  }): number {
    const at = h.at ?? new Date().toISOString();
    return this.tx(() => {
      const r = this.db.prepare("SELECT COALESCE(MAX(idx), 0) + 1 AS n FROM hints WHERE submission_id = ?").get(h.submission_id) as { n: number };
      const idx = Number(r.n);
      this.db
        .prepare(
          "INSERT INTO hints (submission_id, idx, rung, learner_id, challenge_id, ladder_key, text, asked_for_answer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(h.submission_id, idx, h.rung, h.learner_id, h.challenge_id, h.ladder_key, h.text, h.asked ? 1 : 0, at);
      this.applyMastery(h.learner_id, h.masteryDeltas);
      this.insertLedger(h.learner_id, h.submission_id, h.ledger, at);
      return idx;
    });
  }

  /* ── reads for the UI ── */

  getSubmission(id: string): (SubmissionRow & { results: { kind: string; test: number; outcome: string; detail: string | null; got: string | null }[] }) | null {
    const r = this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(id) as Row | undefined;
    if (!r) return null;
    const results = (this.db.prepare("SELECT kind, test_no, outcome, detail, got FROM test_results WHERE submission_id = ? ORDER BY kind DESC, test_no").all(id) as Row[]).map(
      (x) => ({ kind: String(x.kind), test: Number(x.test_no), outcome: String(x.outcome), detail: (x.detail as string) ?? null, got: (x.got as string) ?? null }),
    );
    return { ...this.toSubmission(r), results };
  }

  private toSubmission(r: Row): SubmissionRow {
    return {
      id: String(r.id),
      learner_id: String(r.learner_id),
      challenge_id: String(r.challenge_id),
      code: String(r.code),
      passed: !!r.passed,
      tags: JSON.parse(String(r.mistake_tags)),
      explanation: String(r.explanation),
      hints_used: Number(r.hints_used),
      ladder_key: String(r.ladder_key) as LadderKey,
      analysis: r.analysis ? JSON.parse(String(r.analysis)) : null,
      duration_ms: Number(r.duration_ms ?? 0),
      created_at: String(r.created_at),
    };
  }

  recentSubmissions(limit = 20): (SubmissionRow & { hints: number })[] {
    return (
      this.db
        .prepare(`SELECT s.*, (SELECT COUNT(*) FROM hints h WHERE h.submission_id = s.id) AS hints FROM submissions s ORDER BY s.created_at DESC, s.seq DESC LIMIT ?`)
        .all(limit) as Row[]
    ).map((r) => ({ ...this.toSubmission(r), hints: Number(r.hints) }));
  }

  learners(): { id: string; created_at: string; submissions: number; passes: number; last_at: string | null }[] {
    return (
      this.db
        .prepare(
          `SELECT l.id, l.created_at, COUNT(s.id) AS n, COALESCE(SUM(s.passed), 0) AS p, MAX(s.created_at) AS last
             FROM learners l LEFT JOIN submissions s ON s.learner_id = l.id GROUP BY l.id ORDER BY last DESC`,
        )
        .all() as Row[]
    ).map((r) => ({ id: String(r.id), created_at: String(r.created_at), submissions: Number(r.n), passes: Number(r.p), last_at: (r.last as string) ?? null }));
  }

  ledger(f: { learner_id?: string; submission_id?: string; kind?: string; limit?: number } = {}): LedgerRow[] {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (f.learner_id) (where.push("learner_id = ?"), args.push(f.learner_id));
    if (f.submission_id) (where.push("submission_id = ?"), args.push(f.submission_id));
    if (f.kind) (where.push("kind = ?"), args.push(f.kind));
    args.push(Math.min(f.limit ?? 500, 2000));
    const rows = this.db
      .prepare(`SELECT * FROM ledger ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`)
      .all(...args) as Row[];
    return rows.map((r) => ({
      id: Number(r.id),
      ts: String(r.ts),
      kind: String(r.kind),
      learner_id: (r.learner_id as string) ?? null,
      submission_id: (r.submission_id as string) ?? null,
      prompt: String(r.prompt),
      response: String(r.response),
      model: (r.model as string) ?? null,
      rejected_for_code: !!r.rejected_for_code,
    }));
  }

  ledgerStats(): { total: number; hints: number; explanations: number; rejected: number; llm: number } {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(kind = 'hint') AS hints, SUM(kind = 'explanation') AS explanations,
                SUM(rejected_for_code) AS rejected, SUM(model IS NOT NULL AND model NOT LIKE 'deterministic%') AS llm FROM ledger`,
      )
      .get() as Row;
    return {
      total: Number(r.total ?? 0),
      hints: Number(r.hints ?? 0),
      explanations: Number(r.explanations ?? 0),
      rejected: Number(r.rejected ?? 0),
      llm: Number(r.llm ?? 0),
    };
  }

  stats(): { submissions: number; passes: number; learners: number; hints: number; rejected: number; contained: number } {
    const s = this.db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(passed), 0) AS p FROM submissions").get() as Row;
    const l = this.db.prepare("SELECT COUNT(*) AS n FROM learners").get() as Row;
    const h = this.db.prepare("SELECT COUNT(*) AS n FROM hints").get() as Row;
    const rj = this.db.prepare("SELECT COALESCE(SUM(rejected_for_code), 0) AS n FROM ledger").get() as Row;
    const c = this.db.prepare("SELECT COUNT(DISTINCT submission_id) AS n FROM test_results WHERE detail IS NOT NULL AND detail != 'input changed'").get() as Row;
    return { submissions: Number(s.n), passes: Number(s.p), learners: Number(l.n), hints: Number(h.n), rejected: Number(rj.n), contained: Number(c.n) };
  }

  activity(learnerId?: string): { day: string; n: number }[] {
    const rows = (learnerId
      ? this.db.prepare("SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM submissions WHERE learner_id = ? GROUP BY day ORDER BY day").all(learnerId)
      : this.db.prepare("SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM submissions GROUP BY day ORDER BY day").all()) as Row[];
    return rows.map((r) => ({ day: String(r.day), n: Number(r.n) }));
  }

  /* ── Bug Factory ── */

  recordFind(learnerId: string, challengeId: string, line: number, correct: boolean): void {
    this.ensureLearner(learnerId);
    this.db
      .prepare("INSERT INTO bug_finds (learner_id, challenge_id, line, correct, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(learnerId, challengeId, line, correct ? 1 : 0, new Date().toISOString());
  }

  finds(learnerId: string, challengeId: string): { line: number; correct: boolean }[] {
    return (this.db.prepare("SELECT line, correct FROM bug_finds WHERE learner_id = ? AND challenge_id = ? ORDER BY id").all(learnerId, challengeId) as Row[]).map(
      (r) => ({ line: Number(r.line), correct: !!r.correct }),
    );
  }

  bugSeeds(): { challenge_id: string; mistake_tag: string; culprit_line: number; hint: string }[] {
    return (this.db.prepare("SELECT challenge_id, mistake_tag, culprit_line, hint FROM bug_seeds ORDER BY id").all() as Row[]).map((r) => ({
      challenge_id: String(r.challenge_id),
      mistake_tag: String(r.mistake_tag),
      culprit_line: Number(r.culprit_line),
      hint: String(r.hint),
    }));
  }

  /* ── mentor + chat ── */

  hintTimes(learnerId: string): { challenge_id: string; created_at: string }[] {
    return (this.db.prepare("SELECT challenge_id, created_at FROM hints WHERE learner_id = ? ORDER BY created_at").all(learnerId) as Row[]).map((r) => ({
      challenge_id: String(r.challenge_id),
      created_at: String(r.created_at),
    }));
  }

  latestSubmission(learnerId: string, challengeId: string): ReturnType<LayerflowStore["getSubmission"]> {
    const r = this.db
      .prepare("SELECT id FROM submissions WHERE learner_id = ? AND challenge_id = ? ORDER BY created_at DESC, seq DESC LIMIT 1")
      .get(learnerId, challengeId) as { id: string } | undefined;
    return r ? this.getSubmission(r.id) : null;
  }

  /** A ledger row that isn't tied to a submission (chat, mentor session, repo review). */
  logEvent(e: { kind: "chat" | "mentor" | "repo" | "answer"; learner_id: string | null; prompt: string; response: string; model: string | null; rejected: boolean }): void {
    this.db
      .prepare("INSERT INTO ledger (ts, kind, learner_id, submission_id, prompt, response, model, rejected_for_code) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)")
      .run(new Date().toISOString(), e.kind, e.learner_id, e.prompt.slice(0, 4000), e.response.slice(0, 4000), e.model, e.rejected ? 1 : 0);
  }

  /* ── community ── */

  upsertProfile(p: { id: string; display_name: string; role?: "student" | "teacher" | "mentor_ai"; avatar?: string | null; bio?: string | null; at?: string }): void {
    this.db
      .prepare(
        `INSERT INTO profiles (id, display_name, role, avatar, bio, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name, role = excluded.role,
           avatar = COALESCE(excluded.avatar, profiles.avatar), bio = COALESCE(excluded.bio, profiles.bio)`,
      )
      .run(p.id, p.display_name, p.role ?? "student", p.avatar ?? null, p.bio ?? null, p.at ?? new Date().toISOString());
  }

  profile(id: string): Profile | null {
    const r = this.db.prepare("SELECT * FROM profiles WHERE id = ?").get(id) as Row | undefined;
    return r ? toProfile(r) : null;
  }

  profiles(role?: string): Profile[] {
    const rows = (role ? this.db.prepare("SELECT * FROM profiles WHERE role = ? ORDER BY created_at").all(role) : this.db.prepare("SELECT * FROM profiles ORDER BY created_at").all()) as Row[];
    return rows.map(toProfile);
  }

  createPost(p: { author_id: string; kind: string; title: string; body: string; challenge_id?: string | null; spoiler: boolean; at?: string }): number {
    const r = this.db
      .prepare("INSERT INTO posts (author_id, kind, title, body, challenge_id, spoiler, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(p.author_id, p.kind, p.title, p.body, p.challenge_id ?? null, p.spoiler ? 1 : 0, p.at ?? new Date().toISOString());
    return Number(r.lastInsertRowid);
  }

  addReply(r: { post_id: number; author_id: string; body: string; spoiler: boolean; ai?: boolean; at?: string }): number {
    const res = this.db
      .prepare("INSERT INTO replies (post_id, author_id, body, spoiler, ai, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(r.post_id, r.author_id, r.body, r.spoiler ? 1 : 0, r.ai ? 1 : 0, r.at ?? new Date().toISOString());
    return Number(res.lastInsertRowid);
  }

  acceptReply(postId: number, replyId: number | null): void {
    this.db.prepare("UPDATE posts SET accepted_reply_id = ? WHERE id = ?").run(replyId, postId);
  }

  vote(voter: string, target: "post" | "reply", id: number, value: 1 | -1 | 0): number {
    if (value === 0) this.db.prepare("DELETE FROM votes WHERE voter_id = ? AND target = ? AND target_id = ?").run(voter, target, id);
    else
      this.db
        .prepare("INSERT INTO votes (voter_id, target, target_id, value) VALUES (?, ?, ?, ?) ON CONFLICT (voter_id, target, target_id) DO UPDATE SET value = excluded.value")
        .run(voter, target, id, value);
    const r = this.db.prepare("SELECT COALESCE(SUM(value), 0) AS s FROM votes WHERE target = ? AND target_id = ?").get(target, id) as { s: number };
    return Number(r.s);
  }

  posts(f: { kind?: string; challenge_id?: string; author_id?: string; q?: string; viewer?: string; limit?: number } = {}): PostRow[] {
    const where: string[] = [];
    const args: (string | number)[] = [f.viewer ?? ""];
    if (f.kind) (where.push("p.kind = ?"), args.push(f.kind));
    if (f.challenge_id) (where.push("p.challenge_id = ?"), args.push(f.challenge_id));
    if (f.author_id) (where.push("p.author_id = ?"), args.push(f.author_id));
    if (f.q) (where.push("(p.title LIKE ? OR p.body LIKE ?)"), args.push(`%${f.q}%`, `%${f.q}%`));
    args.push(Math.min(f.limit ?? 50, 200));
    const rows = this.db
      .prepare(
        `SELECT p.*, pr.display_name, pr.role, pr.avatar,
                (SELECT COUNT(*) FROM replies r WHERE r.post_id = p.id) AS reply_count,
                (SELECT COUNT(*) FROM replies r JOIN profiles t ON t.id = r.author_id WHERE r.post_id = p.id AND t.role = 'teacher') AS teacher_replies,
                (SELECT COALESCE(SUM(value), 0) FROM votes v WHERE v.target = 'post' AND v.target_id = p.id) AS score,
                (SELECT value FROM votes v WHERE v.target = 'post' AND v.target_id = p.id AND v.voter_id = ?) AS my_vote
           FROM posts p LEFT JOIN profiles pr ON pr.id = p.author_id
          ${where.length ? "WHERE " + where.join(" AND ") : ""}
          ORDER BY p.created_at DESC LIMIT ?`,
      )
      .all(...args) as Row[];
    return rows.map(toPost);
  }

  post(id: number, viewer = ""): (PostRow & { replies: ReplyRow[] }) | null {
    const r = this.db
      .prepare(
        `SELECT p.*, pr.display_name, pr.role, pr.avatar,
                (SELECT COUNT(*) FROM replies r WHERE r.post_id = p.id) AS reply_count,
                (SELECT COUNT(*) FROM replies r JOIN profiles t ON t.id = r.author_id WHERE r.post_id = p.id AND t.role = 'teacher') AS teacher_replies,
                (SELECT COALESCE(SUM(value), 0) FROM votes v WHERE v.target = 'post' AND v.target_id = p.id) AS score,
                (SELECT value FROM votes v WHERE v.target = 'post' AND v.target_id = p.id AND v.voter_id = ?) AS my_vote
           FROM posts p LEFT JOIN profiles pr ON pr.id = p.author_id WHERE p.id = ?`,
      )
      .get(viewer, id) as Row | undefined;
    if (!r) return null;
    const replies = (
      this.db
        .prepare(
          `SELECT r.*, pr.display_name, pr.role, pr.avatar,
                  (SELECT COALESCE(SUM(value), 0) FROM votes v WHERE v.target = 'reply' AND v.target_id = r.id) AS score,
                  (SELECT value FROM votes v WHERE v.target = 'reply' AND v.target_id = r.id AND v.voter_id = ?) AS my_vote
             FROM replies r LEFT JOIN profiles pr ON pr.id = r.author_id WHERE r.post_id = ? ORDER BY r.created_at, r.id`,
        )
        .all(viewer, id) as Row[]
    ).map(toReply);
    return { ...toPost(r), replies };
  }

  /** Who replied to each of these posts (no bodies) — lets the feed show faces without opening every thread. */
  replyAuthorsFor(postIds: number[]): Map<number, { id: number; author_id: string; author_name: string; author_role: Profile["role"]; author_avatar: string | null; ai: boolean; score: number; created_at: string }[]> {
    const out = new Map<number, { id: number; author_id: string; author_name: string; author_role: Profile["role"]; author_avatar: string | null; ai: boolean; score: number; created_at: string }[]>();
    const ids = postIds.filter((n) => Number.isInteger(n)).slice(0, 500);
    if (!ids.length) return out;
    const rows = this.db
      .prepare(
        `SELECT r.id, r.post_id, r.author_id, r.ai, r.created_at, pr.display_name, pr.role, pr.avatar,
                (SELECT COALESCE(SUM(value), 0) FROM votes v WHERE v.target = 'reply' AND v.target_id = r.id) AS score
           FROM replies r LEFT JOIN profiles pr ON pr.id = r.author_id
          WHERE r.post_id IN (${ids.map(() => "?").join(",")}) ORDER BY r.created_at, r.id`,
      )
      .all(...ids) as Row[];
    for (const r of rows) {
      const list = out.get(Number(r.post_id)) ?? [];
      list.push({ id: Number(r.id), ...author(r), ai: !!r.ai, score: Number(r.score ?? 0), created_at: String(r.created_at) });
      out.set(Number(r.post_id), list);
    }
    return out;
  }

  communityStats(): { posts: number; replies: number; teachers: number; students: number; answered: number } {
    const g = (sql: string) => Number((this.db.prepare(sql).get() as { n: number }).n);
    return {
      posts: g("SELECT COUNT(*) AS n FROM posts"),
      replies: g("SELECT COUNT(*) AS n FROM replies"),
      teachers: g("SELECT COUNT(*) AS n FROM profiles WHERE role = 'teacher'"),
      students: g("SELECT COUNT(*) AS n FROM profiles WHERE role = 'student'"),
      answered: g("SELECT COUNT(*) AS n FROM posts WHERE accepted_reply_id IS NOT NULL OR id IN (SELECT post_id FROM replies r JOIN profiles t ON t.id = r.author_id WHERE t.role = 'teacher')"),
    };
  }

  /* ── Repo Analyse ── */

  saveRepoReport(r: { learner_id: string | null; repo: string; source: "github" | "local" | "site"; score: number; grade: string; report: unknown }): string {
    const n = (this.db.prepare("SELECT COUNT(*) AS n FROM repo_reports").get() as { n: number }).n;
    let id = `r_${String(Number(n) + 1).padStart(4, "0")}`;
    while (this.db.prepare("SELECT 1 FROM repo_reports WHERE id = ?").get(id)) id = `r_${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare("INSERT INTO repo_reports (id, learner_id, repo, source, score, grade, report, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, r.learner_id, r.repo, r.source, r.score, r.grade, JSON.stringify(r.report), new Date().toISOString());
    return id;
  }

  repoReports(learnerId?: string, limit = 20): { id: string; repo: string; source: string; score: number; grade: string; created_at: string; learner_id: string | null }[] {
    const rows = (learnerId
      ? this.db.prepare("SELECT id, repo, source, score, grade, created_at, learner_id FROM repo_reports WHERE learner_id = ? ORDER BY created_at DESC LIMIT ?").all(learnerId, limit)
      : this.db.prepare("SELECT id, repo, source, score, grade, created_at, learner_id FROM repo_reports ORDER BY created_at DESC LIMIT ?").all(limit)) as Row[];
    return rows.map((r) => ({ id: String(r.id), repo: String(r.repo), source: String(r.source), score: Number(r.score), grade: String(r.grade), created_at: String(r.created_at), learner_id: (r.learner_id as string) ?? null }));
  }

  repoReport(id: string): { id: string; created_at: string; report: unknown } | null {
    const r = this.db.prepare("SELECT id, created_at, report FROM repo_reports WHERE id = ?").get(id) as Row | undefined;
    return r ? { id: String(r.id), created_at: String(r.created_at), report: JSON.parse(String(r.report)) } : null;
  }

  /* ── ids ── */

  private nextId(table: "redemptions" | "bounty_programs" | "bounty_reports" | "payments", prefix: string): string {
    const n = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
    let id = `${prefix}_${String(n + 1).padStart(4, "0")}`;
    while (this.db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)) id = `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
    return id;
  }

  /* ── rewards: points ledger ── */

  /** Idempotent: the same (learner, kind, ref) is credited at most once. Returns whether it was new. */
  creditPoints(e: { learner_id: string; delta: number; kind: PointsKind; ref: string; note: string; at?: string }): boolean {
    const r = this.db
      .prepare("INSERT OR IGNORE INTO points_ledger (learner_id, delta, kind, ref, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(e.learner_id, e.delta, e.kind, e.ref, e.note, e.at ?? new Date().toISOString());
    return Number(r.changes) > 0;
  }

  pointsBalance(learnerId: string): number {
    return Number((this.db.prepare("SELECT COALESCE(SUM(delta), 0) AS n FROM points_ledger WHERE learner_id = ?").get(learnerId) as { n: number }).n);
  }

  pointsTotals(learnerId: string): { balance: number; earned: number; streak: number; bounty: number; redeemed: number } {
    const r = this.db
      .prepare(
        `SELECT COALESCE(SUM(delta), 0) AS balance,
                COALESCE(SUM(CASE WHEN kind = 'streak_day' THEN delta END), 0) AS streak,
                COALESCE(SUM(CASE WHEN kind = 'bounty' THEN delta END), 0) AS bounty,
                COALESCE(SUM(CASE WHEN kind = 'adjust' THEN delta END), 0) AS adjust,
                COALESCE(SUM(CASE WHEN kind IN ('redeem', 'refund') THEN delta END), 0) AS redeemed
           FROM points_ledger WHERE learner_id = ?`,
      )
      .get(learnerId) as Row;
    const streak = Number(r.streak);
    const bounty = Number(r.bounty);
    return { balance: Number(r.balance), earned: streak + bounty + Number(r.adjust), streak, bounty, redeemed: -Number(r.redeemed) };
  }

  pointsLedger(learnerId: string, limit = 40): PointsRow[] {
    return (this.db.prepare("SELECT * FROM points_ledger WHERE learner_id = ? ORDER BY created_at DESC, id DESC LIMIT ?").all(learnerId, limit) as Row[]).map((r) => ({
      id: Number(r.id),
      delta: Number(r.delta),
      kind: r.kind as PointsKind,
      ref: String(r.ref),
      note: String(r.note),
      created_at: String(r.created_at),
    }));
  }

  /** When each confirmed bounty report was confirmed — a confirmed bug keeps the streak alive too. */
  validReportTimes(learnerId: string): string[] {
    return (this.db.prepare("SELECT COALESCE(triaged_at, created_at) AS t FROM bounty_reports WHERE learner_id = ? AND status = 'valid'").all(learnerId) as Row[]).map((r) => String(r.t));
  }

  /* ── rewards: redemptions ── */

  /** Debits the points and records the request in one transaction — the balance can never go below zero. */
  createRedemption(r: { learner_id: string; kind: "cash" | "goodie"; item_id?: string | null; size?: string | null; points: number; amount_paise: number; upi_id?: string | null; shipping?: object | null; note: string }): RedemptionRow {
    return this.tx(() => {
      const balance = this.pointsBalance(r.learner_id);
      if (r.points > balance) throw httpError(`You have ${balance.toLocaleString("en-IN")} points — that's not enough.`, 400);
      const id = this.nextId("redemptions", "rd");
      const at = new Date().toISOString();
      this.db
        .prepare(
          `INSERT INTO redemptions (id, learner_id, kind, item_id, size, points, amount_paise, upi_id, shipping, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`,
        )
        .run(id, r.learner_id, r.kind, r.item_id ?? null, r.size ?? null, r.points, r.amount_paise, r.upi_id ?? null, r.shipping ? JSON.stringify(r.shipping) : null, at, at);
      this.creditPoints({ learner_id: r.learner_id, delta: -r.points, kind: "redeem", ref: id, note: r.note, at });
      return this.redemption(id)!;
    });
  }

  redemption(id: string): RedemptionRow | null {
    const r = this.db.prepare("SELECT * FROM redemptions WHERE id = ?").get(id) as Row | undefined;
    return r ? toRedemption(r) : null;
  }

  redemptions(f: { learner_id?: string; status?: string; limit?: number } = {}): RedemptionRow[] {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (f.learner_id) (where.push("learner_id = ?"), args.push(f.learner_id));
    if (f.status) (where.push("status = ?"), args.push(f.status));
    args.push(Math.min(f.limit ?? 100, 500));
    return (this.db.prepare(`SELECT * FROM redemptions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`).all(...args) as Row[]).map(toRedemption);
  }

  /** Moving a request to rejected / cancelled gives the points back (once). */
  setRedemptionStatus(id: string, status: RedemptionStatus, extra: { note?: string | null; payout_ref?: string | null } = {}): RedemptionRow {
    return this.tx(() => {
      const cur = this.redemption(id);
      if (!cur) throw httpError("No such redemption.", 404);
      if (cur.status === "rejected" || cur.status === "cancelled") throw httpError(`This request is already ${cur.status}.`, 409);
      const at = new Date().toISOString();
      this.db
        .prepare("UPDATE redemptions SET status = ?, note = COALESCE(?, note), payout_ref = COALESCE(?, payout_ref), updated_at = ? WHERE id = ?")
        .run(status, extra.note ?? null, extra.payout_ref ?? null, at, id);
      if (status === "rejected" || status === "cancelled")
        this.creditPoints({ learner_id: cur.learner_id, delta: cur.points, kind: "refund", ref: id, note: `Points returned — request ${id} ${status}`, at });
      return this.redemption(id)!;
    });
  }

  /* ── rewards: wallet PIN ── */

  walletPin(learnerId: string): { salt: string; hash: string; failed: number; locked_until: string | null } | null {
    const r = this.db.prepare("SELECT salt, hash, failed, locked_until FROM wallet_pins WHERE learner_id = ?").get(learnerId) as Row | undefined;
    return r ? { salt: String(r.salt), hash: String(r.hash), failed: Number(r.failed), locked_until: (r.locked_until as string) ?? null } : null;
  }

  setWalletPin(learnerId: string, salt: string, hash: string): void {
    this.db.prepare("INSERT INTO wallet_pins (learner_id, salt, hash, created_at) VALUES (?, ?, ?, ?)").run(learnerId, salt, hash, new Date().toISOString());
  }

  /** Five wrong PINs lock the wallet for 15 minutes. */
  recordPinAttempt(learnerId: string, ok: boolean): void {
    if (ok) this.db.prepare("UPDATE wallet_pins SET failed = 0, locked_until = NULL WHERE learner_id = ?").run(learnerId);
    else
      this.db
        .prepare("UPDATE wallet_pins SET failed = failed + 1, locked_until = CASE WHEN failed + 1 >= 5 THEN ? ELSE locked_until END WHERE learner_id = ?")
        .run(new Date(Date.now() + 15 * 60_000).toISOString(), learnerId);
  }

  /* ── bug bounty ── */

  createProgram(p: Omit<ProgramRow, "id" | "points_paid" | "created_at"> & { at?: string }): string {
    const id = this.nextId("bounty_programs", "bp");
    this.db
      .prepare(
        `INSERT INTO bounty_programs (id, owner_id, kind, company, title, summary, repo_url, website, scope, out_of_scope, rewards, plan, points_pool, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        p.owner_id,
        p.kind,
        p.company,
        p.title,
        p.summary,
        p.repo_url,
        p.website,
        JSON.stringify(p.scope),
        JSON.stringify(p.out_of_scope),
        JSON.stringify(p.rewards),
        p.plan,
        p.points_pool,
        p.status,
        p.at ?? new Date().toISOString(),
      );
    return id;
  }

  program(id: string): ProgramRow | null {
    const r = this.db.prepare("SELECT * FROM bounty_programs WHERE id = ?").get(id) as Row | undefined;
    return r ? toProgram(r) : null;
  }

  programs(): ProgramRow[] {
    return (this.db.prepare("SELECT * FROM bounty_programs ORDER BY created_at DESC").all() as Row[]).map(toProgram);
  }

  activateProgram(id: string, pool: number): void {
    this.db.prepare("UPDATE bounty_programs SET status = 'open', points_pool = MAX(points_pool, ?) WHERE id = ? AND status = 'awaiting_payment'").run(pool, id);
  }

  setProgramStatus(id: string, status: ProgramStatus): void {
    this.db.prepare("UPDATE bounty_programs SET status = ? WHERE id = ?").run(status, id);
  }

  reportCountSince(learnerId: string, programId: string, sinceIso: string): number {
    return Number((this.db.prepare("SELECT COUNT(*) AS n FROM bounty_reports WHERE learner_id = ? AND program_id = ? AND created_at >= ?").get(learnerId, programId, sinceIso) as { n: number }).n);
  }

  createReport(r: Omit<ReportRow, "id" | "status" | "bug_id" | "final_severity" | "points" | "triage_note" | "created_at" | "triaged_at"> & { at?: string }): string {
    const id = this.nextId("bounty_reports", "br");
    this.db
      .prepare(
        `INSERT INTO bounty_reports (id, program_id, learner_id, title, category, severity, file, line, description, steps, impact, fix, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'triage', ?)`,
      )
      .run(id, r.program_id, r.learner_id, r.title, r.category, r.severity, r.file, r.line, r.description, r.steps, r.impact, r.fix, r.at ?? new Date().toISOString());
    return id;
  }

  report(id: string): ReportRow | null {
    const r = this.db.prepare("SELECT * FROM bounty_reports WHERE id = ?").get(id) as Row | undefined;
    return r ? toReport(r) : null;
  }

  reports(f: { program_id?: string; learner_id?: string; status?: string; limit?: number } = {}): ReportRow[] {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (f.program_id) (where.push("program_id = ?"), args.push(f.program_id));
    if (f.learner_id) (where.push("learner_id = ?"), args.push(f.learner_id));
    if (f.status) (where.push("status = ?"), args.push(f.status));
    args.push(Math.min(f.limit ?? 200, 1000));
    return (this.db.prepare(`SELECT * FROM bounty_reports ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`).all(...args) as Row[]).map(toReport);
  }

  /**
   * Closes a report. When it pays points, the ledger credit (and, for a
   * company program, the draw on its reward pool) happen in the same
   * transaction — the pool can never be overdrawn (there's a CHECK, too).
   */
  triageReport(id: string, t: { status: ReportStatus; final_severity?: string | null; points?: number; note?: string | null; bug_id?: string | null; pool_program?: string | null; at?: string }): ReportRow {
    return this.tx(() => {
      const cur = this.report(id);
      if (!cur) throw httpError("No such report.", 404);
      const at = t.at ?? new Date().toISOString();
      const points = Math.max(0, t.points ?? 0);
      if (points > 0 && t.pool_program) {
        const p = this.program(t.pool_program)!;
        if (p.points_paid + points > p.points_pool) throw httpError(`This program's reward pool has ${(p.points_pool - p.points_paid).toLocaleString("en-IN")} points left.`, 409);
        this.db.prepare("UPDATE bounty_programs SET points_paid = points_paid + ? WHERE id = ?").run(points, p.id);
      }
      this.db
        .prepare("UPDATE bounty_reports SET status = ?, final_severity = ?, points = ?, triage_note = ?, bug_id = COALESCE(?, bug_id), triaged_at = ? WHERE id = ?")
        .run(t.status, t.final_severity ?? null, points, t.note ?? null, t.bug_id ?? null, at, id);
      if (points > 0) this.creditPoints({ learner_id: cur.learner_id, delta: points, kind: "bounty", ref: id, note: `Bug bounty · ${cur.title}`, at });
      return this.report(id)!;
    });
  }

  validBugIds(learnerId: string, programId: string): Set<string> {
    return new Set(
      (this.db.prepare("SELECT bug_id FROM bounty_reports WHERE learner_id = ? AND program_id = ? AND status = 'valid' AND bug_id IS NOT NULL").all(learnerId, programId) as Row[]).map((r) => String(r.bug_id)),
    );
  }

  nudges(learnerId: string, programId: string): string[] {
    return (this.db.prepare("SELECT bug_id FROM bounty_nudges WHERE learner_id = ? AND program_id = ? ORDER BY created_at").all(learnerId, programId) as Row[]).map((r) => String(r.bug_id));
  }

  addNudge(learnerId: string, programId: string, bugId: string): void {
    this.db.prepare("INSERT OR IGNORE INTO bounty_nudges (learner_id, program_id, bug_id, created_at) VALUES (?, ?, ?, ?)").run(learnerId, programId, bugId, new Date().toISOString());
  }

  /** Hall of fame: points earned from bounties, confirmed bugs, and signal (how often reports are right). */
  bountyBoard(limit = 10): { learner_id: string; points: number; valid: number; reports: number }[] {
    return (
      this.db
        .prepare(
          `SELECT learner_id, SUM(points) AS points, SUM(status = 'valid') AS valid, COUNT(*) AS reports
             FROM bounty_reports GROUP BY learner_id HAVING SUM(status = 'valid') > 0
            ORDER BY points DESC, valid DESC LIMIT ?`,
        )
        .all(limit) as Row[]
    ).map((r) => ({ learner_id: String(r.learner_id), points: Number(r.points), valid: Number(r.valid), reports: Number(r.reports) }));
  }

  bountyStats(): { reports: number; valid: number; hunters: number; points_paid: number } {
    const r = this.db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(status = 'valid'), 0) AS v, COUNT(DISTINCT learner_id) AS h, COALESCE(SUM(points), 0) AS p FROM bounty_reports").get() as Row;
    return { reports: Number(r.n), valid: Number(r.v), hunters: Number(r.h), points_paid: Number(r.p) };
  }

  /* ── payments (Dodo) ── */

  createPayment(p: { purpose: PaymentRow["purpose"]; ref: string; sku: string; amount_paise: number; currency?: string; provider?: string }): string {
    const id = this.nextId("payments", "pay");
    const at = new Date().toISOString();
    this.db
      .prepare("INSERT INTO payments (id, provider, purpose, ref, sku, amount_paise, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)")
      .run(id, p.provider ?? "razorpay", p.purpose, p.ref, p.sku, p.amount_paise, p.currency ?? "INR", at, at);
    return id;
  }

  payment(id: string): PaymentRow | null {
    const r = this.db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as Row | undefined;
    return r ? toPayment(r) : null;
  }

  paymentByProviderId(paymentId: string): PaymentRow | null {
    const r = this.db.prepare("SELECT * FROM payments WHERE payment_id = ?").get(paymentId) as Row | undefined;
    return r ? toPayment(r) : null;
  }

  paymentsFor(ref: string): PaymentRow[] {
    return (this.db.prepare("SELECT * FROM payments WHERE ref = ? ORDER BY created_at DESC").all(ref) as Row[]).map(toPayment);
  }

  updatePayment(id: string, patch: Partial<Pick<PaymentRow, "session_id" | "payment_id" | "checkout_url" | "status">>): void {
    const cur = this.payment(id);
    if (!cur) return;
    // a succeeded payment never goes back to pending / failed
    const status = cur.status === "succeeded" ? "succeeded" : (patch.status ?? cur.status);
    this.db
      .prepare("UPDATE payments SET session_id = ?, payment_id = ?, checkout_url = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(patch.session_id ?? cur.session_id, patch.payment_id ?? cur.payment_id, patch.checkout_url ?? cur.checkout_url, status, new Date().toISOString(), id);
  }

  dodoProduct(sku: string, mode: string): string | null {
    const r = this.db.prepare("SELECT product_id FROM dodo_products WHERE sku = ? AND mode = ?").get(sku, mode) as Row | undefined;
    return r ? String(r.product_id) : null;
  }

  saveDodoProduct(sku: string, mode: string, productId: string): void {
    this.db.prepare("INSERT OR REPLACE INTO dodo_products (sku, mode, product_id, created_at) VALUES (?, ?, ?, ?)").run(sku, mode, productId, new Date().toISOString());
  }

  /** True the first time a webhook id is seen — Dodo retries, we process once. */
  firstWebhook(id: string, type: string): boolean {
    return Number(this.db.prepare("INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?, ?, ?)").run(id, type, new Date().toISOString()).changes) > 0;
  }

  /* ── plans: subscriptions, Free-plan usage, Custom-plan leads ── */

  subscription(learnerId: string): SubscriptionRow | null {
    const r = this.db.prepare("SELECT * FROM subscriptions WHERE learner_id = ?").get(learnerId) as Row | undefined;
    return r ? toSubscription(r) : null;
  }

  subscriptionByProviderId(subscriptionId: string): SubscriptionRow | null {
    const r = this.db.prepare("SELECT * FROM subscriptions WHERE subscription_id = ?").get(subscriptionId) as Row | undefined;
    return r ? toSubscription(r) : null;
  }

  saveSubscription(s: Omit<SubscriptionRow, "created_at" | "updated_at">): void {
    const at = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO subscriptions (learner_id, plan, status, provider, currency, amount, subscription_id, payment_id, current_period_end, cancel_at_period_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(learner_id) DO UPDATE SET plan = excluded.plan, status = excluded.status, provider = excluded.provider, currency = excluded.currency, amount = excluded.amount,
           subscription_id = excluded.subscription_id, payment_id = excluded.payment_id, current_period_end = excluded.current_period_end,
           cancel_at_period_end = excluded.cancel_at_period_end, updated_at = excluded.updated_at`,
      )
      .run(s.learner_id, s.plan, s.status, s.provider, s.currency, s.amount, s.subscription_id, s.payment_id, s.current_period_end, s.cancel_at_period_end ? 1 : 0, at, at);
  }

  /** Counts one use and returns the new count for the day. */
  bumpUsage(learnerId: string, kind: string, day: string): number {
    const r = this.db
      .prepare("INSERT INTO usage_daily (learner_id, kind, day, n) VALUES (?, ?, ?, 1) ON CONFLICT(learner_id, kind, day) DO UPDATE SET n = n + 1 RETURNING n")
      .get(learnerId, kind, day) as Row;
    return Number(r.n);
  }

  usage(learnerId: string, day: string): Record<string, number> {
    const rows = this.db.prepare("SELECT kind, n FROM usage_daily WHERE learner_id = ? AND day = ?").all(learnerId, day) as Row[];
    return Object.fromEntries(rows.map((r) => [String(r.kind), Number(r.n)]));
  }

  createLead(l: { name: string; email: string; organisation: string; kind: LeadRow["kind"]; seats: number | null; message: string | null; learner_id: string | null }): string {
    const n = (this.db.prepare("SELECT COUNT(*) AS n FROM plan_leads").get() as { n: number }).n;
    const id = `lead_${String(n + 1).padStart(4, "0")}`;
    this.db
      .prepare("INSERT INTO plan_leads (id, name, email, organisation, kind, seats, message, learner_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)")
      .run(id, l.name, l.email, l.organisation, l.kind, l.seats, l.message, l.learner_id, new Date().toISOString());
    return id;
  }

  leads(limit = 100): LeadRow[] {
    return (this.db.prepare("SELECT * FROM plan_leads ORDER BY created_at DESC LIMIT ?").all(limit) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      organisation: String(r.organisation),
      kind: String(r.kind) as LeadRow["kind"],
      seats: r.seats === null ? null : Number(r.seats),
      message: (r.message as string) ?? null,
      learner_id: (r.learner_id as string) ?? null,
      status: String(r.status) as LeadRow["status"],
      created_at: String(r.created_at),
    }));
  }

  setLeadStatus(id: string, status: LeadRow["status"]): boolean {
    return Number(this.db.prepare("UPDATE plan_leads SET status = ? WHERE id = ?").run(status, id).changes) > 0;
  }

  /* ── the answer step ── */

  answer(submissionId: string): unknown | null {
    const r = this.db.prepare("SELECT payload FROM answers WHERE submission_id = ?").get(submissionId) as { payload: string } | undefined;
    return r ? JSON.parse(r.payload) : null;
  }

  saveAnswer(a: { submission_id: string; learner_id: string; challenge_id: string; payload: unknown }): void {
    this.db
      .prepare("INSERT OR REPLACE INTO answers (submission_id, learner_id, challenge_id, payload, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(a.submission_id, a.learner_id, a.challenge_id, JSON.stringify(a.payload), new Date().toISOString());
  }

  /* ── reset (judges' page / npm run seed) ── */

  wipe(): void {
    this.tx(() => {
      for (const t of [
        "answers",
        "test_results",
        "hints",
        "ledger",
        "submissions",
        "mastery",
        "bug_finds",
        "learners",
        "votes",
        "replies",
        "posts",
        "profiles",
        "points_ledger",
        "redemptions",
        "wallet_pins",
        "bounty_reports",
        "bounty_nudges",
        "bounty_programs",
        "payments",
        "subscriptions",
        "usage_daily",
      ])
        this.db.exec(`DELETE FROM ${t}`);
    });
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbFile(): string {
  return process.env.LAYERFLOW_DB ?? path.resolve(here, "../../../apps/api/data/layerflow.db");
}
