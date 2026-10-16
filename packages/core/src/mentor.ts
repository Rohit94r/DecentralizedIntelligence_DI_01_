/**
 * The mentor session script — what Priya says, segment by segment, and what
 * the animated "presentation" shows while she says it.
 *
 * Built ONLY from material that is already safe to show the learner: the
 * Tier-1 explanation, the Line Map, the trace of their own code on a PUBLIC
 * input, the hint ladder, the taxonomy and their own history. Every spoken
 * line is leak-checked; a line that would reveal a hidden test is dropped.
 * Like every hint, the mentor never writes the solution.
 */
import { getChallenge } from "./challenge-bank.ts";
import { callString, pyRepr } from "./compare.ts";
import { ladderFor } from "./hints.ts";
import { findLeak } from "./secrecy.ts";
import { TAXONOMY, TAG_LABELS } from "./taxonomy.ts";
import type { TraceResult } from "./engine.ts";
import type { Challenge, HiddenRow, LineMap, MistakeTag, NextChallenge, VisibleRow } from "./types.ts";

export type MentorVisual =
  | { kind: "intro"; title: string; signature: string; attempts: number; status: "solved" | "struggling" | "new" }
  | { kind: "tests"; visible: VisibleRow[]; hidden: HiddenRow[] }
  | { kind: "trace"; step: number }
  | { kind: "linemap"; line: number; reason: string }
  | { kind: "pattern"; tag: MistakeTag; label: string; rule: string; example: string; where: string[] }
  | { kind: "plan"; steps: string[]; next?: { challenge_id: string; title: string; reason: string } };

export interface MentorSegment {
  id: string;
  /** short label for the scrubber */
  title: string;
  /** what the mentor says — shown as captions */
  say: string;
  /** the same line made easy to pronounce for text-to-speech */
  speech: string;
  visual: MentorVisual;
}

export interface MentorInput {
  learnerName: string;
  mentorName: string;
  challenge: Challenge;
  attempts: number;
  everPassed: boolean;
  latest: {
    passed: boolean;
    tags: MistakeTag[];
    explanation: string;
    visible: VisibleRow[];
    hidden: HiddenRow[];
    analysis: LineMap | null;
    code: string;
    ladderKey: string;
  } | null;
  hintsUsed: number;
  trace: TraceResult | null;
  recurringWhere: Record<string, string[]>;
  next: NextChallenge | null;
}

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const n = (x: number) => NUM[x] ?? String(x);

