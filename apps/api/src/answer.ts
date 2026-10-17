/**
 * The answer step — unlocked only after all three hints on a problem.
 *
 *   1. ask the configured model (Groq / Gemini / Anthropic) to fix the learner's
 *      OWN code with the smallest change, and say what was wrong
 *   2. run that fix against EVERY visible + hidden test in the sandbox
 *   3. still failing? one retry, told the KIND of input it fails on
 *   4. no model, or still failing → a known-correct version (verified too)
 *
 * Nothing untested is ever shown. Stored per submission, logged to the ledger
 * (the explanation only — the code isn't copied into the ledger).
 */
import {
  HINT_RUNGS,
  answerMessages,
  checkProgram,
  findLeak,
  getChallenge,
  lineDiff,
  parseAnswer,
  referenceExplanation,
  syntaxDiagnosis,
  syntaxFix,
  type AnswerContext,
  type AnswerDraft,
  type AnswerPayload,
} from "@layerflow/core";
import { REFERENCE } from "@layerflow/core/reference";
import type { Ai } from "./lib/ai.ts";
import { publicFacts, type Ctx } from "./service.ts";

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export async function doAnswer(ctx: Ctx, ai: Ai | null, submissionId: string): Promise<AnswerPayload & { submission_id: string }> {
  const sub = ctx.store.getSubmission(submissionId);
  if (!sub) throw err(`No submission ${submissionId}`, 404);
  const challenge = getChallenge(sub.challenge_id)!;
  if (sub.passed) throw err("Every test already passes — there's no answer left to show. Nice work!", 400);
  const cached = ctx.store.answer(sub.id) as AnswerPayload | null;
  if (cached) return { submission_id: sub.id, ...cached };
  const used = ctx.store.maxRung(sub.learner_id, sub.challenge_id, sub.ladder_key);
  if (used < HINT_RUNGS) throw err(`Use all ${HINT_RUNGS} hints first — the answer unlocks after the last one.`, 403);

  const { failingKinds, visible } = publicFacts(sub, challenge);
  const x: AnswerContext = {
    challenge,
    code: sub.code,
    tag: sub.tags[0] ?? null,
    lineMap: sub.analysis,
    explanation: sub.explanation,
    visible,
    failingKinds,
    hints: ctx.store.hintsFor(sub.id).map((h) => h.text),
  };
  const safe = (d: AnswerDraft) => !findLeak(`${d.whats_wrong}\n${d.what_changed}`, challenge, [], sub.code) && !findLeak(d.fixed_code, challenge, [], sub.code);

  let chosen: { draft: AnswerDraft; source: "ai" | "rule" | "reference"; model: string | null; total: number } | null = null;

  // A syntax mistake has a mechanical fix: change only the broken line, then prove it passes every test.
  if (sub.ladder_key === "syntax") {
    const d = syntaxDiagnosis(sub.code, sub.analysis?.culprit_line ?? null);
    const fix = d ? syntaxFix(sub.code, d) : null;
    if (d && fix) {
      const check = await checkProgram(challenge, fix.code, ctx.sandbox);
      if (check.passed) {
        const what = d.what.charAt(0).toUpperCase() + d.what.slice(1);
        chosen = { draft: { whats_wrong: `${what}. ${d.fix}`, what_changed: fix.change, fixed_code: fix.code }, source: "rule", model: null, total: check.total };
        ctx.store.logEvent({ kind: "answer", learner_id: sub.learner_id, prompt: `answer · ${challenge.id} · submission ${sub.id} · syntax fix`, response: `${what}. ${fix.change} [passed ${check.total}/${check.total} tests]`, model: null, rejected: false });
      }
    }
  }

  if (ai && !chosen) {
    let stillFails: string[] | undefined;
    for (let attempt = 0; attempt < 2 && !chosen; attempt++) {
      const { system, user } = answerMessages(x, stillFails);
      const out = await ai.complete(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { maxTokens: 1400, temperature: 0.2, timeoutMs: 25_000 },
      );
      if (!out) break;
      const draft = parseAnswer(out.text, challenge.fn);
      if (!draft) {
        ctx.store.logEvent({ kind: "answer", learner_id: sub.learner_id, prompt: `answer · ${challenge.id} · attempt ${attempt + 1}`, response: "unreadable reply", model: out.model, rejected: true });
        continue;
      }
      const check = await checkProgram(challenge, draft.fixed_code, ctx.sandbox);
      const ok = check.passed && safe(draft);
      ctx.store.logEvent({
        kind: "answer",
        learner_id: sub.learner_id,
        prompt: `answer · ${challenge.id} · submission ${sub.id} · attempt ${attempt + 1}`,
        response: ok ? `${draft.whats_wrong} ${draft.what_changed} [fixed code passed ${check.total}/${check.total} tests]` : `fix rejected: ${check.passed ? "failed the leak check" : `still fails on ${check.failingKinds.join("; ")}`}`,
        model: out.model,
        rejected: !ok,
      });
      if (ok) chosen = { draft, source: "ai", model: out.model, total: check.total };
      else stillFails = check.failingKinds;
    }
  }
  if (!chosen) {
    const ref = REFERENCE[challenge.id];
    if (!ref) throw err("The answer isn't available for this problem yet.", 404);
    const check = await checkProgram(challenge, ref, ctx.sandbox);
    if (!check.passed) throw err("The answer couldn't be verified right now — please try again in a moment.", 503);
    chosen = { draft: { ...referenceExplanation(x), fixed_code: ref }, source: "reference", model: null, total: check.total };
    ctx.store.logEvent({ kind: "answer", learner_id: sub.learner_id, prompt: `answer · ${challenge.id} · submission ${sub.id} · reference`, response: `${chosen.draft.whats_wrong} [reference passed ${check.total}/${check.total} tests]`, model: null, rejected: false });
  }

  const payload: AnswerPayload = {
    ...chosen.draft,
    source: chosen.source,
    model: chosen.model,
    tests_passed: chosen.total,
    diff: lineDiff(sub.code, chosen.draft.fixed_code),
    created_at: new Date().toISOString(),
  };
  ctx.store.saveAnswer({ submission_id: sub.id, learner_id: sub.learner_id, challenge_id: sub.challenge_id, payload });
  return { submission_id: sub.id, ...payload };
}
