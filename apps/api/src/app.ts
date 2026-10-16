/**
 * The Debug Dojo HTTP API (Fastify).
 *
 * Required by the statement:  POST /api/submit · POST /api/hint · GET /api/learner/:id
 * Plus: challenges, submissions, replay (OB2), bug factory (OB3), ledger,
 * taxonomy, red-team corpus, stats/feed for the landing page, health, dev reset.
 *
 * Secrecy is enforced in three places: hidden tests never leave
 * @dojo/core except as {test, outcome}; the response SCHEMA for /api/submit
 * only knows those two keys for hidden rows (Fastify's serializer drops
 * anything else); and every outgoing text passed findLeak() in the engine.
 */
import Fastify, { type FastifyInstance } from "fastify";
import {
  CONCEPT_LABELS,
  HOSTILE_PROGRAMS,
  ESCAPE_ATTEMPTS,
  JUDGE_CHALLENGE_IDS,
  MASTERY_RULES,
  PRIORITY_RULE,
  RECURRENCE_RULE,
  TAXONOMY,
  TAG_LABELS,
  bugFactoryPick,
  getChallenge,
  hintDelta,
  learnerSummary,
  listedChallenges,
  bugFactoryChallenges,
  masteryMap,
  publicChallenge,
  publicChallengeSummary,
  submissionDelta,
  type Concept,
  type HistoryItem,
  type Rewriter,
  type Sandbox,
} from "@dojo/core";
import type { DojoStore } from "@dojo/db";
import { doHint, doSubmit } from "./service.ts";

export interface AppDeps {
  store: DojoStore;
  sandbox: Sandbox;
  rewriter: Rewriter | null;
  pool?: { status(): unknown };
  reseed?: () => Promise<void>;
  logSubmissions?: boolean;
}

const LEARNER_ID = "^[A-Za-z0-9_.-]{2,40}$";
const OUTCOME = { type: "string", enum: ["passed", "wrong_output", "runtime_error", "timeout"] } as const;

const submitResponseSchema = {
  type: "object",
  required: ["submission_id", "learner_id", "challenge_id", "visible", "hidden", "mistake_tags", "explanation"],
  additionalProperties: false,
  properties: {
    submission_id: { type: "string" },
    learner_id: { type: "string" },
    challenge_id: { type: "string" },
    visible: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["test", "call", "expected", "got", "outcome"],
        properties: { test: { type: "integer" }, call: { type: "string" }, expected: { type: "string" }, got: { type: "string" }, outcome: OUTCOME },
      },
    },
    // 🔒 hidden rows: exactly {test, outcome}. Anything else is dropped by the serializer.
    hidden: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["test", "outcome"], properties: { test: { type: "integer" }, outcome: OUTCOME } },
    },
    mistake_tags: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
    debug: {
      type: "object",
      additionalProperties: false,
      properties: {
        culprit_line: { type: ["integer", "null"] },
        confidence: { type: ["string", "null"] },
        reason: { type: ["string", "null"] },
        trace_ref: { type: "string" },
        passed: { type: "boolean" },
        detail: { type: ["string", "null"] },
        headline: { type: "string" },
      },
    },
  },
} as const;

