/**
 * Pure unit tests for @dojo/core — no sandbox, no server. Each detector has a
 * planted-bug test with the name the taxonomy promises (det_short_input …),
 * plus classifier order, the hint validator, mastery maths, recurrence
 * counting and a self-check of the whole challenge bank.
 *
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  CHALLENGES,
  allLadderTexts,
  classify,
  detect,
  findLeak,
  getChallenge,
  listedChallenges,
  masteryValue,
  nextChallenge,
  oneStepAway,
  rollup,
  submissionDelta,
  validateHint,
  type HistoryItem,
  type RunResult,
  type TestResult,
} from "../src/index.ts";

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const ok = (ret: unknown, extra: Partial<RunResult> = {}): RunResult => ({ status: "ok", ret: ret as never, stdout: "", ms: 1, ...extra });
const err = (excType: string): RunResult => ({ status: "error", excType, excMessage: "x", stdout: "", ms: 1, phase: "call" });

function results(challengeId: string, runs: RunResult[]): TestResult[] {
  const c = getChallenge(challengeId)!;
  const cases = [...c.visible.map((x) => ["visible", x] as const), ...c.hidden.map((x) => ["hidden", x] as const)];
  let v = 0, h = 0;
  return cases.map(([kind, cs], i) => {
    const run = runs[i] ?? ok(cs.expected);
    const { outcome, detail } = classify(run, cs.expected, c);
    return { kind, test: kind === "visible" ? ++v : ++h, outcome, detail, run, case: cs };
  });
}

/* ── detectors: planted bugs ── */

test("det_short_input — last_k_total starter crashes only where k > len", () => {
  const c = getChallenge("last-k-total")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(t.expected));
  runs[5] = err("IndexError"); // hidden 3: k > len
  runs[6] = ok(90);
  runs[7] = ok(15);
  assert.equal(detect(c, results(c.id, runs)).primary, "unhandled_short_input");
});

test("det_short_input — an IndexError on a NORMAL input is not 'short input'", () => {
  const c = getChallenge("last-k-total")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(t.expected));
  runs[0] = err("IndexError"); // visible 1 is not short
  assert.notEqual(detect(c, results(c.id, runs)).primary, "unhandled_short_input");
});

test("det_print_not_return — printed the right answer, returned None", () => {
  const c = getChallenge("middle-three")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(null, { stdout: JSON.stringify(t.expected).replace(/,/g, ", ") + "\n" }));
  assert.equal(detect(c, results(c.id, runs)).primary, "print_not_return");
});

test("det_mutates_input — the caller's list changed", () => {
  const c = getChallenge("second-largest")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(t.expected, { mutated: true }));
  const rs = results(c.id, runs);
  assert.equal(rs[0].outcome, "wrong_output");
  assert.equal(rs[0].detail, "input changed");
  assert.equal(detect(c, rs).primary, "mutates_input");
});

test("det_off_by_one — one square too many on ordinary inputs", () => {
  const c = getChallenge("first-n-squares")!;
  const runs = [...c.visible, ...c.hidden].map((t) => {
    const n = t.args[0] as number;
    return ok(Array.from({ length: n + 1 }, (_, i) => (i + 1) ** 2));
  });
  assert.equal(detect(c, results(c.id, runs)).primary, "off_by_one");
});

test("det_boundary_cmp — '> 40' is wrong only where a mark is exactly 40", () => {
  const c = getChallenge("count-passes")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok((t.args[0] as number[]).filter((m) => m > 40).length));
  assert.equal(detect(c, results(c.id, runs)).primary, "boundary_comparison");
});

test("det_boundary_cmp — the 'i > 0' loop misses the first mark only at k ≥ len", () => {
  const c = getChallenge("last-k-total")!;
  const f = (marks: number[], k: number) => {
    let t = 0, i = marks.length - 1, n = 0;
    while (n < k && i > 0) (t += marks[i]), i--, n++;
    return t;
  };
  const runs = [...c.visible, ...c.hidden].map((t) => ok(f(t.args[0] as number[], t.args[1] as number)));
  assert.equal(detect(c, results(c.id, runs)).primary, "boundary_comparison");
});

test("det_wrong_direction — first two instead of last two", () => {
  const c = getChallenge("bf-last-two")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok((t.args[0] as unknown[]).slice(0, 2)));
  assert.equal(detect(c, results(c.id, runs)).primary, "wrong_index_direction");
});

test("a passing submission has no tags", () => {
  const c = getChallenge("count-passes")!;
  assert.equal(detect(c, results(c.id, [])).primary, null);
});

/* ── classifier ── */

test("classifier order: wall clock beats everything; limits are named", () => {
  assert.equal(classify({ status: "killed", killedBy: "wall_clock", stdout: "", ms: 0 }, 1).outcome, "timeout");
  assert.deepEqual(classify({ status: "killed", killedBy: "memory", stdout: "", ms: 0 }, 1), { outcome: "runtime_error", detail: "memory limit" });
  assert.deepEqual(classify({ status: "killed", killedBy: "output", stdout: "", ms: 0 }, 1), { outcome: "runtime_error", detail: "output limit" });
  assert.equal(classify(err("IndexError"), 1).outcome, "runtime_error");
  assert.equal(classify(ok(70), 70).outcome, "passed");
  assert.equal(classify(ok("70"), 70).outcome, "wrong_output"); // type-aware
  assert.equal(classify(ok(true), 1).outcome, "wrong_output"); // True is not 1 here
  assert.equal(classify(ok(3), 3.0).outcome, "passed");
});