/** Turn code-ish text into something a voice can read naturally. Captions keep the original. */
export function speakify(text: string): string {
  return text
    .replace(/`/g, "")
    .replace(/\blen\(\s*([A-Za-z_]\w*)\s*\)/g, "the length of $1")
    .replace(/\b([A-Za-z_]\w*)\[\s*(-?\d+)\s*\]/g, (_, a, i) => `${a} at position ${Number(i) < 0 ? "minus " + Math.abs(Number(i)) : i}`)
    .replace(/\b([A-Za-z_]\w*)\[\s*([A-Za-z_]\w*)\s*\]/g, "$1 at $2")
    .replace(/(\w)\(([^()]*)\)/g, "$1 of $2")
    .replace(/\s-\s/g, " minus ")
    .replace(/\s\+\s/g, " plus ")
    .replace(/==/g, " equals ")
    .replace(/>=/g, " at least ")
    .replace(/<=/g, " at most ")
    .replace(/(^|\s)-(\d)/g, "$1minus $2")
    .replace(/\[\s*\]/g, "an empty list")
    .replace(/\[([^\]]*)\]/g, "the list $1")
    .replace(/\b([a-z]+)_([a-z_]+)\b/g, (m) => m.replace(/_/g, " "))
    .replace(/→/g, " gives ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

function restSentences(s: string): string {
  return s.slice(firstSentence(s).length).trim();
}

function plainRule(tag: MistakeTag): string {
  const simple: Record<MistakeTag, string> = {
    unhandled_short_input: "your code assumes the input is longer than it sometimes is, so it reads a position that isn't there",
    print_not_return: "your function shows the answer on the screen, but never hands it back",
    mutates_input: "your function changes the list it was given, and the caller's list changes too",
    off_by_one: "a loop or range runs one step too many or one step too few",
    boundary_comparison: "a comparison gets the edge value itself wrong, so only the edge cases fail",
    wrong_index_direction: "your code takes items from the wrong end",
  };
  return simple[tag];
}

export function buildMentorScript(x: MentorInput): MentorSegment[] {
  const c = x.challenge;
  const segs: Omit<MentorSegment, "speech">[] = [];
  const latest = x.latest;
  const status: "solved" | "struggling" | "new" = !latest ? "new" : x.everPassed || latest.passed ? "solved" : "struggling";
  const tag = latest?.tags[0] ?? null;

  // 1 — hello
  const attemptsLine = x.attempts === 0 ? "You haven't submitted it yet, so let's look at what it asks." : `You've made ${n(x.attempts)} attempt${x.attempts === 1 ? "" : "s"} so far.`;
  const statusLine =
    status === "solved"
      ? latest?.passed && x.hintsUsed === 0
        ? "And you solved it without a single hint — that's the best kind of pass."
        : "And you got it working — let's make sure the idea really sticks."
      : status === "struggling"
        ? "Don't worry — you're closer than it feels. Let's find the exact place to look."
        : "We'll start with the examples and build up from there.";
  segs.push({
    id: "intro",
    title: "Hello",
    say: `Hi ${x.learnerName}! I'm ${x.mentorName}, your Layerflow mentor. Let's go through ${c.title} together. ${attemptsLine} ${statusLine}`,
    visual: { kind: "intro", title: c.title, signature: c.signature, attempts: x.attempts, status },
  });

  // 2 — what the tests said
  if (latest) {
    const visible = latest.visible;
    const hidden = latest.hidden;
    const say = latest.passed
      ? `On your last attempt every visible and every hidden test passed. ${hidden.length} hidden tests checked edge cases you couldn't see, and your code handled all of them.`
      : `Here's your last attempt. ${firstSentence(latest.explanation)} ${restSentences(latest.explanation).split(/(?<=[.!?])\s/)[0] ?? ""}`;
    segs.push({ id: "tests", title: "Your result", say, visual: { kind: "tests", visible, hidden } });
  } else {
    segs.push({
      id: "tests",
      title: "The task",
      say: `The task: ${c.description} The visible examples show exactly what should come back — try the first one in your head before you write anything.`,
      visual: {
        kind: "tests",
        visible: c.visible.map((t, i) => ({ test: i + 1, call: callString(c.fn, t.args), expected: pyRepr(t.expected, { float: c.floatResult }), got: "—", outcome: "passed" as const })),
        hidden: [],
      },
    });
  }

  // 3 — watch their own code run (a PUBLIC input)
  const tr = x.trace;
  if (latest && !latest.passed && tr && tr.steps.length) {
    segs.push({
      id: "trace-start",
      title: "Watch it run",
      say: `Now let me run your own code on a small example, ${tr.call}. Watch the variables on the right change, one line at a time.`,
      visual: { kind: "trace", step: 0 },
    });
    const flagged = tr.firstWrongStep ? tr.steps.findIndex((s) => s.step === tr.firstWrongStep) : -1;
    if (flagged >= 0) {
      const s = tr.steps[flagged];
      const note = s.note ? `${s.note.replace(/\.$/, "")}.` : "this is where it starts to go wrong.";
      const vars = Object.entries(s.locals)
        .slice(0, 3)
        .map(([k, v]) => `${k} is ${v.length > 40 ? v.slice(0, 40) + "…" : v}`);
      segs.push({
        id: "trace-flag",
        title: "Here it breaks",
        say: `Look closely — step ${s.step}, on line ${s.line}. ${cap(note)}${vars.length ? ` Right now ${joinAnd(vars)}.` : ""} That's the moment the answer goes off track.`,
        visual: { kind: "trace", step: flagged },
      });
    }
    const last = tr.steps.length - 1;
    segs.push({
      id: "trace-end",
      title: "The result",
      say: tr.error
        ? `And it ends with ${tr.error.split(":")[0]} — your code stops before it can hand back an answer.`
        : tr.result !== undefined
          ? `In the end your function hands back ${tr.result}. Work out by hand what it should be — the gap between the two is your bug.`
          : "And that's where the run ends.",
      visual: { kind: "trace", step: Math.max(0, last) },
    });
  }

  // 4 — the line to look at
  if (latest && !latest.passed && latest.analysis?.culprit_line) {
    segs.push({
      id: "linemap",
      title: "Where to look",
      say: `So where should you look? Line ${latest.analysis.culprit_line} — ${latest.analysis.confidence}. ${latest.analysis.reason}`,
      visual: { kind: "linemap", line: latest.analysis.culprit_line, reason: latest.analysis.reason },
    });
  }

  // 5 — name the pattern
  if (tag) {
    const where = x.recurringWhere[tag] ?? [c.id];
    const tax = TAXONOMY.find((t) => t.tag === tag);
    const recurring =
      where.length >= 2
        ? `It has now shown up in ${n(where.length)} different challenges for you, so it's a real pattern — fixing it here fixes it everywhere.`
        : "So far it has shown up only here, so it's a slip, not a habit yet.";
    const label = tagLabel(tag);
    segs.push({
      id: "pattern",
      title: "The pattern",
      say: `This mistake has a name: ${label.toLowerCase()}. It means ${plainRule(tag)}. ${recurring}`,
      visual: { kind: "pattern", tag, label, rule: cap(plainRule(tag)) + ".", example: tax?.example ?? "", where },
    });
  }

  // 6 — the plan (prose from the hint ladder — never code)
  const steps: string[] = [];
  if (latest && !latest.passed) {
    const ladder = ladderFor(c, (latest.ladderKey as never) ?? "generic");
    steps.push(ladder[0]);
    if (tr?.call) steps.push(`Trace ${tr.call} by hand and write down every value, exactly like the replay did.`);
    steps.push(ladder[2] ?? ladder[1]);
    steps.push("Change one thing, submit again, and ask me for the next hint only if you're still stuck.");
  } else if (latest?.passed) {
    steps.push("Explain your solution out loud in one sentence — if you can, you really own it.");
    if (x.next && x.next.challenge_id !== c.id) steps.push(`Next, try ${titleOf(x.next.challenge_id)} — it stretches the same idea a little further.`);
    steps.push("Come back tomorrow and solve one more without hints to keep your streak.");
  } else {
    steps.push("Work out the first visible example by hand.");
    steps.push("Write the smallest version of the function that passes it.");
    steps.push("Then think about the edge cases: an empty input, the smallest allowed value, a value exactly on a boundary.");
  }
  const nextLine = x.next && x.next.challenge_id !== c.id && !(latest?.passed) ? ` Once it passes, I'd pick ${titleOf(x.next.challenge_id)} for you next.` : "";
  segs.push({
    id: "plan",
    title: "Your plan",
    say: `Here's your plan. ${steps.map((s, i) => `${cap(n(i + 1))}: ${s}`).join(" ")}${nextLine} You've got this — and remember, I'll always point you to the right place, but I'll never hand you the code.`,
    visual: { kind: "plan", steps, next: x.next && x.next.challenge_id !== c.id ? { challenge_id: x.next.challenge_id, title: titleOf(x.next.challenge_id), reason: x.next.reason } : undefined },
  });

  // Guard: no line may reveal a hidden test.
  return segs
    .filter((s) => !findLeak(s.say, c, [], latest?.code ?? ""))
    .map((s) => ({ ...s, speech: speakify(s.say) }));
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinAnd(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function titleOf(id: string): string {
  return getChallenge(id)?.title ?? id;
}

/** "Wrong index direction (optional 6th)" → "Wrong index direction" */
export function tagLabel(tag: MistakeTag): string {
  return TAG_LABELS[tag].replace(/\s*\(.*\)$/, "");
}

export { plainRule };

export const MENTOR = {
  id: "priya",
  name: "Priya",
  title: "Python mentor · Layerflow",
  avatar: "/people/priya.jpg",
  /** ElevenLabs voice for Priya (overridable with ELEVENLABS_VOICE_ID) */
  elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL",
};
