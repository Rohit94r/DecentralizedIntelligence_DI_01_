/**
 * Plain-language explanations — Tier 1, deterministic, works with zero API keys.
 *
 *   "{visible sentence}, but {k} of the {m} hidden tests fail: {breakdown}.
 *    {what KIND of input they are}. {why — the mechanism}."
 *
 * The kind sentence names the KIND of input ("cases where k is larger than
 * the number of marks"), never the values. The mechanism sentence may quote
 * the learner's OWN code back to them, never anything hidden.
 * An optional Tier-2 (LLM) rewrite happens in the API and must pass the same
 * secrecy check — if it fails, this text is what ships.
 */
import { syntaxDiagnosis } from "./syntax-doctor.ts";
import type { Challenge, LadderKey, LineMap, MistakeTag, TestResult } from "./types.ts";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? String(n);

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

function breakdown(failing: TestResult[], noun: string): string {
  const crash = failing.filter((r) => r.outcome === "runtime_error").length;
  const wrong = failing.filter((r) => r.outcome === "wrong_output").length;
  const forever = failing.filter((r) => r.outcome === "timeout").length;
  const parts: string[] = [];
  if (crash) parts.push(crash === 1 ? "one crashes" : `${word(crash)} crash`);
  if (wrong) parts.push(wrong === 1 ? `one gives the wrong ${noun}` : `${word(wrong)} give the wrong ${noun}`);
  if (forever) parts.push(forever === 1 ? "one never finishes" : `${word(forever)} never finish`);
  return joinAnd(parts);
}

function kindSentence(challenge: Challenge, failing: TestResult[], onlyHidden: boolean): string {
  if (!failing.length) return "";
  const kinds = failing.map((r) => r.case.edge ?? null);
  const unique = [...new Set(kinds)];
  if (unique.length === 1) {
    const k = unique[0];
    if (!k || !challenge.edges[k]) {
      return failing.length === 1 ? "It is an ordinary input, not an edge case." : "They are ordinary inputs, not edge cases.";
    }
    if (failing.length === 1) return `It is ${challenge.edges[k].one}.`;
    const allHidden = failing.every((r) => r.kind === "hidden");
    const all = failing.length === 2 ? "Both" : `All ${word(failing.length)}`;
    const subject = onlyHidden ? all : `${all} failing ${allHidden ? "hidden " : ""}tests`;
    return `${subject} are ${challenge.edges[k].many}.`;
  }
  // Ordinary inputs fail too → it isn't an edge-case problem; saying so is more useful than listing kinds.
  if (unique.includes(null) && failing.some((r) => r.kind === "visible")) {
    return "It isn't only an edge case — ordinary inputs fail too, including your visible examples.";
  }
  const described = unique
    .slice(0, 3)
    .map((k) => (k && challenge.edges[k] ? challenge.edges[k].one : "an ordinary input"));
  return `They include ${joinAnd(described)}.`;
}

/** Off-by-one direction, read from a VISIBLE (public) test only. */
function directionSentence(results: TestResult[]): string {
  const v = results.find((r) => r.kind === "visible" && r.outcome === "wrong_output" && r.run.status === "ok");
  if (!v) return "";
  const got = v.run.ret;
  const exp = v.case.expected;
  if (Array.isArray(got) && Array.isArray(exp) && got.length !== exp.length) {
    return got.length > exp.length ? `On visible example ${v.test} your list has one item too many.` : `On visible example ${v.test} your list is one item short.`;
  }
  if (typeof got === "number" && typeof exp === "number" && got !== exp) {
    return got > exp ? `On visible example ${v.test} your answer comes out one step too high.` : `On visible example ${v.test} your answer comes out one step too low.`;
  }
  return "";
}

export function mechanismSentence(
  challenge: Challenge,
  key: LadderKey,
  code: string,
  lineMap: LineMap | null,
): string {
  for (const v of challenge.mechanismVariants ?? []) {
    if (v.tag === key && new RegExp(v.when).test(code)) return v.text;
  }
  let text = challenge.mechanisms[key] ?? DEFAULT_MECHANISMS[key];
  const line = lineMap?.culprit_line;
  if (text.includes("{line}")) {
    text = line ? text.replace("{line}", String(line)) : text.replace(/^Line \{line\} /, "Your code ").replace(/ on line \{line\}/, "").replace("{line}", "?");
  }
  return text;
}

const DEFAULT_MECHANISMS: Record<LadderKey, string> = {
  syntax: "Python can't read one of your lines, so no test could run.",
  unhandled_short_input: "Line {line} assumes the input is longer than it is on these cases.",
  print_not_return: "Your function prints the answer but hands back nothing, so the tests see None.",
  mutates_input: "Line {line} changes the caller's input instead of working on a copy.",
  off_by_one: "Your loop does one step too many or too few.",
  boundary_comparison: "The comparison on line {line} gets the edge value itself wrong.",
  wrong_index_direction: "Your code takes items from the wrong end.",
  timeout: "On those inputs a loop never reaches its stopping condition.",
  crash: "Your code raises an error on those inputs before it can return.",
  generic: "Work one of these cases out by hand and compare it with what your code produces.",
};

