/**
 * The mistake taxonomy — hand-in #3. One source of truth for TAXONOMY.md,
 * GET /api/taxonomy and the /taxonomy page.
 */
import type { MistakeTag } from "./types.ts";

export interface TaxonomyEntry {
  tag: MistakeTag;
  label: string;
  optional?: boolean;
  rule: string;
  signals: string;
  example: string;
  exampleChallenge: string;
  unitTest: string;
  color: string;
}

export const TAXONOMY: TaxonomyEntry[] = [
  {
    tag: "unhandled_short_input",
    label: "Unhandled short input",
    rule: "The learner's own code raised IndexError / ValueError / TypeError / ZeroDivisionError / KeyError on a test whose input is declared SHORTER than the contract assumes (empty list, k > len, n = 0, fewer than three items).",
    signals: "exception class name + the test's declared input shape — never the expected output",
    example: "for i in range(len(marks) - k, len(marks)):   # k > len → negative index → IndexError",
    exampleChallenge: "last-k-total",
    unitTest: "det_short_input",
    color: "#c64e27",
  },
  {
    tag: "print_not_return",
    label: "Print, not return",
    rule: "The function returned None, and what it printed during the call equals the expected value.",
    signals: "return value is None + captured stdout of the call",
    example: "print(total)   # …and no return statement",
    exampleChallenge: "bf-average",
    unitTest: "det_print_not_return",
    color: "#0586d2",
  },
  {
    tag: "mutates_input",
    label: "Mutates its input",
    rule: "The arguments differ from a deep snapshot taken before the call, or a second identical call (on a fresh copy) returns something different.",
    signals: "before/after snapshot of the arguments inside the sandbox + a repeated call",
    example: "nums.sort()   # sorts the caller's list in place",
    exampleChallenge: "second-largest",
    unitTest: "det_mutates_input",
    color: "#7B35F0",
  },
  {
    tag: "off_by_one",
    label: "Off by one",
    rule: "The result is exactly one step from the correct one (±1, one element too many/few, the window shifted one place) on at least one input that is NOT at a boundary.",
    signals: "one-step comparison + the test's declared edge kind",
    example: "for i in range(1, n + 2):   # one square too many for every n",
    exampleChallenge: "first-n-squares",
    unitTest: "det_off_by_one",
    color: "#359462",
  },
  {
    tag: "boundary_comparison",
    label: "Boundary comparison",
    rule: "The result is exactly one step from the correct one ONLY on inputs at a declared boundary (k = len, k > len, n = 0, a mark of exactly 40, fewer than three items, empty list) — every non-boundary input passes.",
    signals: "one-step comparison restricted to boundary inputs, or a known boundary-bug signature",
    example: "if m > 40:   # a mark of exactly 40 is a pass",
    exampleChallenge: "count-passes",
    unitTest: "det_boundary_cmp",
    color: "#f59e0b",
  },
  {
    tag: "wrong_index_direction",
    label: "Wrong index direction (optional 6th)",
    optional: true,
    rule: "The result equals what the same computation gives from the OTHER end of the input (first k instead of last k), on ≥2 tests or on every wrong-output test.",
    signals: "explicit per-test signature literals declared in the challenge bank",
    example: "return items[:2]   # first two, not last two",
    exampleChallenge: "bf-last-two",
    unitTest: "det_wrong_direction",
    color: "#ec4899",
  },
];

export const TAG_LABELS: Record<MistakeTag, string> = Object.fromEntries(TAXONOMY.map((t) => [t.tag, t.label])) as Record<
  MistakeTag,
  string
>;

export const RECURRENCE_RULE =
  "A tag is RECURRING only when it appears in at least two DIFFERENT challenge ids for the same learner. Failing one challenge five times is one data point, not five. One-off slips are never flagged.";

export const PRIORITY_RULE =
  "At most one primary tag per failing submission, chosen in a fixed order so categories stay distinct: print_not_return › mutates_input › unhandled_short_input › exact known-mistake signature › boundary_comparison › off_by_one.";
