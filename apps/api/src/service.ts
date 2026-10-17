/**
 * One code path for submit + hint, shared by the HTTP routes, the seed and the
 * harness — so the demo data is produced by exactly the product the judges test.
 */
import { RUNG_NAMES, callString, getChallenge, isAnswerRequest, nextHint, pyRepr, submit, type Challenge, type HintWriter, type Rewriter, type Sandbox } from "@layerflow/core";
import type { LayerflowStore } from "@layerflow/db";
import type { ScriptStep } from "./fixtures.ts";

export interface Ctx {
  store: LayerflowStore;
  sandbox: Sandbox;
  rewriter: Rewriter | null;
  /** optional: writes each hint for the learner's own code (HTTP requests only — the seed stays deterministic) */
  hintWriter?: HintWriter | null;
}

export async function doSubmit(ctx: Ctx, learnerId: string, challengeId: string, code: string, at?: string) {
  const challenge = getChallenge(challengeId);
  if (!challenge) throw Object.assign(new Error(`No challenge called ${challengeId}`), { statusCode: 404 });
  return submit({ learner_id: learnerId, challenge, code, at }, ctx);
}

type StoredSubmission = NonNullable<ReturnType<LayerflowStore["getSubmission"]>>;

/**
 * What an AI hint / answer writer may see about a submission: the visible test
 * rows and the KIND of input that failed — never a hidden input or expected value.
 */
export function publicFacts(sub: StoredSubmission, challenge: Challenge) {
  const failingKinds = [
    ...new Set(
      sub.results
        .filter((r) => r.outcome !== "passed")
        .map((r) => {
          const edge = (r.kind === "visible" ? challenge.visible : challenge.hidden)[r.test - 1]?.edge;
          return edge && challenge.edges[edge] ? challenge.edges[edge].one : "an ordinary input";
        }),
    ),
  ];
  const visible = sub.results
    .filter((r) => r.kind === "visible")
    .map((r) => {
      const t = challenge.visible[r.test - 1];
      return { call: t ? callString(challenge.fn, t.args) : "", expected: t ? pyRepr(t.expected, { float: challenge.floatResult }) : "", got: r.got ?? "", outcome: r.outcome };
    });
  return { failingKinds, visible };
}

export async function doHint(ctx: Ctx, submissionId: string, message?: string, at?: string) {
  const sub = ctx.store.getSubmission(submissionId);
  if (!sub) throw Object.assign(new Error(`No submission ${submissionId}`), { statusCode: 404 });
  const challenge = getChallenge(sub.challenge_id)!;
  if (sub.passed) {
    return { submission_id: sub.id, hint_index: 0, rung: 0, rung_name: "", hint: "Every test passed — there's nothing left to hint at. Try the next challenge without hints!", remaining: 0 };
  }
  const prevRung = ctx.store.maxRung(sub.learner_id, sub.challenge_id, sub.ladder_key);
  const shown = ctx.store.hintsFor(sub.id);
  const given = shown.length;
  const { failingKinds, visible } = publicFacts(sub, challenge);
  const out = await nextHint(
    {
      challenge,
      code: sub.code,
      ladderKey: sub.ladder_key,
      prevRung,
      givenOnSubmission: given,
      lineMap: sub.analysis,
      message,
      context: { tag: sub.tags[0] ?? null, explanation: sub.explanation, visible, failingKinds, previous: shown.map((h) => h.text) },
    },
    ctx.rewriter,
    ctx.hintWriter ?? null,
  );
  const idx = ctx.store.saveHint({
    submission_id: sub.id,
    learner_id: sub.learner_id,
    challenge_id: sub.challenge_id,
    ladder_key: sub.ladder_key,
    rung: out.rung,
    text: out.text,
    asked: isAnswerRequest(message),
    at,
    ledger: out.ledger,
    masteryDeltas: out.masteryDeltas,
  });
  return {
    submission_id: sub.id,
    hint_index: idx,
    rung: out.rung,
    rung_name: RUNG_NAMES[out.rung] ?? "",
    hint: out.text,
    source: out.source,
    remaining: out.remaining,
    ...(out.note ? { note: out.note } : {}),
  };
}

/** Play a scripted learner through the real engine, spreading timestamps over `days`. */
export async function runScript(ctx: Ctx, learnerId: string, steps: ScriptStep[], opts: { days?: number; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  const span = (opts.days ?? 0) * 86_400_000;
  const slots = steps.reduce((n, s) => n + (s.code ? 1 : s.hints ?? 1), 0);
  let slot = 0;
  const stamp = () => {
    const t = span ? now - span + Math.round((span * slot) / Math.max(1, slots)) : now + slot;
    slot++;
    return new Date(t).toISOString();
  };
  const log: { step: ScriptStep; submission?: Awaited<ReturnType<typeof doSubmit>>; hints?: Awaited<ReturnType<typeof doHint>>[] }[] = [];
  let lastId: string | null = null;
  for (const step of steps) {
    if (step.code) {
      const res = await doSubmit(ctx, learnerId, step.challenge, step.code, span ? stamp() : undefined);
      lastId = res.response.submission_id;
      log.push({ step, submission: res });
    } else if (lastId) {
      const hints = [];
      for (let i = 0; i < (step.hints ?? 1); i++) hints.push(await doHint(ctx, lastId, i === 0 ? step.message : undefined, span ? stamp() : undefined));
      log.push({ step, hints });
    }
  }
  return log;
}
