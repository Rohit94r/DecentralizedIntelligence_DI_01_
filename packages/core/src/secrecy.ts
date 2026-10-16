/**
 * Hidden-test secrecy guard.
 *
 * `hiddenLiterals()` lists every distinctive string a hidden test could leak
 * through (its inputs, its expected value, and what the learner's program
 * produced on it). `findLeak()` reports any of them appearing in outgoing
 * text — unless the same literal is already public (in the description, the
 * visible tests, the probes, or the learner's own code), in which case
 * mentioning it reveals nothing.
 *
 * Single-digit numbers are skipped: "3 of the 6 hidden tests" must stay
 * sayable, and a one-digit value is never distinctive enough to identify a test.
 */
import { pyRepr } from "./compare.ts";
import type { Challenge, PyValue, TestResult } from "./types.ts";

function literalsOf(v: PyValue | undefined, out: Set<string>, float = false): void {
  if (v === undefined || v === null || typeof v === "boolean") return;
  if (typeof v === "number") {
    if (Math.abs(v) >= 10 || !Number.isInteger(v)) out.add(pyRepr(v, { float }));
    return;
  }
  if (typeof v === "string") {
    if (v.length >= 2) out.add(v);
    return;
  }
  if (Array.isArray(v)) {
    // an empty list is a KIND of input ("an empty list"), not a secret
    const r = pyRepr(v, { float });
    if (r.length >= 3) {
      out.add(r);
      out.add(r.replace(/\s+/g, ""));
    }
    v.forEach((x) => literalsOf(x, out, float));
    return;
  }
  for (const x of Object.values(v)) literalsOf(x, out, float);
}

export function publicCorpus(challenge: Challenge, learnerCode = ""): string {
  const parts = [challenge.description, challenge.inputs, challenge.starter, learnerCode];
  for (const t of challenge.visible) parts.push(pyRepr(t.args), pyRepr(t.expected, { float: challenge.floatResult }), ...t.args.map((a) => pyRepr(a)));
  for (const p of Object.values(challenge.probes)) parts.push(pyRepr(p), ...p.map((a) => pyRepr(a)));
  return parts.join("\n");
}

export function hiddenLiterals(challenge: Challenge, results: TestResult[] = []): string[] {
  const set = new Set<string>();
  for (const t of challenge.hidden) {
    literalsOf(t.args, set);
    t.args.forEach((a) => literalsOf(a, set));
    literalsOf(t.expected, set, !!challenge.floatResult);
  }
  const trivial = new Set(["None", "True", "False", "[]", "{}", "()", "''", '""']);
  for (const r of results) {
    if (r.kind !== "hidden") continue;
    literalsOf(r.run.ret, set);
    if (r.run.repr && r.run.repr.length >= 3 && !trivial.has(r.run.repr)) set.add(r.run.repr);
    if (r.run.excMessage && r.run.excMessage.length >= 6) set.add(r.run.excMessage);
    const out = r.run.stdout.trim();
    if (out.length >= 3 && !trivial.has(out)) set.add(out.slice(0, 200));
  }
  return [...set];
}

function containsToken(text: string, lit: string): boolean {
  if (/^-?[\d.]+$/.test(lit)) return new RegExp(`(^|[^\\d.])${lit.replace(/[.]/g, "\\.")}($|[^\\d])`).test(text);
  return text.includes(lit);
}

/** Returns the first leaked literal, or null when the text is safe to send. */
export function findLeak(text: string, challenge: Challenge, results: TestResult[] = [], learnerCode = ""): string | null {
  const pub = publicCorpus(challenge, learnerCode);
  for (const lit of hiddenLiterals(challenge, results)) {
    if (!containsToken(text, lit)) continue;
    if (containsToken(pub, lit)) continue;
    return lit;
  }
  return null;
}
