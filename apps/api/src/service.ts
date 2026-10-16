/**
 * One code path for submit + hint, shared by the HTTP routes, the seed and the
 * harness — so the demo data is produced by exactly the product the judges test.
 */
import { RUNG_NAMES, getChallenge, isAnswerRequest, nextHint, submit, type Rewriter, type Sandbox } from "@layerflow/core";
import type { LayerflowStore } from "@layerflow/db";
import type { ScriptStep } from "./fixtures.ts";

export interface Ctx {
  store: LayerflowStore;
  sandbox: Sandbox;
  rewriter: Rewriter | null;
}

export async function doSubmit(ctx: Ctx, learnerId: string, challengeId: string, code: string, at?: string) {
  const challenge = getChallenge(challengeId);
  if (!challenge) throw Object.assign(new Error(`No challenge called ${challengeId}`), { statusCode: 404 });
  return submit({ learner_id: learnerId, challenge, code, at }, ctx);
}

export async function doHint(ctx: Ctx, submissionId: string, message?: string, at?: string) {
  const sub = ctx.store.getSubmission(submissionId);
  if (!sub) throw Object.assign(new Error(`No submission ${submissionId}`), { statusCode: 404 });
  const challenge = getChallenge(sub.challenge_id)!;
  if (sub.passed) {
    return { submission_id: sub.id, hint_index: 0, rung: 0, rung_name: "", hint: "Every test passed — there's nothing left to hint at. Try the next challenge without hints!", remaining: 0 };
  }
  const prevRung = ctx.store.maxRung(sub.learner_id, sub.challenge_id, sub.ladder_key);
  const given = ctx.store.hintsFor(sub.id).length;
  const out = await nextHint(
    { challenge, code: sub.code, ladderKey: sub.ladder_key, prevRung, givenOnSubmission: given, lineMap: sub.analysis, message },
    ctx.rewriter,
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