function streak(history: HistoryItem[]): number {
  const days = new Set(history.map((h) => h.at.slice(0, 10)));
  let n = 0;
  const d = new Date();
  // a streak survives until the end of the day after the last practice
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

/** Replays a learner's evidence in time order to show mastery moving with it. */
function masteryTimeline(history: HistoryItem[], hints: { challenge_id: string; created_at: string }[]) {
  type Ev = { at: string; kind: "sub"; h: HistoryItem } | { at: string; kind: "hint"; challenge_id: string };
  const events: Ev[] = [
    ...history.map((h) => ({ at: h.at, kind: "sub" as const, h })),
    ...hints.map((x) => ({ at: x.created_at, kind: "hint" as const, challenge_id: x.challenge_id })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const ab: Record<string, { a: number; b: number }> = {};
  const hintedSince: Record<string, number> = {};
  const points: { at: string; label: string; mastery: Record<string, number> }[] = [];
  for (const e of events) {
    const cid = e.kind === "sub" ? e.h.challenge_id : e.challenge_id;
    const ch = getChallenge(cid);
    if (!ch) continue;
    const deltas = e.kind === "hint" ? hintDelta(ch.concepts) : submissionDelta(ch.concepts, e.h.passed, (hintedSince[cid] ?? 0) > 0);
    for (const d of deltas) {
      ab[d.concept] ??= { a: MASTERY_RULES.prior.alpha, b: MASTERY_RULES.prior.beta };
      ab[d.concept].a += d.dAlpha;
      ab[d.concept].b += d.dBeta;
    }
    if (e.kind === "hint") hintedSince[cid] = (hintedSince[cid] ?? 0) + 1;
    else {
      if (e.h.passed) hintedSince[cid] = 0;
      points.push({
        at: e.at,
        label: `${e.h.passed ? "✓" : "✗"} ${cid}`,
        mastery: Object.fromEntries(Object.entries(ab).map(([k, v]) => [k, Math.round((v.a / (v.a + v.b)) * 100) / 100])),
      });
    }
  }
  return points;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { store, sandbox, rewriter } = deps;
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });
  const started = Date.now();

  // A crash in one request must never take the server down.
  app.setErrorHandler((err, _req, reply) => {
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode ?? 500;
    if (status >= 500 && status !== 503) console.error("[error]", err);
    const friendly = status === 503 ? e.message : "Something went wrong on our side — please try again.";
    reply.status(status).send({ error: status >= 500 ? friendly : (e.message ?? "Bad request") });
  });

  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("cache-control", "no-store");
    return payload;
  });

  /* ── health ── */
  app.get("/api/health", async () => ({
    ok: true,
    uptime_s: Math.round((Date.now() - started) / 1000),
    sandbox: deps.pool?.status() ?? null,
    llm: rewriter ? rewriter.model : null,
    challenges: listedChallenges().length,
    language: "Python",
  }));

  /* ── challenges (never hidden tests) ── */
  app.get("/api/challenges", async (req) => {
    const all = (req.query as { all?: string }).all === "1";
    return {
      judge_challenges: JUDGE_CHALLENGE_IDS,
      challenges: (all ? [...listedChallenges(), ...bugFactoryChallenges()] : listedChallenges()).map(publicChallengeSummary),
      concept_labels: CONCEPT_LABELS,
    };
  });

  app.get<{ Params: { id: string } }>("/api/challenges/:id", async (req, reply) => {
    const c = getChallenge(req.params.id);
    if (!c) return reply.status(404).send({ error: `No challenge called ${req.params.id}` });
    return publicChallenge(c);
  });

  /* ── POST /api/submit ── */
  app.post<{ Body: { learner_id: string; challenge_id: string; code: string } }>(
    "/api/submit",
    {
      schema: {
        body: {
          type: "object",
          required: ["learner_id", "challenge_id", "code"],
          properties: {
            learner_id: { type: "string", pattern: LEARNER_ID },
            challenge_id: { type: "string", maxLength: 64 },
            code: { type: "string", maxLength: 20000 },
          },
        },
        response: { 200: submitResponseSchema },
      },
    },
    async (req, reply) => {
      const challenge = getChallenge(req.body.challenge_id);
      if (!challenge) return reply.status(404).send({ error: `No challenge called ${req.body.challenge_id}` });
      const t0 = Date.now();
      const out = await doSubmit({ store, sandbox, rewriter }, req.body.learner_id, challenge.id, req.body.code);
      if (deps.logSubmissions !== false) {
        const killed = out.results.map((r) => r.run.killedBy).filter(Boolean);
        console.log(
          `[submit] ${out.response.submission_id} ${req.body.learner_id} ${challenge.id} ${out.record.passed ? "PASS" : "fail"} ` +
            `tags=${out.response.mistake_tags.join(",") || "-"} ${Date.now() - t0}ms${killed.length ? " killed_by=" + [...new Set(killed)].join(",") : ""}`,
        );
      }
      return { ...out.response, debug: { ...out.response.debug!, headline: out.headline } };
    },
  );

  /* ── POST /api/hint ── */
  app.post<{ Body: { submission_id: string; message?: string } }>(
    "/api/hint",
    {
      schema: {
        body: {
          type: "object",
          required: ["submission_id"],
          properties: { submission_id: { type: "string", maxLength: 32 }, message: { type: "string", maxLength: 500 } },
        },
      },
    },
    async (req) => doHint({ store, sandbox, rewriter }, req.body.submission_id, req.body.message),
  );

  /* ── GET /api/learner/:id ── */
  app.get<{ Params: { id: string } }>("/api/learner/:id", async (req) => {
    const id = req.params.id;
    const history = store.history(id);
    const mastery = store.mastery(id);
    const summary = learnerSummary(id, history, mastery);
    const hints = store.db.prepare("SELECT challenge_id, created_at FROM hints WHERE learner_id = ? ORDER BY created_at").all(id) as {
      challenge_id: string;
      created_at: string;
    }[];
    const timeline = masteryTimeline(history, hints);
    const touched = [...new Set(mastery.map((m) => m.concept))] as Concept[];
    const bf = bugFactoryPick(history);
    const passedIds = new Set(history.filter((h) => h.passed).map((h) => h.challenge_id));
    const firstTry = new Map<string, boolean>();
    for (const h of history) if (!firstTry.has(h.challenge_id)) firstTry.set(h.challenge_id, h.passed);
    return {
      learner_id: id,
      recurring_mistakes: summary.recurring_mistakes,
      one_off_mistakes: summary.one_off_mistakes,
      mastery: masteryMap(mastery),
      next_challenge: { challenge_id: summary.next_challenge.challenge_id, reason: summary.next_challenge.reason },
      history: history.map((h) => ({ submission_id: h.submission_id, challenge_id: h.challenge_id, at: h.at, tags: h.tags, passed: h.passed, hints_used: h.hints_used })),
      // ── extras for the dashboard ──
      next_basis: summary.next_challenge.basis,
      recurring_where: summary.where,
      touched_concepts: touched,
      concept_labels: CONCEPT_LABELS,
      tag_labels: TAG_LABELS,
      mastery_timeline: timeline,
      streak_days: streak(history),
      totals: {
        submissions: history.length,
        passes: history.filter((h) => h.passed).length,
        challenges_cleared: passedIds.size,
        first_try_passes: [...firstTry.values()].filter(Boolean).length,
        hints: hints.length,
      },
      bug_factory: { challenge_id: bf.challenge.id, tag: bf.tag, reason: bf.reason },
      activity: store.activity(id),
    };
  });

  app.get("/api/learners", async () => ({ learners: store.learners() }));

  /* ── a stored submission (for reloading a result) ── */
  app.get<{ Params: { id: string } }>("/api/submissions/:id", async (req, reply) => {
    const sub = store.getSubmission(req.params.id);
    if (!sub) return reply.status(404).send({ error: "not found" });
    const challenge = getChallenge(sub.challenge_id)!;
    const pub = publicChallenge(challenge);
    return {
      submission_id: sub.id,
      learner_id: sub.learner_id,
      challenge_id: sub.challenge_id,
      code: sub.code,
      passed: sub.passed,
      mistake_tags: sub.tags,
      explanation: sub.explanation,
      created_at: sub.created_at,
      analysis: sub.analysis,
      visible: sub.results
        .filter((r) => r.kind === "visible")
        .map((r) => ({ test: r.test, call: pub.visible[r.test - 1]?.call, expected: pub.visible[r.test - 1]?.expected, got: r.got ?? "", outcome: r.outcome })),
      hidden: sub.results.filter((r) => r.kind === "hidden").map((r) => ({ test: r.test, outcome: r.outcome })),
      hints: store.hintsFor(sub.id),
    };
  });

  /* ── OB2 Time-Travel Replay ── */
  app.post<{ Body: { submission_id: string; kind?: string; args_source?: string } }>(
    "/api/replay",
    {
      schema: {
        body: {
          type: "object",
          required: ["submission_id"],
          properties: { submission_id: { type: "string" }, kind: { type: "string", maxLength: 40 }, args_source: { type: "string", maxLength: 500 } },
        },
      },
    },
    async (req, reply) => {
      const sub = store.getSubmission(req.body.submission_id);
      if (!sub) return reply.status(404).send({ error: "not found" });
      const challenge = getChallenge(sub.challenge_id)!;
      // Only PUBLIC inputs (probes / visible tests), or what the learner typed themselves.
      let kind = req.body.kind;
      if (!kind && !req.body.args_source) {
        // the probe for the KIND of input that failed (already named in the explanation)
        const failingEdges = sub.results
          .filter((r) => r.outcome !== "passed")
          .map((r) => (r.kind === "visible" ? challenge.visible : challenge.hidden)[r.test - 1]?.edge)
          .filter((e): e is string => !!e && !!challenge.probes[e]);
        kind = failingEdges[0] ?? "default";
      }
      const args = challenge.probes[kind ?? "default"] ?? challenge.visible[0].args;
      const res = await sandbox.trace({
        code: sub.code,
        fn: challenge.fn,
        args: req.body.args_source ? undefined : args,
        argsSource: req.body.args_source,
        culpritLine: sub.analysis?.culprit_line ?? null,
      });
      return { ...res, used_kind: req.body.args_source ? "custom" : (kind ?? "default"), kinds: Object.keys(challenge.probes).map((k) => ({ kind: k, label: k === "default" ? "first visible example" : (challenge.edges[k]?.one ?? k) })) };
    },
  );

  /* ── OB3 Bug Factory ── */
  app.get<{ Params: { id: string } }>("/api/bug-factory/:id", async (req) => {
    const pick = bugFactoryPick(store.history(req.params.id));
    const finds = store.finds(req.params.id, pick.challenge.id);
    return {
      challenge: publicChallenge(pick.challenge),
      tag: pick.tag,
      tag_label: TAG_LABELS[pick.tag],
      reason: pick.reason,
      found: finds.some((f) => f.correct),
      attempts: finds.length,
      templates: bugFactoryChallenges().map((c) => ({ challenge_id: c.id, tag: c.bugFactory!.tag, title: c.title })),
    };
  });

  app.get<{ Params: { id: string; challenge: string } }>("/api/bug-factory/:id/:challenge", async (req, reply) => {
    const c = getChallenge(req.params.challenge);
    if (!c?.bugFactory) return reply.status(404).send({ error: "not a bug factory challenge" });
    const finds = store.finds(req.params.id, c.id);
    return { challenge: publicChallenge(c), tag: c.bugFactory.tag, tag_label: TAG_LABELS[c.bugFactory.tag], reason: "Chosen by you.", found: finds.some((f) => f.correct), attempts: finds.length };
  });

  app.post<{ Body: { learner_id: string; challenge_id: string; line: number } }>(
    "/api/bug-factory/locate",
    {
      schema: {
        body: {
          type: "object",
          required: ["learner_id", "challenge_id", "line"],
          properties: { learner_id: { type: "string", pattern: LEARNER_ID }, challenge_id: { type: "string" }, line: { type: "integer", minimum: 1, maximum: 200 } },
        },
      },
    },
    async (req, reply) => {
      const c = getChallenge(req.body.challenge_id);
      if (!c?.bugFactory) return reply.status(404).send({ error: "not a bug factory challenge" });
      const correct = req.body.line === c.bugFactory.culpritLine;
      store.recordFind(req.body.learner_id, c.id, req.body.line, correct);
      const attempts = store.finds(req.body.learner_id, c.id).length;
      return correct
        ? { correct, attempts, message: `Found it — line ${req.body.line}. ${c.bugFactory.lesson} Now fix it and submit.`, lesson: c.bugFactory.lesson }
        : {
            correct,
            attempts,
            message:
              attempts >= 3
                ? `Not that one. Think about ${TAG_LABELS[c.bugFactory.tag].toLowerCase()}: which line decides what happens at the edge?`
                : "Not that line — that one does what it says. Read each line and ask: what happens on the edge-case input?",
          };
    },
  );

  /* ── Hint Ledger ── */
  app.get<{ Querystring: { learner_id?: string; submission_id?: string; kind?: string; limit?: string } }>("/api/ledger", async (req) => {
    const q = req.query;
    return { stats: store.ledgerStats(), entries: store.ledger({ learner_id: q.learner_id, submission_id: q.submission_id, kind: q.kind, limit: q.limit ? Number(q.limit) : undefined }) };
  });

  /* ── taxonomy + red-team corpus (both public) ── */
  app.get("/api/taxonomy", async () => ({ categories: TAXONOMY, recurrence_rule: RECURRENCE_RULE, priority_rule: PRIORITY_RULE, mastery_rules: MASTERY_RULES }));
  app.get("/api/redteam", async () => ({ programs: HOSTILE_PROGRAMS, escapes: ESCAPE_ATTEMPTS }));

  /* ── landing page numbers ── */
  app.get("/api/stats", async () => ({ ...store.stats(), ledger: store.ledgerStats(), challenges: listedChallenges().length, hostile_programs: HOSTILE_PROGRAMS.length }));
  app.get("/api/feed", async () => ({
    items: store.recentSubmissions(12).map((s) => ({
      submission_id: s.id,
      learner_id: s.learner_id,
      challenge_id: s.challenge_id,
      title: getChallenge(s.challenge_id)?.title ?? s.challenge_id,
      passed: s.passed,
      tags: s.tags,
      hints: s.hints,
      duration_ms: s.duration_ms,
      at: s.created_at,
    })),
  }));

  /* ── judges: reset the seed data ── */
  const reset = async () => {
    if (!deps.reseed) return { ok: false, error: "reset not available" };
    await deps.reseed();
    return { ok: true, learners: store.learners().length, stats: store.stats() };
  };
  app.get("/api/dev/reset", reset);
  app.post("/api/dev/reset", reset);
  app.get("/api/dev/seed", reset);

  app.setNotFoundHandler((req, reply) => reply.status(404).send({ error: `No route ${req.method} ${req.url}` }));
  return app;
}
