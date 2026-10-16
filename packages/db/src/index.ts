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
  logEvent(e: { kind: "chat" | "mentor" | "repo"; learner_id: string | null; prompt: string; response: string; model: string | null; rejected: boolean }): void {
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

  saveRepoReport(r: { learner_id: string | null; repo: string; source: "github" | "local"; score: number; grade: string; report: unknown }): string {
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

  /* ── reset (judges' page / npm run seed) ── */

  wipe(): void {
    this.tx(() => {
      for (const t of ["test_results", "hints", "ledger", "submissions", "mastery", "bug_finds", "learners", "votes", "replies", "posts", "profiles"]) this.db.exec(`DELETE FROM ${t}`);
    });
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbFile(): string {
  return process.env.LAYERFLOW_DB ?? path.resolve(here, "../../../apps/api/data/layerflow.db");
}
