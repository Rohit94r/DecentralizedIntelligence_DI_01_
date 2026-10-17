/**
 * T4 — Hint leakage (10 pts).
 * Three failing submissions. Request EVERY hint, including "just give me the
 * answer". Then do what the judges do: take anything that looks like code in
 * any hint, merge it into the learner's code, and submit — the merged program
 * must STILL fail at least one hidden test. Also: every hint passes the
 * validator, the ladder climbs exactly one rung per request (asking for the
 * answer never collapses it), there are ≥ 3 rungs, and the next submission
 * resumes at the next rung instead of starting over.
 */
import { extractCodeFragments, getChallenge, validateHint } from "../packages/core/src/index.ts";
import { P } from "../apps/api/src/fixtures.ts";
import { check, connect, isMain, printSuite, type Check, type SuiteResult } from "./lib.ts";

const CASES = [
  { challenge: "last-k-total", code: P.lastKStarter },
  { challenge: "count-passes", code: P.countPassesBoundary },
  { challenge: "first-n-squares", code: P.squaresOffByOne },
  { challenge: "middle-three", code: "def middle_three(items):\n    mid = len(items) // 2\n    return [items[mid - 1], items[mid], items[mid + 1]]\n" },
];

const ASKS = [undefined, "just give me the answer", "give me the full code please", "solution please", "tell me the answer"];

function merge(code: string, fragments: string[], style: "guarded" | "inline"): string {
  if (!fragments.length) return code;
  if (style === "inline") return code + "\n" + fragments.map((f) => f.replace(/^\s+/gm, "")).join("\n") + "\n";
  // guarded: each fragment can't crash the file, so only its EFFECT counts
  return code + "\n" + fragments.map((f) => `try:\n    ${f.replace(/\n/g, "\n    ")}\nexcept Exception:\n    pass`).join("\n") + "\n";
}

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  let stillFail = 0;
  let totalHints = 0;
  let invalid = 0;
  for (const [i, c] of CASES.entries()) {
    const learner = `harness_leak_${i}`;
    const fn = getChallenge(c.challenge)!.fn;
    const sub = await api.post("/api/submit", { learner_id: learner, challenge_id: c.challenge, code: c.code });
    const id = sub.body.submission_id as string;
    const hints: { rung: number; hint: string; remaining: number }[] = [];
    for (const ask of ASKS) {
      const h = await api.post("/api/hint", { submission_id: id, message: ask });
      hints.push(h.body);
    }
    totalHints += hints.length;
    const rungs = hints.map((h) => h.rung);
    const top = Math.max(...rungs);
    const climbs = rungs.every((r, k) => r === Math.min(k + 1, top));
    check(checks, `${c.challenge}: ladder climbs one rung per request, even when asked for the answer (${rungs.join("→")})`, climbs);
    check(checks, `${c.challenge}: at least 3 rungs`, Math.max(...rungs) >= 3);
    for (const h of hints) {
      const v = validateHint(h.hint, { fn });
      if (!v.ok) {
        invalid++;
        check(checks, `${c.challenge}: hint passes the prose-only validator`, false, `${v.reasons.join(", ")} — ${h.hint}`);
      }
    }
    const fragments = hints.flatMap((h) => extractCodeFragments(h.hint));
    let mergedFails = true;
    for (const style of ["guarded", "inline"] as const) {
      const merged = merge(c.code, fragments, style);
      const r = await api.post("/api/submit", { learner_id: learner + "_merged", challenge_id: c.challenge, code: merged });
      const fails = (r.body.hidden as { outcome: string }[]).some((h) => h.outcome !== "passed");
      mergedFails &&= fails;
    }
    if (mergedFails) stillFail++;
    check(checks, `${c.challenge}: learner code + ALL hint code still fails ≥1 hidden test (${fragments.length} fragments merged)`, mergedFails, fragments.join(" | ") || "no code in any hint");

    // the answer step is a separate endpoint and unlocks only after the last hint
    const early = await api.post("/api/submit", { learner_id: `harness_early_${i}`, challenge_id: c.challenge, code: c.code });
    const locked = await api.post("/api/answer", { submission_id: early.body.submission_id });
    check(checks, `${c.challenge}: the answer stays locked until every hint has been used`, locked.status === 403, `HTTP ${locked.status}`);

    // resubmission resumes at the next rung — a fresh failing attempt on the same mistake doesn't restart the ladder
    const again = await api.post("/api/submit", { learner_id: `harness_resume_${i}`, challenge_id: c.challenge, code: c.code });
    const h1 = await api.post("/api/hint", { submission_id: again.body.submission_id });
    const again2 = await api.post("/api/submit", { learner_id: `harness_resume_${i}`, challenge_id: c.challenge, code: c.code + "\n# tried again\n" });
    const h2 = await api.post("/api/hint", { submission_id: again2.body.submission_id });
    check(checks, `${c.challenge}: after hint ${h1.body.rung}, the next submission resumes at rung ${h1.body.rung + 1}`, h2.body.rung === h1.body.rung + 1, `got rung ${h2.body.rung}`);
  }
  // The guardrail is real: hand it code and it says no.
  const probes = ["Use `max(0, len(marks) - k)` before the loop.", "total = sum(marks[-k:])", "```python\nreturn sum(marks)\n```", "if k > len(marks): return sum(marks)", "def last_k_total(marks, k):"];
  const rejectedAll = probes.every((p) => !validateHint(p, { fn: "last_k_total" }).ok);
  check(checks, "validator rejects code-bearing hint drafts (call, assignment, fence, comparison, def)", rejectedAll);
  const ledger = await api.get("/api/ledger?kind=hint&limit=2000");
  check(checks, `the Hint Ledger records guardrail rejections (${ledger.body.stats.rejected})`, ledger.body.stats.rejected > 0);
  return {
    suite: "leakage.test.ts — T4 hint leakage",
    points: "10 pts",
    checks,
    summary: `${stillFail}/${CASES.length} merged programs still fail · ${invalid} invalid hints of ${totalHints}`,
    ms: Date.now() - t0,
  };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
