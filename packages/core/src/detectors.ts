/**
 * The mistake detectors — deterministic, no LLM in the decision path.
 *
 * Each detector reads only (a) what the learner's own code did, (b) the
 * declared SHAPE of the input (`edge`, `short`), and (c) the comparison the
 * parent already made. Hidden values never leave this function: it returns a
 * tag name, nothing else.
 *
 * At most ONE primary tag per failing submission, chosen in a fixed priority
 * order so the five categories stay distinct:
 *   print_not_return > mutates_input > unhandled_short_input
 *   > (an exact known-mistake signature) > boundary_comparison > off_by_one
 */
import { oneStepAway, printedExpected, pyEqual } from "./compare.ts";
import type { Challenge, MistakeTag, TestResult } from "./types.ts";

const SHORT_INPUT_ERRORS = new Set(["IndexError", "ValueError", "TypeError", "ZeroDivisionError", "KeyError"]);

export interface Evidence {
  test: TestResult;
  tags: MistakeTag[];
  /** For one-step failures: did it happen on a boundary input? */
  atBoundary?: boolean;
}

/** det_print_not_return — printed the right value, returned None. */
export function detPrintNotReturn(r: TestResult, challenge: Pick<Challenge, "floatResult">): boolean {
  return (
    r.outcome !== "passed" &&
    r.run.status === "ok" &&
    (r.run.ret === null || r.run.ret === undefined) &&
    printedExpected(r.run.stdout, r.case.expected, !!challenge.floatResult)
  );
}

/** det_mutates_input — the input changed after the call, or a second identical call disagreed. */
export function detMutatesInput(r: TestResult): boolean {
  return r.run.status === "ok" && (!!r.run.mutated || !!r.run.secondCallDiffers);
}

/** det_short_input — IndexError/TypeError/… AND the input is shorter than the contract assumes. */
export function detShortInput(r: TestResult): boolean {
  return (
    r.outcome === "runtime_error" &&
    r.run.status === "error" &&
    !r.run.killedBy &&
    r.run.phase !== "module" &&
    !!r.run.excType &&
    SHORT_INPUT_ERRORS.has(r.run.excType) &&
    !!r.case.short
  );
}

/** det_off_by_one / det_boundary_cmp share the one-step test; the edge decides which. */
export function detOneStep(r: TestResult, challenge: Challenge): { step: boolean; atBoundary: boolean } {
  if (r.outcome !== "wrong_output" || r.run.status !== "ok") return { step: false, atBoundary: false };
  const step = oneStepAway(challenge.stepRule, r.run.ret, r.case.expected, r.case.args);
  const edge = r.case.edge ? challenge.edges[r.case.edge] : undefined;
  return { step, atBoundary: !!edge?.boundary };
}

/** A known-mistake signature: the result equals what that exact mistake produces (explicit literal). */
export function detSignature(r: TestResult, tag: MistakeTag): boolean {
  const alt = r.case.alts?.[tag];
  return r.outcome === "wrong_output" && alt !== undefined && pyEqual(r.run.ret, alt);
}

export interface Detection {
  primary: MistakeTag | null;
  /** Every tag that had evidence (for the dashboard's "also seen" line). */
  candidates: MistakeTag[];
  /** Tests that carry the primary tag's evidence (drives the Line Map + the explanation's kind sentence). */
  evidence: TestResult[];
}

export function detect(challenge: Challenge, results: TestResult[]): Detection {
  const failing = results.filter((r) => r.outcome !== "passed");
  if (!failing.length) return { primary: null, candidates: [], evidence: [] };

  const pnr = results.filter((r) => detPrintNotReturn(r, challenge));
  const mut = results.filter(detMutatesInput);
  const short = results.filter(detShortInput);

  const sigTags = new Set<MistakeTag>();
  for (const r of results) for (const t of Object.keys(r.case.alts ?? {}) as MistakeTag[]) sigTags.add(t);
  const sigs = new Map<MistakeTag, TestResult[]>();
  const wrongOutputs = results.filter((r) => r.outcome === "wrong_output");
  for (const tag of sigTags) {
    const hits = results.filter((r) => detSignature(r, tag));
    const strong = hits.length >= 2 || (hits.length >= 1 && hits.length === wrongOutputs.length);
    if (strong) sigs.set(tag, hits);
  }

  const steps = results.map((r) => ({ r, ...detOneStep(r, challenge) })).filter((x) => x.step);
  const nonBoundarySteps = steps.filter((x) => !x.atBoundary).map((x) => x.r);
  const boundarySteps = steps.filter((x) => x.atBoundary).map((x) => x.r);

  const ordered: [MistakeTag, TestResult[]][] = [];
  if (pnr.length) ordered.push(["print_not_return", pnr]);
  if (mut.length) ordered.push(["mutates_input", mut]);
  if (short.length) ordered.push(["unhandled_short_input", short]);
  for (const [tag, hits] of sigs) ordered.push([tag, hits]);
  if (nonBoundarySteps.length) ordered.push(["off_by_one", [...nonBoundarySteps, ...boundarySteps]]);
  else if (boundarySteps.length) ordered.push(["boundary_comparison", boundarySteps]);

  const candidates = [...new Set(ordered.map(([t]) => t))];
  if (!ordered.length) return { primary: null, candidates: [], evidence: failing };
  const [primary, evidence] = ordered[0];
  return { primary, candidates, evidence };
}