test("one-step rules", () => {
  assert.ok(oneStepAway("numeric", 1, 2, []));
  assert.ok(oneStepAway("sum", 10, 15, [[5, 5, 5], 3]));
  assert.ok(oneStepAway("list", [1, 4, 9, 16, 25, 36], [1, 4, 9, 16, 25], [5]));
  assert.ok(oneStepAway("list", [1, 2, 3], [2, 3, 1], [[1, 2, 3], 4]));
  assert.ok(oneStepAway("grade", "B", "A", [90]));
  assert.ok(!oneStepAway("numeric", 0, 3, []));
});

/* ── the guardrail ── */

test("validator: the statement's own model ladder passes", () => {
  for (const h of getChallenge("last-k-total")!.ladders.unhandled_short_input!) assert.ok(validateHint(h, { fn: "last_k_total" }).ok, h);
});

test("validator: code is rejected", () => {
  for (const bad of [
    "```python\nx = 1\n```",
    "Try total = sum(marks).",
    "Use max(0, len(marks) - k).",
    "if k > len(marks): return sum(marks)",
    "Write def last_k_total(marks, k): first.",
    "return total - 1",
    "Use marks[-k:] to slice.",
    "import math first",
    "Use marks[i] for each i.",
    "k == len(marks) is the edge",
    "lambda x: x",
  ]) {
    assert.ok(!validateHint(bad, { fn: "last_k_total" }).ok, bad);
  }
});

test("every hint the bank can serve passes the validator and leaks nothing", () => {
  for (const c of CHALLENGES) {
    for (const h of allLadderTexts(c)) {
      const v = validateHint(h, { fn: c.fn });
      assert.ok(v.ok, `${c.id}: ${v.reasons} — ${h}`);
      assert.equal(findLeak(h, c), null, `${c.id} leaks: ${h}`);
    }
  }
});

/* ── mastery + recurrence ── */

test("mastery: an unhinted pass counts for more than a hinted one", () => {
  const [clean] = submissionDelta(["boundaries"], true, false);
  const [hinted] = submissionDelta(["boundaries"], true, true);
  assert.ok(masteryValue({ alpha: 1 + clean.dAlpha, beta: 1 }) > masteryValue({ alpha: 1 + hinted.dAlpha, beta: 1 }));
});

const H = (challenge_id: string, tags: string[], at: string, passed = false): HistoryItem => ({ submission_id: at, challenge_id, at, tags: tags as never, passed, hints_used: 0 });

test("recurrence counts DISTINCT challenges, not submissions", () => {
  const five = Array.from({ length: 5 }, (_, i) => H("last-k-total", ["unhandled_short_input"], `2026-01-0${i + 1}`));
  assert.deepEqual(rollup(five).recurring, []);
  assert.deepEqual(rollup([...five, H("first-n-squares", ["unhandled_short_input"], "2026-01-09")]).recurring, ["unhandled_short_input"]);
});

test("next challenge targets the recurring mistake and the reason names it", () => {
  const h = [H("last-k-total", ["boundary_comparison"], "2026-01-01"), H("first-n-squares", ["boundary_comparison"], "2026-01-02")];
  const n = nextChallenge(h, []);
  assert.equal(n.basis, "recurring");
  assert.ok(n.reason.includes("boundary_comparison"));
  assert.ok(getChallenge(n.challenge_id)!.targets.includes("boundary_comparison"));
});

test("next challenge reason is never empty — even for a brand-new learner", () => {
  const n = nextChallenge([], []);
  assert.ok(n.challenge_id && n.reason.length > 10);
});

/* ── the bank itself ── */

test("bank: ≥10 challenges, ≥3 levels, ≥4 concepts, each ≥3 visible + ≥5 hidden", () => {
  const listed = listedChallenges();
  assert.ok(listed.length >= 10);
  assert.ok(new Set(listed.map((c) => c.difficulty)).size >= 3);
  assert.ok(new Set(listed.flatMap((c) => c.concepts)).size >= 4);
  for (const c of CHALLENGES) {
    assert.ok(c.visible.length >= 3 && c.hidden.length >= 5, c.id);
    for (const t of c.hidden) if (t.edge) assert.ok(c.edges[t.edge], `${c.id}: unknown edge ${t.edge}`);
  }
  for (const id of ["last-k-total", "count-passes", "first-n-squares", "middle-three"]) assert.ok(getChallenge(id), id);
});

test("bank: probes (public replay inputs) are never a hidden input, except trivially empty ones", () => {
  for (const c of CHALLENGES) {
    const hidden = new Set(c.hidden.map((t) => JSON.stringify(t.args)));
    const visible = new Set(c.visible.map((t) => JSON.stringify(t.args)));
    for (const [kind, args] of Object.entries(c.probes)) {
      const trivial = args.every((a) => (Array.isArray(a) && a.length === 0) || a === 0 || a === "");
      const inDescription = args.every((a) => typeof a === "number" && c.description.includes(String(a)));
      const isPublic = visible.has(JSON.stringify(args));
      assert.ok(trivial || inDescription || isPublic || !hidden.has(JSON.stringify(args)), `${c.id} probe ${kind} equals a hidden input`);
    }
  }
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} unit tests passed`);
if (process.argv[1]?.includes("unit")) process.exitCode = failed ? 1 : 0;
export const unitResult = { total: tests.length, failed };