export interface ExplainInput {
  challenge: Challenge;
  results: TestResult[];
  tag: MistakeTag | null;
  ladderKey: LadderKey;
  code: string;
  lineMap: LineMap | null;
  hintsUsed: number;
}

export function buildExplanation(x: ExplainInput): string {
  const visible = x.results.filter((r) => r.kind === "visible");
  const hidden = x.results.filter((r) => r.kind === "hidden");
  const visPass = visible.filter((r) => r.outcome === "passed").length;
  const hidFail = hidden.filter((r) => r.outcome !== "passed");
  const visFail = visible.filter((r) => r.outcome !== "passed");

  if (!hidFail.length && !visFail.length) {
    return x.hintsUsed
      ? `All ${word(visible.length)} visible and all ${word(hidden.length)} hidden tests pass. You got there with ${x.hintsUsed === 1 ? "one hint" : `${word(x.hintsUsed)} hints`} — try the next one without any.`
      : `All ${word(visible.length)} visible and all ${word(hidden.length)} hidden tests pass, without a single hint. That one is yours.`;
  }

  // A file that can't even load fails every test the same way — say that plainly.
  const moduleFail = x.results.find((r) => r.run.phase === "module" && r.outcome !== "passed");
  if (moduleFail) {
    if (moduleFail.run.killedBy === "policy") {
      return `Your code uses something the Layerflow sandbox doesn't allow (${moduleFail.run.policy ?? "a blocked feature"}), so none of the tests could run. Remove it and submit again.`;
    }
    if (moduleFail.outcome === "timeout") {
      return "Your file never finishes loading, so none of the tests could call your function. Look for a loop outside the function that never stops.";
    }
    if (moduleFail.run.excType === "SyntaxError") {
      // name the exact mistake — the learner can't debug a test that never ran
      const d = syntaxDiagnosis(x.code, moduleFail.run.excLine ?? x.lineMap?.culprit_line ?? null, moduleFail.run.excMessage ?? "");
      const what = d ? d.what.charAt(0).toUpperCase() + d.what.slice(1) : "One line can't be read";
      return `Python can't read your code, so none of the tests could run. ${what}. ${d?.fix ?? "Check that line for a missing colon or an unclosed bracket."}`;
    }
    const where = moduleFail.run.excLine ? ` on line ${moduleFail.run.excLine}` : "";
    return `Your file raises ${moduleFail.run.excType ?? "an error"}${where} before the tests can call ${x.challenge.fn} — code outside the function runs first. Fix or remove that line and submit again.`;
  }

  // Counts as digits, the breakdown in words — the statement's own example style.
  let first: string;
  if (visPass === visible.length) first = `All ${visible.length} visible tests pass`;
  else if (visPass === 0) first = `None of the ${visible.length} visible tests pass yet`;
  else first = `${visPass} of the ${visible.length} visible tests ${visPass === 1 ? "passes" : "pass"}`;

  const joiner = visPass === visible.length ? ", but " : ", and ";
  const howMany = hidFail.length === hidden.length ? `all ${hidden.length}` : `${hidFail.length} of the ${hidden.length}`;
  // "1 of the 6 hidden tests fails" · "3 of the 6 hidden tests fail"
  const fail = hidFail.length === 1 && hidden.length > 1 ? "fails" : "fail";
  const why = mechanismSentence(x.challenge, x.ladderKey, x.code, x.lineMap);

  // Printing instead of returning: every test sees None — say that, not "wrong list".
  if (x.tag === "print_not_return") {
    const second = hidFail.length ? `${joiner}${howMany} hidden tests ${fail}` : `, and all ${hidden.length} hidden tests pass`;
    return `${first}${second}: each one gets None back. The value you print looks right — but tests only see what a function hands back. ${why}`.replace(/\s+/g, " ").trim();
  }

  let second: string;
  if (!hidFail.length) second = `, and all ${hidden.length} hidden tests pass`;
  else second = `${joiner}${howMany} hidden tests ${fail}: ${breakdown(hidFail, x.challenge.resultNoun)}`;

  const failingForKind = hidFail.length ? [...hidFail, ...(hidFail.some((r) => !r.case.edge) ? visFail : [])] : visFail;
  const kind = kindSentence(x.challenge, failingForKind, hidFail.length > 0 && !visFail.length);
  const direction = x.tag === "off_by_one" ? directionSentence(x.results) : "";
  return `${first}${second}. ${kind} ${direction} ${why}`.replace(/\s+/g, " ").trim();
}

/** The encouraging headline shown above the explanation — never "wrong", always a next step. */
export function headline(results: TestResult[]): string {
  const fails = results.filter((r) => r.outcome !== "passed").length;
  const visibleFails = results.filter((r) => r.kind === "visible" && r.outcome !== "passed").length;
  if (!fails) return "Every test passes. Beautiful.";
  if (!visibleFails && fails <= 2) return "You're close — this is one edge case away.";
  if (!visibleFails) return "Your examples work. A few hidden cases don't — let's look at what they have in common.";
  if (visibleFails < results.filter((r) => r.kind === "visible").length) return "Some of it works already. Let's find the part that doesn't.";
  return "Not there yet — and that's what practice is for. Start with the first visible test.";
}
