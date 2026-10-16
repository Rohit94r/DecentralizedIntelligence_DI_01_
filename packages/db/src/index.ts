/**
 * @dojo/db — the ONLY module that touches SQL.
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
} from "@dojo/core";

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

export class DojoStore implements Store {
  readonly db: DatabaseSync;

  constructor(readonly file: string) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
    this.db.exec(readFileSync(path.join(here, "schema.sql"), "utf8"));
    this.seedBugTemplates();
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

  /* ── reset (judges' page / npm run seed) ── */

  wipe(): void {
    this.tx(() => {
      for (const t of ["test_results", "hints", "ledger", "submissions", "mastery", "bug_finds", "learners"]) this.db.exec(`DELETE FROM ${t}`);
    });
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbFile(): string {
  return process.env.DOJO_DB ?? path.resolve(here, "../../../apps/api/data/dojo.db");
}
