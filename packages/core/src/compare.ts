/**
 * Value helpers. All comparison happens HERE, in the parent process — the
 * sandbox only ever reports what the learner's code produced. Comparing on
 * plain JSON data (not on live Python objects) is what makes "return an
 * object whose __eq__ always says True" useless as a trick.
 */
import type { PyValue, StepRule } from "./types.ts";

const FLOAT_EPS = 1e-9;

function isMarker(v: PyValue): v is { [key: string]: PyValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Strict-ish structural equality with Python semantics for numbers (3 == 3.0, True != 1). */
export function pyEqual(a: PyValue | undefined, b: PyValue | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return a === b;
  if (typeof a === "boolean" || typeof b === "boolean") return a === b;
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b;
    return Math.abs(a - b) <= FLOAT_EPS * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => pyEqual(x, b[i]));
  }
  if (isMarker(a) && isMarker(b)) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && pyEqual(a[k], b[k]));
  }
  return false;
}

function reprString(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return quote + out + quote;
}

/** Python's repr() of a JSON-shaped value, so `call` / `expected` read exactly like Python. */
export function pyRepr(v: PyValue | undefined, opts: { float?: boolean } = {}): string {
  if (v === undefined) return "None";
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") {
    if (opts.float && Number.isInteger(v)) return v.toFixed(1);
    return String(v);
  }
  if (typeof v === "string") return reprString(v);
  if (Array.isArray(v)) return "[" + v.map((x) => pyRepr(x, opts)).join(", ") + "]";
  if ("$repr" in v && typeof v.$repr === "string") return v.$repr;
  if ("$set" in v && Array.isArray(v.$set)) return v.$set.length ? "{" + v.$set.join(", ") + "}" : "set()";
  if ("$float" in v) return String(v.$float);
  if ("$bigint" in v) return String(v.$bigint);
  return "{" + Object.entries(v).map(([k, x]) => `${reprString(k)}: ${pyRepr(x, opts)}`).join(", ") + "}";
}

export function callString(fn: string, args: PyValue[]): string {
  return `${fn}(${args.map((a) => pyRepr(a)).join(", ")})`;
}

const GRADES = ["A", "B", "C", "D", "F"];

function listSlice(a: PyValue[], s: number, e?: number): PyValue[] {
  return a.slice(s, e);
}

/**
 * Is `actual` exactly one step away from `expected`? This is the heart of the
 * off_by_one / boundary_comparison detectors. The rule is chosen per
 * challenge because "one step" means different things for a count, a total,
 * a list or a grade.
 */
export function oneStepAway(rule: StepRule, actual: PyValue | undefined, expected: PyValue, args: PyValue[]): boolean {
  if (actual === undefined) return false;
  switch (rule) {
    case "none":
      return false;
    case "numeric":
      return isNum(actual) && isNum(expected) && Math.abs(actual - expected) === 1;
    case "sum": {
      if (!isNum(actual) || !isNum(expected)) return false;
      const diff = Math.abs(actual - expected);
      if (diff === 1) return true;
      const first = args.find(Array.isArray) as PyValue[] | undefined;
      return !!first && diff !== 0 && first.some((x) => isNum(x) && x !== 0 && Math.abs(x) === diff);
    }
    case "grade":
      return (
        typeof actual === "string" &&
        typeof expected === "string" &&
        GRADES.includes(actual) &&
        GRADES.includes(expected) &&
        Math.abs(GRADES.indexOf(actual) - GRADES.indexOf(expected)) === 1
      );
    case "bool":
      return typeof actual === "boolean" && typeof expected === "boolean" && actual !== expected;
    case "list": {
      if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
      const [short, long] = actual.length < expected.length ? [actual, expected] : [expected, actual];
      if (long.length - short.length === 1) {
        return pyEqual(short, listSlice(long, 0, short.length)) || pyEqual(short, listSlice(long, 1));
      }
      if (actual.length === expected.length && actual.length > 1) {
        return (
          pyEqual(listSlice(actual, 1), listSlice(expected, 0, -1)) ||
          pyEqual(listSlice(actual, 0, -1), listSlice(expected, 1))
        );
      }
      return false;
    }
  }
}

function isNum(v: PyValue | undefined): v is number {
  return typeof v === "number";
}

/**
 * Did the program PRINT the right answer instead of returning it?
 * Numbers are compared numerically (Python prints 3.0, our literal may be 3).
 */
export function printedExpected(stdout: string, expected: PyValue, float = false): boolean {
  if (expected === null) return false;
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return false;
  const last = lines[lines.length - 1];
  const whole = lines.join(" ");
  if (typeof expected === "number") {
    const n = Number(last);
    return Number.isFinite(n) && pyEqual(n, expected);
  }
  const norm = (s: string) => s.replace(/\s+/g, "");
  const target = norm(pyRepr(expected, { float }));
  const alt = typeof expected === "string" ? norm(expected) : null;
  return norm(last) === target || norm(whole) === target || (alt !== null && (norm(last) === alt || norm(whole) === alt));
}
