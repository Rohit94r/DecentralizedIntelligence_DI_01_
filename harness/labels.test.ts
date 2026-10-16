/**
 * T2 — Outcome labels (part of 15 pts).
 * Four behaviours × three judge challenges — pass / wrong output / error /
 * forever — with EVERY test's label pinned, visible and hidden. Plus the
 * reference-solution proof: each challenge's correct solution passes all of
 * its own tests, so every explicit hidden literal in the bank is right.
 */
import { CHALLENGES, type Outcome } from "../packages/core/src/index.ts";
import { REFERENCE } from "../packages/core/src/reference.ts";
import { check, connect, isMain, printSuite, type Check, type SuiteResult } from "./lib.ts";

const p = "passed", w = "wrong_output", e = "runtime_error", t = "timeout";
const all = (o: Outcome, n: number): Outcome[] => Array(n).fill(o);

export const LABEL_CORPUS: { n: number; challenge: string; behaviour: string; code: string; visible: Outcome[]; hidden: Outcome[] }[] = [
  // ── last-k-total ──
  { n: 1, challenge: "last-k-total", behaviour: "correct", code: REFERENCE["last-k-total"], visible: all(p, 3), hidden: all(p, 6) },
  {
    n: 2, challenge: "last-k-total", behaviour: "return total - 1", visible: all(w, 3), hidden: all(w, 6),
    code: "def last_k_total(marks, k):\n    total = sum(marks[max(0, len(marks) - k):])\n    return total - 1\n",
  },
  {
    n: 3, challenge: "last-k-total", behaviour: "the starter (unguarded index)", visible: [p, p, p], hidden: [p, p, e, w, w, p],
    code: "def last_k_total(marks, k):\n    total = 0\n    for i in range(len(marks) - k, len(marks)):\n        total += marks[i]\n    return total\n",
  },
  { n: 4, challenge: "last-k-total", behaviour: "while True: pass", code: "def last_k_total(marks, k):\n    while True:\n        pass\n", visible: all(t, 3), hidden: all(t, 6) },
  // ── count-passes ──
  { n: 5, challenge: "count-passes", behaviour: "correct", code: REFERENCE["count-passes"], visible: all(p, 3), hidden: all(p, 6) },
  {
    n: 6, challenge: "count-passes", behaviour: "> 40 instead of >= 40", visible: [w, p, p], hidden: [p, w, p, w, p, w],
    code: "def count_passes(marks):\n    count = 0\n    for m in marks:\n        if m > 40:\n            count += 1\n    return count\n",
  },
  { n: 7, challenge: "count-passes", behaviour: "infinite recursion (pinned: RecursionError → runtime_error)", code: "def count_passes(marks):\n    return count_passes(marks)\n", visible: all(e, 3), hidden: all(e, 6) },
  { n: 8, challenge: "count-passes", behaviour: "loops forever", code: "def count_passes(marks):\n    n = 0\n    while n >= 0:\n        n += 1\n    return n\n", visible: all(t, 3), hidden: all(t, 6) },
  // ── first-n-squares ──
  { n: 9, challenge: "first-n-squares", behaviour: "correct", code: REFERENCE["first-n-squares"], visible: all(p, 3), hidden: all(p, 6) },
  {
    n: 10, challenge: "first-n-squares", behaviour: "range(1, n + 2)", visible: all(w, 3), hidden: all(w, 6),
    code: "def first_n_squares(n):\n    squares = []\n    for i in range(1, n + 2):\n        squares.append(i * i)\n    return squares\n",
  },
  {
    n: 11, challenge: "first-n-squares", behaviour: "writes past the end (IndexError)", visible: all(e, 3), hidden: [p, e, e, e, e, e],
    code: "def first_n_squares(n):\n    squares = []\n    for i in range(1, n + 1):\n        squares[i - 1] = i * i\n    return squares\n",
  },
  {
    n: 12, challenge: "first-n-squares", behaviour: "big allocation, then loops forever", visible: all(t, 3), hidden: all(t, 6),
    code: "def first_n_squares(n):\n    big = [0] * (10 ** 7)\n    while True:\n        big[0] += 1\n",
  },
];

/** Extra pinned contracts (not part of the 12, run anyway). */
export const EXTENDED: typeof LABEL_CORPUS = [
  {
    n: 13, challenge: "first-n-squares", behaviour: "prints instead of returns (pinned: graded on the RETURN value → wrong_output)", visible: all(w, 3), hidden: all(w, 6),
    code: "def first_n_squares(n):\n    print([i * i for i in range(1, n + 1)])\n",
  },
  {
    n: 14, challenge: "count-passes", behaviour: "range(1, len(marks)) skips the first mark", visible: [w, p, w], hidden: [p, w, p, w, p, p],
    code: "def count_passes(marks):\n    count = 0\n    for i in range(1, len(marks)):\n        if marks[i] >= 40:\n            count += 1\n    return count\n",
  },
  {
    n: 15, challenge: "middle-three", behaviour: "the starter (no short-list guard)", visible: all(p, 3), hidden: [e, e, e, p, p, p],
    code: "def middle_three(items):\n    mid = len(items) // 2\n    return [items[mid - 1], items[mid], items[mid + 1]]\n",
  },
  { n: 16, challenge: "middle-three", behaviour: "syntax error", code: "def middle_three(items)\n    return items\n", visible: all(e, 3), hidden: all(e, 6) },
];

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  let exact = 0;
  for (const c of [...LABEL_CORPUS, ...EXTENDED]) {
    const r = await api.post("/api/submit", { learner_id: "harness_labels", challenge_id: c.challenge, code: c.code });
    const got = { visible: (r.body?.visible ?? []).map((x: { outcome: Outcome }) => x.outcome), hidden: (r.body?.hidden ?? []).map((x: { outcome: Outcome }) => x.outcome) };
    const ok = r.status === 200 && JSON.stringify(got.visible) === JSON.stringify(c.visible) && JSON.stringify(got.hidden) === JSON.stringify(c.hidden);
    if (ok && c.n <= 12) exact++;
    check(checks, `#${c.n} ${c.challenge}: ${c.behaviour}`, ok, ok ? undefined : `expected v=${c.visible} h=${c.hidden} · got v=${got.visible} h=${got.hidden}`);
    const keysOk = (r.body?.hidden ?? []).every((h: object) => Object.keys(h).sort().join() === "outcome,test");
    if (!keysOk) check(checks, `#${c.n} hidden rows carry only {test, outcome}`, false);
  }
  // Every reference solution passes every one of its own tests → the hidden literals are right.
  let refs = 0;
  for (const ch of CHALLENGES) {
    const r = await api.post("/api/submit", { learner_id: "harness_reference", challenge_id: ch.id, code: REFERENCE[ch.id] });
    const outs = [...(r.body?.visible ?? []), ...(r.body?.hidden ?? [])].map((x: { outcome: Outcome }) => x.outcome);
    const ok = outs.length === ch.visible.length + ch.hidden.length && outs.every((o) => o === "passed");
    if (ok) refs++;
    else check(checks, `reference solution passes ${ch.id}`, false, outs.join(","));
  }
  check(checks, `reference solutions pass all their own tests (${refs}/${CHALLENGES.length})`, refs === CHALLENGES.length);
  return { suite: "labels.test.ts — T2 outcome labels", points: "15 pts with secrecy", checks, summary: `${exact}/12 labels exact`, ms: Date.now() - t0 };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
