/**
 * Outcome labelling — a pure function, exactly one label per test.
 *
 * Decision order (fixed, so two signals can never race):
 *   1. wall clock exceeded              → timeout
 *   2. a resource limit stopped it      → runtime_error  + the limit's NAME
 *   3. sandbox policy refused something → runtime_error  + "sandbox policy"
 *   4. the learner's code raised        → runtime_error  (their exception class only)
 *   5. it changed an input it mustn't   → wrong_output   + "input changed"
 *   6. return value == expected         → passed
 *   7. otherwise                        → wrong_output
 *
 * `detail` is a FIXED vocabulary. It can never carry a hidden input, an
 * expected value, the program's output or an exception message.
 */
import { pyEqual } from "./compare.ts";
import type { Challenge, Outcome, PyValue, RunResult } from "./types.ts";

export const DETAILS = [
  "memory limit",
  "output limit",
  "disk limit",
  "cpu limit",
  "process limit",
  "recursion limit",
  "sandbox policy",
  "sandbox restart",
  "input changed",
] as const;
export type Detail = (typeof DETAILS)[number];

const LIMIT_DETAIL: Record<string, Detail> = {
  memory: "memory limit",
  output: "output limit",
  disk: "disk limit",
  cpu: "cpu limit",
  process: "process limit",
  recursion: "recursion limit",
  policy: "sandbox policy",
  crash: "sandbox restart",
};

export function classify(
  run: RunResult,
  expected: PyValue,
  challenge?: Pick<Challenge, "checkInputUnchanged">,
): { outcome: Outcome; detail?: Detail } {
  if (run.killedBy === "wall_clock") return { outcome: "timeout" };
  if (run.killedBy && LIMIT_DETAIL[run.killedBy]) {
    return { outcome: "runtime_error", detail: LIMIT_DETAIL[run.killedBy] };
  }
  if (run.status === "error" || run.status === "killed") return { outcome: "runtime_error" };
  if (challenge?.checkInputUnchanged && run.mutated) return { outcome: "wrong_output", detail: "input changed" };
  if (pyEqual(run.ret, expected)) return { outcome: "passed" };
  return { outcome: "wrong_output" };
}
