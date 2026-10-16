/**
 * Shared types for the whole product. No I/O lives in @dojo/core — the API
 * injects a runner and a store, so every decision here is a pure function
 * that the unit tests can drive directly.
 */

export type Outcome = "passed" | "wrong_output" | "runtime_error" | "timeout";

/** The five required categories, plus the optional sixth the statement allows. */
export type MistakeTag =
  | "unhandled_short_input"
  | "print_not_return"
  | "mutates_input"
  | "off_by_one"
  | "boundary_comparison"
  | "wrong_index_direction";

export const MISTAKE_TAGS: MistakeTag[] = [
  "unhandled_short_input",
  "print_not_return",
  "mutates_input",
  "off_by_one",
  "boundary_comparison",
  "wrong_index_direction",
];

export type Concept =
  | "lists_indexing"
  | "loops_range"
  | "boundaries"
  | "conditionals"
  | "strings"
  | "accumulators";

export type Difficulty = "easy" | "medium" | "hard";

/** JSON-compatible Python value as it crosses the process boundary. */
export type PyValue =
  | null
  | boolean
  | number
  | string
  | PyValue[]
  | { [key: string]: PyValue };

/**
 * One test. `edge` names the KIND of input (used in explanations — the kind is
 * shown, never the values). `short` marks inputs shorter than what a naive
 * solution assumes (the `unhandled_short_input` contract).
 */
export interface TestCase {
  args: PyValue[];
  expected: PyValue;
  edge?: string | null;
  short?: boolean;
  /** Value a program with this specific mistake would produce (explicit literal). */
  alts?: Partial<Record<MistakeTag, PyValue>>;
}

export interface EdgeKind {
  /** "a case where k is larger than the number of marks" */
  one: string;
  /** "cases where k is larger than the number of marks" */
  many: string;
  /** True when this kind sits on a boundary (drives boundary_comparison vs off_by_one). */
  boundary?: boolean;
}

/**
 * How "one step away from the right answer" is measured for this challenge.
 * numeric — differs by exactly ±1 · sum — ±1 or by exactly one input element
 * list — one item missing/extra at an end, or the window shifted one place
 * grade — adjacent letter grade · bool — flipped boolean · none — never
 */
export type StepRule = "numeric" | "sum" | "list" | "grade" | "bool" | "none";

export interface Challenge {
  id: string;
  title: string;
  fn: string;
  signature: string;
  difficulty: Difficulty;
  concepts: Concept[];
  /** Plain-language task, shown to the learner. */
  description: string;
  /** Input contract, shown to the learner. */
  inputs: string;
  starter: string;
  visible: TestCase[];
  /** ██ HIDDEN — lives in API memory only. Never serialised to a client, a file, or the runner. ██ */
  hidden: TestCase[];
  edges: Record<string, EdgeKind>;
  stepRule: StepRule;
  /** Render numeric results as Python floats (3 → "3.0"). */
  floatResult?: boolean;
  /** The task forbids changing the caller's input: a mutated input is wrong_output ("input changed"). */
  checkInputUnchanged?: boolean;
  /** What the function returns, as a noun: "total", "count", "list". */
  resultNoun: string;
  /** Mechanism sentences that apply only when the learner's code matches `when` (a regex source). */
  mechanismVariants?: { tag: LadderKey; when: string; text: string }[];
  /** Mistake tags this challenge is built to exercise (drives next-challenge choice). */
  targets: MistakeTag[];
  /** Why this challenge fixes a given recurring mistake (the `reason` text). */
  targetReasons: Partial<Record<MistakeTag, string>>;
  /** Hand-written mechanism sentence per tag (Tier-1 explanation, last sentence). */
  mechanisms: Partial<Record<MistakeTag | "generic" | "timeout" | "crash", string>>;
  /** Public replay inputs per edge kind — never equal to any hidden input. */
  probes: Record<string, PyValue[]>;
  /** Hand-written hint ladders keyed by tag (or "generic"/"timeout"/"crash"). */
  ladders: Partial<Record<LadderKey, string[]>>;
  /** Bug Factory challenges only. */
  bugFactory?: { tag: MistakeTag; culpritLine: number; lesson: string };
  /** Hidden from the practice list (Bug Factory items). */
  unlisted?: boolean;
  /** Attribution for adapted content (Exercism MIT / MBPP CC BY 4.0 / HumanEval MIT). */
  source?: string;
}

export type LadderKey = MistakeTag | "generic" | "timeout" | "crash";

/** What the sandbox reports for ONE test. The child never sees `expected`. */
export interface RunResult {
  /** "ok" — function returned. "error" — raised. "killed" — a limit stopped it. */
  status: "ok" | "error" | "killed";
  ret?: PyValue;
  /** Python repr of the return value (for display on visible tests). */
  repr?: string;
  stdout: string;
  excType?: string;
  excMessage?: string;
  /** Line number inside the learner's own code where it raised. */
  excLine?: number | null;
  killedBy?: "wall_clock" | "memory" | "output" | "disk" | "cpu" | "process" | "recursion" | "policy" | "crash";
  /** Name-only detail for policy rejections (e.g. "import os"). Learner data, never hidden data. */
  policy?: string;
  mutated?: boolean;
  secondCallDiffers?: boolean;
  /** "module" — failed while loading the file (input-independent). "call" — inside the function. */
  phase?: "module" | "call";
  ms: number;
}

export interface TestResult {
  kind: "visible" | "hidden";
  test: number;
  outcome: Outcome;
  /** Fixed vocabulary ONLY: "memory limit" | "output limit" | ... — never hidden values. */
  detail?: string;
  run: RunResult;
  case: TestCase;
}

export interface VisibleRow {
  test: number;
  call: string;
  expected: string;
  got: string;
  outcome: Outcome;
}

export interface HiddenRow {
  test: number;
  outcome: Outcome;
}

export interface LineMap {
  culprit_line: number | null;
  confidence: "likely" | "very likely";
  reason: string;
  lines?: { line: number; reason: string }[];
}

export interface SubmitResponse {
  submission_id: string;
  learner_id: string;
  challenge_id: string;
  visible: VisibleRow[];
  hidden: HiddenRow[];
  mistake_tags: MistakeTag[];
  explanation: string;
  debug?: {
    culprit_line: number | null;
    confidence: "likely" | "very likely" | null;
    reason: string | null;
    trace_ref: string;
    passed: boolean;
    detail: string | null;
  };
}

export interface HintResponse {
  submission_id: string;
  hint_index: number;
  rung: number;
  hint: string;
  remaining: number;
  note?: string;
}

export interface MasteryRow {
  concept: Concept;
  alpha: number;
  beta: number;
}

export interface HistoryItem {
  submission_id: string;
  challenge_id: string;
  at: string;
  tags: MistakeTag[];
  passed: boolean;
  hints_used: number;
}

export interface NextChallenge {
  challenge_id: string;
  reason: string;
  basis: "recurring" | "weakest_concept" | "progression" | "complete";
  tag?: MistakeTag;
}
