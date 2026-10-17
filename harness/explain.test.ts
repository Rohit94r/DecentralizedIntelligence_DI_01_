/**
 * T6 — Explanations + hints (15 pts, blind-rated by two judges).
 * Prints five failure explanations and four full hint ladders on one screen
 * so the team can rate them COLD, 0–2 on: correct · specific · not-a-giveaway.
 * Anything averaging < 1.5 gets rewritten. Automated floor checks run too:
 * no hidden literal, names the kind of input, no code fence, ≤ 4 sentences.
 */
import { HINT_RUNGS, findLeak, getChallenge } from "../packages/core/src/index.ts";
import { P } from "../apps/api/src/fixtures.ts";
import { check, connect, isMain, printSuite, type Check, type SuiteResult } from "./lib.ts";

const FAILURES = [
  { challenge: "last-k-total", code: P.lastKStarter, label: "Yash's starter (k larger than the list)" },
  { challenge: "count-passes", code: P.countPassesBoundary, label: "> 40 instead of >= 40" },
  { challenge: "first-n-squares", code: P.squaresOffByOne, label: "range(1, n + 2)" },
  { challenge: "middle-three", code: P.middlePrints, label: "prints instead of returning" },
  { challenge: "second-largest", code: "def second_largest(nums):\n    nums.sort()\n    return nums[-2]\n", label: "sorts the caller's list in place" },
];

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  const quiet = process.argv.includes("--quiet");
  if (!quiet) console.log("\n┌─ BLIND-RATING SHEET — rate each 0–2 on: correct · specific · not-a-giveaway ─────────────");
  for (const [i, f] of FAILURES.entries()) {
    const r = await api.post("/api/submit", { learner_id: `harness_explain_${i}`, challenge_id: f.challenge, code: f.code });
    const text: string = r.body.explanation;
    const c = getChallenge(f.challenge)!;
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    const kinds = Object.values(c.edges).flatMap((e) => [e.one, e.many]);
    const ok =
      !findLeak(text, c, [], f.code) && !text.includes("```") && sentences <= 4 && (kinds.some((k) => text.includes(k)) || /ordinary input|before the tests|gets None back/.test(text));
    check(checks, `explanation ${i + 1} (${f.challenge}) — safe, names the kind, ≤ 4 sentences`, ok, ok ? undefined : text);
    if (!quiet) {
      console.log(`│\n│ ${i + 1}. ${f.challenge} — ${f.label}   [tags: ${r.body.mistake_tags.join(", ") || "none"} · culprit line ${r.body.debug?.culprit_line ?? "—"}]`);
      console.log(`│    “${text}”`);
    }
    if (i < 4) {
      const ladder: string[] = [];
      for (let k = 0; k < HINT_RUNGS; k++) ladder.push((await api.post("/api/hint", { submission_id: r.body.submission_id, message: k === 2 ? "just tell me the answer" : undefined })).body.hint);
      if (!quiet) ladder.forEach((h, k) => console.log(`│      rung ${k + 1}: ${h}`));
      check(checks, `ladder ${i + 1} (${f.challenge}) — ${HINT_RUNGS} distinct hints (≥ 3)`, HINT_RUNGS >= 3 && new Set(ladder).size === HINT_RUNGS);
    }
  }
  if (!quiet) console.log("└────────────────────────────────────────────────────────────────────────────────────────────");
  return { suite: "explain.test.ts — T6 explanations + hints (self-rating sheet)", points: "15 pts, human-rated", checks, summary: "5 explanations + 4 ladders printed for blind rating", ms: Date.now() - t0 };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
