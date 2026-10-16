/**
 * T5 — Recurring mistakes + skills (10 pts).
 * The 11-program scripted learner over the four judge challenges, played
 * through the HTTP API. Asserts: both planted recurring mistakes are named,
 * the one-off slip is NOT, a failure repeated on one challenge counts once,
 * the next challenge targets a recurring mistake WITH a reason, and mastery
 * moves with the evidence (an unhinted pass beats a hinted one).
 */
import { SCRIPTED_LEARNER, P, type ScriptStep } from "../apps/api/src/fixtures.ts";
import { check, connect, isMain, printSuite, type Api, type Check, type SuiteResult } from "./lib.ts";

async function play(api: Api, learner: string, steps: ScriptStep[]) {
  const tags: string[][] = [];
  let last: string | null = null;
  for (const s of steps) {
    if (s.code) {
      const r = await api.post("/api/submit", { learner_id: learner, challenge_id: s.challenge, code: s.code });
      last = r.body.submission_id;
      tags.push(r.body.mistake_tags);
    } else if (last) {
      for (let i = 0; i < (s.hints ?? 1); i++) await api.post("/api/hint", { submission_id: last });
    }
  }
  return tags;
}

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  const learner = `scripted_learner_${Date.now().toString(36)}`;
  const tags = await play(api, learner, SCRIPTED_LEARNER);
  const L = (await api.get(`/api/learner/${learner}`)).body;
  const rec = new Set<string>(L.recurring_mistakes);
  check(checks, `planted A (unhandled_short_input) named recurring`, rec.has("unhandled_short_input"), `recurring=${L.recurring_mistakes}`);
  check(checks, `planted B (boundary_comparison) named recurring`, rec.has("boundary_comparison"), `recurring=${L.recurring_mistakes}`);
  check(checks, `exactly the two planted mistakes are recurring`, rec.size === 2, `recurring=${L.recurring_mistakes}`);
  check(checks, `one-off slip (print_not_return) NOT flagged recurring`, !rec.has("print_not_return") && L.one_off_mistakes.includes("print_not_return"), `one_off=${L.one_off_mistakes}`);
  check(checks, `next challenge is non-empty`, typeof L.next_challenge?.challenge_id === "string" && L.next_challenge.challenge_id.length > 0, L.next_challenge?.challenge_id);
  check(checks, `next challenge reason is non-empty and names a recurring mistake`, typeof L.next_challenge?.reason === "string" && [...rec].some((t) => L.next_challenge.reason.includes(t)), L.next_challenge?.reason);
  check(checks, `per-step tags match the plan`, JSON.stringify(tags) === JSON.stringify([[], ["unhandled_short_input"], ["unhandled_short_input"], ["unhandled_short_input"], ["boundary_comparison"], ["print_not_return"], [], ["boundary_comparison"], []]), JSON.stringify(tags));

  // Failing ONE challenge five times is one data point, not five.
  const same = `harness_same_${Date.now().toString(36)}`;
  await play(api, same, Array.from({ length: 5 }, () => ({ challenge: "last-k-total", code: P.lastKStarter })));
  const S = (await api.get(`/api/learner/${same}`)).body;
  check(checks, `5 failures on the SAME challenge → nothing recurring`, S.recurring_mistakes.length === 0 && S.one_off_mistakes.includes("unhandled_short_input"), `recurring=${S.recurring_mistakes}`);

  // Mastery moves with the evidence: an unhinted pass counts for more than a hinted pass.
  const clean = `harness_clean_${Date.now().toString(36)}`;
  const helped = `harness_helped_${Date.now().toString(36)}`;
  await play(api, clean, [{ challenge: "count-passes", code: P.countPassesCorrect }]);
  await play(api, helped, [{ challenge: "count-passes", code: P.countPassesBoundary }, { challenge: "count-passes", code: null, hints: 2 }, { challenge: "count-passes", code: P.countPassesCorrect }]);
  const C = (await api.get(`/api/learner/${clean}`)).body;
  const H = (await api.get(`/api/learner/${helped}`)).body;
  check(checks, `unhinted pass > hinted pass on the same concept (${C.mastery.conditionals} > ${H.mastery.conditionals})`, C.mastery.conditionals > H.mastery.conditionals);
  check(checks, `a clean pass raises mastery above the prior (${C.mastery.conditionals} > 0.5)`, C.mastery.conditionals > 0.5);
  check(checks, `failures pull mastery below the prior for the scripted learner's boundaries (${L.mastery.boundaries} < 0.5)`, L.mastery.boundaries < 0.5);
  check(checks, `mastery timeline has one point per submission`, Array.isArray(L.mastery_timeline) && L.mastery_timeline.length === 9);

  return {
    suite: "learner.test.ts — T5 recurring mistakes + skills",
    points: "10 pts",
    checks,
    summary: `recurring=[${L.recurring_mistakes.join(", ")}] · one-off=[${L.one_off_mistakes.join(", ")}] · next=${L.next_challenge.challenge_id}`,
    ms: Date.now() - t0,
  };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
