/**
 * The answer — the step after the hint ladder.
 *
 * Once a learner has used all three hints on a problem they can open the
 * answer: what's wrong (in plain words), THEIR code with the smallest fix, and
 * what changed. The fix is never shown untested — the API runs it against
 * every visible and hidden test in the sandbox first (checkProgram in
 * engine.ts); a fix that fails is retried once with the KIND of input it still
 * fails on, and after that a known-correct version is shown instead.
 *
 * Served by its own endpoint, never by /api/hint, so every hint stays prose.
 */
import { tagLabel } from "./mentor.ts";
import type { Challenge, LineMap, MistakeTag } from "./types.ts";

export interface AnswerContext {
  challenge: Challenge;
  code: string;
  tag: MistakeTag | null;
  lineMap: LineMap | null;
  explanation: string;
  visible: { call: string; expected: string; got: string; outcome: string }[];
  failingKinds: string[];
  hints: string[];
}

export interface AnswerDraft {
  whats_wrong: string;
  what_changed: string;
  fixed_code: string;
}

export interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

export interface AnswerPayload extends AnswerDraft {
  /** ai = the model fixed the learner's code · rule = a mechanical syntax fix · reference = a known-correct version */
  source: "ai" | "rule" | "reference";
  model: string | null;
  /** every visible + hidden test this code was run against before it was shown */
  tests_passed: number;
  diff: DiffLine[];
  created_at: string;
}

const SYSTEM = `You are Priya, a Python tutor inside Layerflow. The learner used all three hints and asked to see the answer.
Fix THEIR function with the smallest change that makes it correct for every input the task allows — including edge cases such as empty or very short inputs and values exactly on a boundary.
- Keep their variable names, structure and style. Only rewrite from scratch if their approach cannot work.
- Keep the exact function name and parameters. Return the value — never print it.
- No imports, no input(), no test code outside the function.
Reply with JSON only, exactly these keys:
{"whats_wrong": "two or three short sentences in simple words: which line is wrong and why", "what_changed": "one or two sentences: exactly what you changed", "fixed_code": "the complete corrected function"}`;

function numbered(code: string): string {
  return code
    .replace(/\s+$/, "")
    .split(/\r?\n/)
    .map((l, i) => `${String(i + 1).padStart(2)}| ${l}`)
    .join("\n");
}

/** Built from public facts and the learner's own code only. */
export function answerMessages(x: AnswerContext, stillFails?: string[]): { system: string; user: string } {
  const c = x.challenge;
  const lines = [
    `Task: ${c.description}`,
    `Inputs: ${c.inputs}`,
    `Function: ${c.signature}`,
    "",
    "The learner's code (line numbers are for reference, not part of the code):",
    numbered(x.code),
    "",
    "Visible tests:",
    ...x.visible.map((v) => `- ${v.call} → expected ${v.expected}, got ${v.got} (${v.outcome.replace(/_/g, " ")})`),
    `Hidden tests fail on: ${x.failingKinds.length ? x.failingKinds.join("; ") : "some inputs"} (values are secret).`,
    `What Layerflow told the learner: ${x.explanation}`,
  ];
  if (x.tag) lines.push(`Mistake category: ${tagLabel(x.tag)}.`);
  if (x.lineMap?.culprit_line) lines.push(`Line to look at: line ${x.lineMap.culprit_line} — ${x.lineMap.reason}`);
  if (x.hints.length) lines.push("", "Hints already shown:", ...x.hints.map((h, i) => `${i + 1}. ${h}`));
  if (stillFails?.length) lines.push("", `Your previous fix was run against all the tests and still fails on: ${stillFails.join("; ")}. Fix that too.`);
  return { system: SYSTEM, user: lines.join("\n") };
}

function stripFences(s: string): string {
  return s.replace(/^\s*```[\w-]*\s*\n?/, "").replace(/\n?```\s*$/, "").replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n";
}

/** Models sometimes put raw line breaks / tabs inside JSON strings; escape them so JSON.parse accepts it. */
function escapeControlCharsInStrings(json: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (ch === "\\") {
        out += ch + (json[++i] ?? "");
        continue;
      }
      if (ch === '"') inString = false;
      else if (ch === "\n") {
        out += "\\n";
        continue;
      } else if (ch === "\r") continue;
      else if (ch === "\t") {
        out += "\\t";
        continue;
      }
    } else if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

/** Pull {whats_wrong, what_changed, fixed_code} out of a model reply. */
export function parseAnswer(text: string, fn: string): AnswerDraft | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j: Partial<AnswerDraft>;
  try {
    j = JSON.parse(m[0]) as Partial<AnswerDraft>;
  } catch {
    try {
      j = JSON.parse(escapeControlCharsInStrings(m[0])) as Partial<AnswerDraft>;
    } catch {
      return null;
    }
  }
  if (typeof j.fixed_code !== "string" || typeof j.whats_wrong !== "string") return null;
  const fixed_code = stripFences(j.fixed_code);
  if (!new RegExp(`\\bdef\\s+${fn}\\s*\\(`).test(fixed_code)) return null;
  if (/^\s*(import|from)\s/m.test(fixed_code) || /\binput\s*\(/.test(fixed_code)) return null;
  return {
    whats_wrong: j.whats_wrong.trim(),
    what_changed: (typeof j.what_changed === "string" ? j.what_changed : "").trim(),
    fixed_code,
  };
}

/** Line diff (LCS) so the UI can highlight exactly what changed. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\s+$/, "").split(/\r?\n/);
  const b = after.replace(/\s+$/, "").split(/\r?\n/);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i].trimEnd() === b[j].trimEnd() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].trimEnd() === b[j].trimEnd()) {
      out.push({ type: "same", text: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: a[i++] });
    else out.push({ type: "add", text: b[j++] });
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}

/** When no model is available (or its fix keeps failing): explain from what Layerflow already knows. */
export function referenceExplanation(x: AnswerContext): Pick<AnswerDraft, "whats_wrong" | "what_changed"> {
  const where = x.lineMap?.culprit_line && !x.explanation.includes(x.lineMap.reason) ? ` The problem starts on line ${x.lineMap.culprit_line}: ${x.lineMap.reason}` : "";
  return {
    whats_wrong: `${x.explanation}${where}`.trim(),
    what_changed: `This is a correct version, tested against every case. Compare it with yours line by line${x.lineMap?.culprit_line ? `, starting at line ${x.lineMap.culprit_line}` : ""} — then close it and write the fix yourself.`,
  };
}
