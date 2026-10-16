/**
 * Mastery per concept — a Beta posterior.
 *
 *   prior α = 1, β = 1            (mean 0.5)
 *   pass, no hints    → α += 1.0
 *   pass, after hints → α += 0.35   ← the penalty is the point
 *   fail              → β += 0.6
 *   each hint given   → β += 0.15
 *   mastery = α / (α + β)
 *
 * So an unhinted pass counts for almost three times a hinted one, and asking
 * for help has a small, visible cost — exactly what "a pass without hints
 * counts for more" asks for, explainable in ten seconds.
 */
import type { Concept, MasteryRow } from "./types.ts";

export const MASTERY_RULES = {
  prior: { alpha: 1, beta: 1 },
  passNoHints: 1.0,
  passWithHints: 0.35,
  fail: 0.6,
  hint: 0.15,
} as const;

export const CONCEPT_LABELS: Record<Concept, string> = {
  lists_indexing: "Lists & indexing",
  loops_range: "Loops & range",
  boundaries: "Boundaries & edge cases",
  conditionals: "Conditionals",
  strings: "Strings",
  accumulators: "Accumulators",
};

export const ALL_CONCEPTS = Object.keys(CONCEPT_LABELS) as Concept[];

export interface MasteryDelta {
  concept: Concept;
  dAlpha: number;
  dBeta: number;
}

export function submissionDelta(concepts: Concept[], passed: boolean, hinted: boolean): MasteryDelta[] {
  return concepts.map((concept) =>
    passed
      ? { concept, dAlpha: hinted ? MASTERY_RULES.passWithHints : MASTERY_RULES.passNoHints, dBeta: 0 }
      : { concept, dAlpha: 0, dBeta: MASTERY_RULES.fail },
  );
}

export function hintDelta(concepts: Concept[]): MasteryDelta[] {
  return concepts.map((concept) => ({ concept, dAlpha: 0, dBeta: MASTERY_RULES.hint }));
}

export function masteryValue(row: Pick<MasteryRow, "alpha" | "beta">): number {
  return row.alpha / (row.alpha + row.beta);
}

/** Every concept, defaulting to the prior when there is no evidence yet. */
export function masteryMap(rows: MasteryRow[]): Record<Concept, number> {
  const out = {} as Record<Concept, number>;
  for (const c of ALL_CONCEPTS) {
    const r = rows.find((x) => x.concept === c);
    out[c] = Math.round(masteryValue(r ?? { alpha: MASTERY_RULES.prior.alpha, beta: MASTERY_RULES.prior.beta }) * 100) / 100;
  }
  return out;
}
