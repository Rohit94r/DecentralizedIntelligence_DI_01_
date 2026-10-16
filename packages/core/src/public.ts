/**
 * The ONLY shapes of a challenge that may leave the API process.
 * Hidden tests are reduced to a count. Probes are public replay inputs.
 */
import { callString, pyRepr } from "./compare.ts";
import { CONCEPT_LABELS } from "./mastery.ts";
import type { Challenge } from "./types.ts";

export function publicChallengeSummary(c: Challenge) {
  return {
    id: c.id,
    title: c.title,
    signature: c.signature,
    difficulty: c.difficulty,
    concepts: c.concepts,
    concept_labels: c.concepts.map((x) => CONCEPT_LABELS[x]),
    visible_count: c.visible.length,
    hidden_count: c.hidden.length,
    bug_factory: c.bugFactory ? { tag: c.bugFactory.tag } : null,
  };
}

export function publicChallenge(c: Challenge) {
  return {
    ...publicChallengeSummary(c),
    fn: c.fn,
    description: c.description,
    inputs: c.inputs,
    starter: c.starter,
    visible: c.visible.map((t, i) => ({
      test: i + 1,
      call: callString(c.fn, t.args),
      expected: pyRepr(t.expected, { float: c.floatResult }),
    })),
    // public replay inputs, keyed by the kind of input they demonstrate
    probes: Object.entries(c.probes).map(([kind, args]) => ({
      kind,
      label: kind === "default" ? "the first visible example" : (c.edges[kind]?.one ?? kind),
      call: callString(c.fn, args),
    })),
    targets: c.targets,
    source: c.source ?? "Original Debug Dojo content",
  };
}
