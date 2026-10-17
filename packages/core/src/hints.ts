/**
 * The hint ladder and its guardrail.
 *
 * "No hint may contain code" is ENFORCED here, not requested in a prompt:
 * every hint — hand-written, contextual draft, or LLM-written — goes through
 * `validateHint()` at storage time. A hint that trips it is rejected, logged
 * (the Hint Ledger counts rejections), and replaced by a safe rung.
 *
 * Rungs: 1 nudge → 2 your line → 3 why it breaks (never code). After the third
 * hint the answer step unlocks — a separate endpoint (answer.ts), never a hint.
 * Asking for the answer advances exactly one rung — it never collapses.
 */
import type { Challenge, LadderKey, MistakeTag } from "./types.ts";

export const RUNG_NAMES = ["", "nudge", "your line", "why it breaks"] as const;

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

const LITERAL_ARGS = /^[\s\d\-+.,'"\[\]a-zA-Z_]*$/;

/**
 * Reject anything that reads as code. Allowed: prose, a line number, naming a
 * built-in in words, a worked-by-hand example call of THE CHALLENGE'S OWN
 * function on literal values (`last_k_total([2, 5], 3)`), and a subscript with
 * a literal index (`marks[-1]`) — both straight from the statement's own model
 * ladder, neither of which moves a learner closer to a passing program.
 */
export function validateHint(text: string, opts: { fn?: string } = {}): ValidationResult {
  const reasons: string[] = [];
  const t = text;
  if (/```/.test(t)) reasons.push("code fence");
  if (/^\s*(def|class|return|import|from|for|while|if|elif|else|try|except|with|lambda)\b/m.test(t)) reasons.push("statement keyword at line start");
  if (/\bdef\s+[A-Za-z_]\w*\s*\(/.test(t)) reasons.push("function definition");
  if (/\blambda\b/.test(t)) reasons.push("lambda");
  if (/\bimport\s+[A-Za-z_]/.test(t) || /\bfrom\s+[A-Za-z_][\w.]*\s+import\b/.test(t)) reasons.push("import");
  // "return total - 1" / "return sum(x)" / ": return" are code; "what should it return when…" is prose.
  if (/:\s*return\b/.test(t) || /\breturn\s+(None|True|False|-?\d+\b|[A-Za-z_]\w*\s*[+\-*/%(\[.])/.test(t)) {
    reasons.push("return statement");
  }
  if (/(\+=|-=|\*=|\/=|%=)/.test(t)) reasons.push("augmented assignment");
  if (/\b[A-Za-z_]\w*(\[[^\]]*\])?\s*=(?!=)\s*\S/.test(t)) reasons.push("assignment");
  if (/==|!=|<=|>=|->/.test(t)) reasons.push("comparison operator");
  if (/[A-Za-z_\d)\]]\s*[<>]\s*[A-Za-z_\d(\[-]/.test(t)) reasons.push("comparison operator");
  // arithmetic between names/numbers: "n - 1", "total + x", "k%n" — words like "minus" are fine
  if (/\b[A-Za-z_]\w*\s+[+\-*/%]\s+([A-Za-z_]\w*|\d+)\b/.test(t) || /\b([A-Za-z_]\w*|\d+)[+\-*/%]\d+\b/.test(t)) {
    reasons.push("arithmetic expression");
  }
  if (/\[[^\]]*:[^\]]*\]/.test(t)) reasons.push("slice");
  // call-like tokens: name( with no space — prose parentheses have a space before them
  for (const m of t.matchAll(/([A-Za-z_][\w.]*)\(([^)]*)\)?/g)) {
    const name = m[1];
    const args = m[2] ?? "";
    const allowed = !!opts.fn && name === opts.fn && LITERAL_ARGS.test(args) && !/[A-Za-z_]\w*\s*\(/.test(args);
    if (!allowed) {
      reasons.push(`call ${name}(`);
      break;
    }
  }
  // subscripts are allowed only with a literal integer index
  for (const m of t.matchAll(/[A-Za-z_]\w*\[([^\]]*)\]/g)) {
    if (!/^\s*-?\d+\s*$/.test(m[1])) {
      reasons.push("subscript");
      break;
    }
  }
  if (/;\s*[A-Za-z_]/.test(t) && /[A-Za-z_]\w*\s*=/.test(t)) reasons.push("statement separator");
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** Pull every code-looking fragment out of a hint (used by the leakage test's "merge" step). */
export function extractCodeFragments(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/`([^`]+)`/g)) out.push(m[1]);
  for (const m of text.matchAll(/[A-Za-z_][\w.]*\([^)]*\)/g)) out.push(m[0]);
  for (const m of text.matchAll(/[A-Za-z_]\w*\[[^\]]*\]/g)) out.push(m[0]);
  for (const m of text.matchAll(/```[\s\S]*?```/g)) out.push(m[0].replace(/```\w*/g, ""));
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

const ANSWER_REQUEST = /\b(give|tell|show|send|write)\b.*\b(answer|solution|code|fix)\b|\bjust tell me\b|\bsolution please\b|\banswer please\b|\bfull code\b|\bsolve it\b|\bwhat'?s the answer\b/i;

export function isAnswerRequest(message?: string): boolean {
  return !!message && ANSWER_REQUEST.test(message);
}

/** Generic ladders, used when a challenge has no hand-written ladder for that key. */
export const GENERIC_LADDERS: Record<LadderKey, string[]> = {
  // used only when the syntax doctor can't read the line; normally the ladder is built from its diagnosis
  syntax: [
    "Python couldn't read your code, so not a single test could run. Read the error name and the line it points to.",
    "Look at the end of that line first: a line that starts a block needs a colon, and every bracket and quote mark must be closed.",
    "Lines that start a block — if, elif, else, for, while, def — end with a colon, and the lines inside them move in by four spaces.",
  ],
  unhandled_short_input: [
    "Your visible examples all have enough items. What should happen when the input is shorter than that?",
    "Work through your function by hand on the shortest input allowed. Which step fails?",
    "Reading a position that doesn't exist raises an error, so a short input needs its own path.",
    "Check the length first and handle the short case before the main work.",
  ],
  print_not_return: [
    "Look at what your function hands back, not what it shows on the screen. Are those the same thing?",
    "The tests only see the value your function gives back. What does a Python function give back if it never says what to give?",
    "A function that finishes without handing a value back gives back None, and the tests compare that None with the right answer.",
    "Python has a keyword that ends a function and hands a value back to the caller. Use it where you currently print.",
  ],
  mutates_input: [
    "After your function runs, look at the list you passed in. Is it exactly as it was?",
    "Call your function on a list, then print that same list afterwards. What changed?",
    "Your function receives the caller's own list, not a copy, so changing it changes theirs too.",
    "Build your answer in a new list and leave the one you were given untouched.",
  ],
  off_by_one: [
    "Your answer is off by exactly one step. Count how many times your loop runs for the first visible example.",
    "Write down every position or number your loop visits for a small input. Is one missing, or is there one extra?",
    "A range stops just before its second number, so the stop you choose decides whether the last step happens.",
    "Decide whether the end value should be included, then set the stop of your range to match.",
  ],
  boundary_comparison: [
    "Your function is right except at an edge. Which inputs sit exactly on a boundary?",
    "Work out by hand what your code does for the smallest or edge-most input allowed.",
    "A comparison that leaves out its own boundary value, or includes it by mistake, changes the answer exactly at the edge.",
    "Decide whether the boundary value itself belongs, and make your comparison say exactly that.",
  ],
  wrong_index_direction: [
    "Check which end of the input your answer comes from.",
    "For the first visible example, write out the items you use. Are they from the start or the end?",
    "Counting from the end means a window that finishes at the last item and stretches backwards.",
    "Python lets a slice start counting from the end when the starting position is negative.",
  ],
  timeout: [
    "Your function never finishes on at least one test. Which loop could keep running forever?",
    "Look at the condition that should stop your loop. Does anything inside the loop change it?",
    "A loop only ends when its condition becomes false, so something in the body has to move it towards the end on every pass.",
    "Make sure the value you test moves one step closer to the stopping point each time round.",
  ],
  crash: [
    "Your function stops with an error on some inputs. Run the first failing visible example and read the error name.",
    "The error name tells you the kind of problem. Which line does it point at, and what value is that line working with?",
    "Errors usually mean a value isn't what that line expects, so check the types and sizes of what reaches it.",
    "Handle the kind of input that triggers the error before the line that fails.",
  ],
  generic: [
    "Pick the first failing visible example and work it out by hand. What should the answer be?",
    "Now follow your code line by line on that same example. Where does it first differ from your hand calculation?",
    "The hidden tests include edge cases — empty or very short inputs, and values sitting on a boundary. Decide what each should give.",
    "Compare your function against the task sentence by sentence; one of its rules isn't in your code yet.",
  ],
};

export function ladderKeyFor(tag: MistakeTag | null, outcomes: { timeout: boolean; crash: boolean }): LadderKey {
  if (tag) return tag;
  if (outcomes.timeout) return "timeout";
  if (outcomes.crash) return "crash";
  return "generic";
}

export function ladderFor(challenge: Challenge, key: LadderKey): string[] {
  const own = challenge.ladders[key];
  if (own && own.length >= 3) return own;
  return GENERIC_LADDERS[key];
}

/** Every hint text the bank can ever serve (hand-written + generic). Used by self-checks. */
export function allLadderTexts(challenge: Challenge): string[] {
  const keys = Object.keys(GENERIC_LADDERS) as LadderKey[];
  return keys.flatMap((k) => ladderFor(challenge, k));
}
