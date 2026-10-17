/**
 * AI-written hints — specific to the learner's OWN code, still never code.
 *
 * The hand-written ladders are good for the code we expected; a learner (or a
 * judge) who writes the same bug a different way gets hints that don't quite
 * fit. So when a chat model is configured, each rung is written fresh from the
 * learner's actual code, the PUBLIC test results, the KIND of hidden input that
 * fails (never its values), the Line Map and the hints already shown.
 *
 * Every draft must pass acceptHint() — the same prose-only validator and leak
 * check as every other hint. One rejected draft gets one retry (told why);
 * after that the hand-written rung ships. The model never sees a hidden value,
 * so it cannot leak one.
 *
 * Three rungs: nudge → your line → why it breaks. All prose, so pasting every
 * hint into the program still can't make it pass. The full fix lives in the
 * answer step (answer.ts), which unlocks after the third hint.
 */
import { plainRule, tagLabel } from "./mentor.ts";
import { findLeak } from "./secrecy.ts";
import { validateHint } from "./hints.ts";
import type { Challenge, LadderKey, LineMap, MistakeTag } from "./types.ts";

export interface HintContext {
  challenge: Challenge;
  code: string;
  /** 1..3 */
  rung: number;
  ladderKey: LadderKey;
  tag: MistakeTag | null;
  lineMap: LineMap | null;
  /** the already-safe Tier-1 explanation the learner has seen */
  explanation: string;
  /** visible tests only — public */
  visible: { call: string; expected: string; got: string; outcome: string }[];
  /** "a case where k is larger than the number of marks" — the kind, never the values */
  failingKinds: string[];
  /** hints already shown on this ladder, oldest first */
  previous: string[];
  /** the hand-written rung — the level of reveal to match */
  draft: string;
}

export interface HintWriter {
  readonly model: string;
  write(x: HintContext, retryReason?: string): Promise<{ text: string; prompt: string; model?: string } | null>;
}

export const RUNG_GOALS: Record<number, string> = {
  1: "NUDGE — one gentle question that makes them think about the kind of input that fails. No line numbers yet, and don't explain the cause.",
  2: "YOUR LINE — name the exact line number that causes the problem and say, in words, what that line does when it meets the failing kind of input. End with a question about what happens there.",
  3: "WHY IT BREAKS — explain the mechanism: walk briefly through what value or step goes wrong on that kind of input and why, then say in words what kind of change would fix it. Still no code.",
};

const SYSTEM = `You are Priya, a patient Python tutor inside Layerflow. You write ONE hint for a beginner whose code fails some tests.
Hard rules — an automatic checker rejects any hint that breaks one:
- Plain English sentences only. No code: no code blocks, no backticks, no Python statements, no assignments, no function calls written with parentheses, no square-bracket indexing, and no operator symbols such as = == != < > <= >= += + - * / %.
- Say operations in words: "the length of marks", "k minus one", "at least forty", "more than", "the larger of zero and …", "add one to total".
- You may mention line numbers and variable names (like marks, total or k) on their own.
- Never mention, guess or invent a specific hidden test value. Talk about the KIND of input instead.
- One to three short sentences, under sixty words. Warm and direct. No "great question", no greetings.
- Give exactly the requested level. Build on the hints already shown; never repeat them.
Reply with the hint text only.`;

function numbered(code: string): string {
  return code
    .replace(/\s+$/, "")
    .split(/\r?\n/)
    .map((l, i) => `${String(i + 1).padStart(2)}| ${l}`)
    .join("\n");
}

/** The messages for one rung. Built ONLY from public material + the learner's own code. */
export function hintMessages(x: HintContext, retryReason?: string): { system: string; user: string } {
  const c = x.challenge;
  const lines = [
    `Task: ${c.description}`,
    `Inputs: ${c.inputs}`,
    `Function: ${c.signature}`,
    "",
    "The learner's code:",
    numbered(x.code),
    "",
    "Visible tests:",
    ...x.visible.map((v) => `- ${v.call} → expected ${v.expected}, got ${v.got} (${v.outcome.replace(/_/g, " ")})`),
    "",
    `Hidden tests that fail are: ${x.failingKinds.length ? x.failingKinds.join("; ") : "none of a single kind"} (their values are secret — never guess them).`,
    `What Layerflow already told the learner: ${x.explanation}`,
  ];
  if (x.tag) lines.push(`Mistake category: ${tagLabel(x.tag)} — ${plainRule(x.tag)}.`);
  if (x.lineMap?.culprit_line) lines.push(`The line to look at: line ${x.lineMap.culprit_line} — ${x.lineMap.reason}`);
  lines.push("", x.previous.length ? "Hints already shown:" : "No hints shown yet.", ...x.previous.map((h, i) => `${i + 1}. ${h}`), "");
  lines.push(`Write hint level ${x.rung} of 3 — ${RUNG_GOALS[x.rung] ?? RUNG_GOALS[3]}`);
  lines.push(`A generic version of this level, for reference only: "${x.draft}" — make yours specific to THIS learner's code.`);
  if (retryReason) lines.push(`Your previous draft was rejected by the checker (${retryReason}). Rewrite it in plain words with no code or symbols.`);
  return { system: SYSTEM, user: lines.join("\n") };
}

/** Tidy a model reply into a single hint. */
export function cleanHint(text: string): string {
  return text
    .trim()
    .replace(/^(hint( level)?\s*\d*\s*[:.-]\s*)/i, "")
    .replace(/^["“']+|["”']+$/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function overlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let n = 0;
  for (const w of wa) if (wb.has(w)) n++;
  return n / Math.min(wa.size, wb.size);
}

/** The gate every AI-written hint must pass before a learner sees it. */
export function acceptHint(raw: string, x: Pick<HintContext, "challenge" | "code" | "previous">): { ok: boolean; text: string; reason?: string } {
  const text = cleanHint(raw);
  if (text.length < 12) return { ok: false, text, reason: "too short" };
  if (text.length > 480) return { ok: false, text, reason: "too long" };
  if (/```|`/.test(text)) return { ok: false, text, reason: "code formatting" };
  const v = validateHint(text, { fn: x.challenge.fn });
  if (!v.ok) return { ok: false, text, reason: v.reasons.join(", ") };
  if (findLeak(text, x.challenge, [], x.code)) return { ok: false, text, reason: "a hidden-test value" };
  if (x.previous.some((p) => overlap(p, text) > 0.85)) return { ok: false, text, reason: "repeats an earlier hint" };
  return { ok: true, text };
}
