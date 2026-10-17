/**
 * The engine: one submission, end to end. No I/O of its own — the API injects
 * a Sandbox (child processes), a Store (SQLite) and, optionally, a Rewriter
 * (an LLM). That keeps every scoring decision a testable pure function.
 *
 *   1. run every test in the sandbox      — the child gets INPUTS ONLY
 *   2. classify each result               — the parent holds the expected values
 *   3. detect the mistake category        — deterministic
 *   4. locate the culprit line (Line Map) — AST of the learner's own code
 *   5. explain                            — Tier 1 always; Tier 2 only if it passes the checks
 *   6. mastery + recurrence               — Beta posterior; distinct-challenge recurrence
 *   7. ONE transaction, then the response — hidden[] carries {test, outcome} only
 */
import { classify } from "./classifier.ts";
import { callString, pyRepr } from "./compare.ts";
import { detect } from "./detectors.ts";
import { buildExplanation, headline } from "./explain.ts";
import { isAnswerRequest, ladderFor, ladderKeyFor, validateHint } from "./hints.ts";
import { hintDelta, submissionDelta, type MasteryDelta } from "./mastery.ts";
import { nextChallenge, rollup } from "./recurrence.ts";
import { findLeak } from "./secrecy.ts";
import { acceptHint, type HintContext, type HintWriter } from "./hint-writer.ts";
import { syntaxDiagnosis, syntaxLadder } from "./syntax-doctor.ts";
import type {
  Challenge,
  HiddenRow,
  HistoryItem,
  LadderKey,
  LineMap,
  MasteryRow,
  MistakeTag,
  NextChallenge,
  PyValue,
  RunResult,
  SubmitResponse,
  TestResult,
  VisibleRow,
} from "./types.ts";

/* ─────────────────────────────── ports ─────────────────────────────── */

export interface RunJob {
  code: string;
  fn: string;
  /** INPUTS ONLY. There is no field for an expected value, by design. */
  tests: { args: PyValue[] }[];
  timeoutMs: number;
}

export interface AnalyzeJob {
  code: string;
  fn: string;
  key: LadderKey;
  /** Line numbers in the learner's own code where it raised. */
  excLines: number[];
}

export interface TraceJob {
  code: string;
  fn: string;
  /** Either literal args, or a Python literal source the sandbox parses with ast.literal_eval. */
  args?: PyValue[];
  argsSource?: string;
  culpritLine?: number | null;
}

export interface TraceStep {
  step: number;
  line: number;
  event: "line" | "return" | "exception";
  locals: Record<string, string>;
  note?: string;
  flag?: boolean;
}

export interface TraceResult {
  ok: boolean;
  call: string;
  steps: TraceStep[];
  result?: string;
  error?: string;
  firstWrongStep: number | null;
  truncated: boolean;
}

export interface SandboxSession {
  runTests(job: RunJob): Promise<RunResult[]>;
  analyze(job: AnalyzeJob): Promise<LineMap | null>;
  close(): void;
}

export interface Sandbox {
  session(): SandboxSession;
  trace(job: TraceJob): Promise<TraceResult>;
}

export interface LedgerEntry {
  kind: "explanation" | "hint";
  prompt: string;
  response: string;
  model: string | null;
  rejected_for_code: boolean;
}

export interface SubmissionRecord {
  id: string;
  learner_id: string;
  challenge_id: string;
  code: string;
  passed: boolean;
  tags: MistakeTag[];
  explanation: string;
  hints_used: number;
  duration_ms: number;
  created_at: string;
  analysis: LineMap | null;
  ladder_key: LadderKey;
  results: { kind: "visible" | "hidden"; test: number; outcome: TestResult["outcome"]; detail: string | null; got: string | null }[];
  masteryDeltas: MasteryDelta[];
  ledger: LedgerEntry[];
}

export interface Store {
  history(learnerId: string): HistoryItem[];
  mastery(learnerId: string): MasteryRow[];
  /** Hints this learner has taken on this challenge since they last passed it. */
  hintsSinceLastPass(learnerId: string, challengeId: string): number;
  nextSubmissionId(): string;
  saveSubmission(rec: SubmissionRecord): void;
}

export interface Rewriter {
  readonly model: string;
  rewriteExplanation(input: { challenge: Challenge; code: string; draft: string; kinds: string[] }): Promise<{ text: string; prompt: string } | null>;
  rewriteHint(input: { challenge: Challenge; code: string; draft: string; rung: number }): Promise<{ text: string; prompt: string } | null>;
}

/* ─────────────────────────────── submit ─────────────────────────────── */

export const TEST_TIMEOUT_MS = 1000;
export const MAX_CODE_BYTES = 20_000;

export interface SubmitOutput {
  response: SubmitResponse;
  record: SubmissionRecord;
  results: TestResult[];
  lineMap: LineMap | null;
  headline: string;
  next: NextChallenge;
}

function gotString(r: RunResult, float: boolean): string {
  if (r.killedBy === "wall_clock") return "did not finish (timeout)";
  if (r.killedBy && r.killedBy !== "policy") return `stopped by the sandbox (${r.killedBy === "crash" ? "runner restarted" : r.killedBy + " limit"})`;
  if (r.status === "error") return `${r.excType ?? "Error"}${r.excMessage ? ": " + r.excMessage : ""}`;
  if (r.repr !== undefined) return float && typeof r.ret === "number" ? pyRepr(r.ret, { float: true }) : r.repr;
  return pyRepr(r.ret);
}

export async function submit(
  input: { learner_id: string; challenge: Challenge; code: string; at?: string },
  deps: { sandbox: Sandbox; store: Store; rewriter?: Rewriter | null },
): Promise<SubmitOutput> {
  const { challenge, code, learner_id } = input;
  const started = Date.now();
  const cases = [...challenge.visible.map((c) => ({ kind: "visible" as const, c })), ...challenge.hidden.map((c) => ({ kind: "hidden" as const, c }))];

  const session = deps.sandbox.session();
  let runs: RunResult[];
  let lineMap: LineMap | null = null;
  const results: TestResult[] = [];
  let tag: MistakeTag | null = null;
  let ladderKey: LadderKey = "generic";
  try {
    runs = await session.runTests({ code, fn: challenge.fn, tests: cases.map((x) => ({ args: x.c.args })), timeoutMs: TEST_TIMEOUT_MS });
    let vi = 0;
    let hi = 0;
    cases.forEach((x, i) => {
      const run = runs[i];
      const { outcome, detail } = classify(run, x.c.expected, challenge);
      results.push({ kind: x.kind, test: x.kind === "visible" ? ++vi : ++hi, outcome, detail, run, case: x.c });
    });

    const detection = detect(challenge, results);
    tag = detection.primary;
    const failing = results.filter((r) => r.outcome !== "passed");
    ladderKey = ladderKeyFor(tag, {
      timeout: failing.some((r) => r.outcome === "timeout"),
      crash: failing.some((r) => r.outcome === "runtime_error"),
    });
    // Python couldn't read the file at all → the syntax ladder (built from the exact mistake)
    if (results.some((r) => r.run.phase === "module" && r.run.excType === "SyntaxError")) ladderKey = "syntax";
    if (failing.length) {
      const excLines = (detection.evidence.length ? detection.evidence : failing)
        .map((r) => r.run.excLine)
        .filter((n): n is number => typeof n === "number" && n > 0);
      lineMap = await session.analyze({ code, fn: challenge.fn, key: ladderKey, excLines }).catch(() => null);
    }
  } finally {
    session.close();
  }

  // a syntax error: the Line Map names the exact mistake instead of "check brackets, colons and indentation"
  if (ladderKey === "syntax") {
    const se = results.find((r) => r.run.phase === "module" && r.run.excType === "SyntaxError");
    const d = syntaxDiagnosis(code, se?.run.excLine ?? lineMap?.culprit_line ?? null, se?.run.excMessage ?? "");
    if (d) lineMap = { culprit_line: d.line, confidence: "very likely", reason: `${d.what.charAt(0).toUpperCase() + d.what.slice(1)}. ${d.fix}` };
  }

  const passed = results.every((r) => r.outcome === "passed");
  const hintsUsed = deps.store.hintsSinceLastPass(learner_id, challenge.id);
  const tags: MistakeTag[] = tag ? [tag] : [];

  // ── explanation: Tier 1 always; Tier 2 only if it survives the same checks ──
  const draft = buildExplanation({ challenge, results, tag, ladderKey, code, lineMap, hintsUsed });
  const failingKinds = [...new Set(results.filter((r) => r.outcome !== "passed").map((r) => r.case.edge ?? "ordinary"))];
  const visible = results.filter((r) => r.kind === "visible");
  const hidden = results.filter((r) => r.kind === "hidden");
  const ledger: LedgerEntry[] = [];
  const detPrompt = [
    `tier=deterministic`,
    `challenge=${challenge.id}`,
    `tag=${tag ?? "none"}`,
    `visible_passed=${visible.filter((r) => r.outcome === "passed").length}/${visible.length}`,
    `hidden_failed=${hidden.filter((r) => r.outcome !== "passed").length}/${hidden.length}`,
    `kinds=${failingKinds.join(",") || "none"}`,
    `culprit_line=${lineMap?.culprit_line ?? "none"}`,
  ].join(" · ");
  let explanation = draft;
  if (findLeak(explanation, challenge, results, code)) {
    // Should never happen with the hand-written templates — but never ship a leak.
    explanation = headline(results);
  }
  ledger.push({ kind: "explanation", prompt: detPrompt, response: explanation, model: null, rejected_for_code: false });

  if (deps.rewriter && !passed) {
    const rewritten = await deps.rewriter
      .rewriteExplanation({ challenge, code, draft: explanation, kinds: failingKinds.map((k) => challenge.edges[k]?.one ?? "an ordinary input") })
      .catch(() => null);
    if (rewritten) {
      const leak = findLeak(rewritten.text, challenge, results, code);
      const tooCodey = /```|^\s*def\s/m.test(rewritten.text);
      const rejected = !!leak || tooCodey || rewritten.text.length > 700;
      ledger.push({ kind: "explanation", prompt: rewritten.prompt, response: rewritten.text, model: deps.rewriter.model, rejected_for_code: tooCodey });
      if (!rejected) explanation = rewritten.text;
    }
  }

  // ── mastery + recurrence ──
  const hinted = hintsUsed > 0;
  const masteryDeltas = submissionDelta(challenge.concepts, passed, hinted);
  const id = deps.store.nextSubmissionId();
  const at = input.at ?? new Date().toISOString();

  const visibleRows: VisibleRow[] = visible.map((r) => ({
    test: r.test,
    call: callString(challenge.fn, r.case.args),
    expected: pyRepr(r.case.expected, { float: challenge.floatResult }),
    got: gotString(r.run, !!challenge.floatResult) + (r.detail === "input changed" ? " — but your function changed the input" : ""),
    outcome: r.outcome,
  }));
  // 🔒 hidden rows: test number + outcome. Nothing else exists to leak.
  const hiddenRows: HiddenRow[] = hidden.map((r) => ({ test: r.test, outcome: r.outcome }));

  const record: SubmissionRecord = {
    id,
    learner_id,
    challenge_id: challenge.id,
    code,
    passed,
    tags,
    explanation,
    hints_used: hintsUsed,
    duration_ms: Date.now() - started,
    created_at: at,
    analysis: lineMap,
    ladder_key: ladderKey,
    results: [
      ...visible.map((r, i) => ({ kind: "visible" as const, test: r.test, outcome: r.outcome, detail: r.detail ?? null, got: visibleRows[i].got })),
      ...hidden.map((r) => ({ kind: "hidden" as const, test: r.test, outcome: r.outcome, detail: r.detail ?? null, got: null })),
    ],
    masteryDeltas,
    ledger,
  };
  deps.store.saveSubmission(record);

  const history = deps.store.history(learner_id);
  const next = nextChallenge(history, deps.store.mastery(learner_id));
  const firstDetail = results.find((r) => r.detail)?.detail ?? null;

  const response: SubmitResponse = {
    submission_id: id,
    learner_id,
    challenge_id: challenge.id,
    visible: visibleRows,
    hidden: hiddenRows,
    mistake_tags: tags,
    explanation,
    debug: {
      culprit_line: lineMap?.culprit_line ?? null,
      confidence: lineMap?.culprit_line ? lineMap.confidence : null,
      reason: lineMap?.reason ?? null,
      trace_ref: id,
      passed,
      detail: firstDetail,
    },
  };
  return { response, record, results, lineMap, headline: headline(results), next };
}

/* ─────────────────────────────── hints ─────────────────────────────── */

export interface HintInput {
  challenge: Challenge;
  code: string;
  ladderKey: LadderKey;
  /** The highest rung this learner has already seen for this challenge + ladder. */
  prevRung: number;
  /** Hints already given on THIS submission. */
  givenOnSubmission: number;
  lineMap: LineMap | null;
  message?: string;
  /** What an AI hint writer may see — public material only (see hint-writer.ts). */
  context?: Pick<HintContext, "tag" | "explanation" | "visible" | "failingKinds" | "previous">;
}

export interface HintOutput {
  rung: number;
  text: string;
  remaining: number;
  note?: string;
  /** "ai" = written for this learner's code by the configured model; "built-in" = the hand-written rung */
  source: "ai" | "built-in";
  ledger: LedgerEntry[];
  masteryDeltas: MasteryDelta[];
}

/** Three hints, then the answer step unlocks (answer.ts — its own endpoint, never a hint). */
export const HINT_RUNGS = 3;

export async function nextHint(x: HintInput, rewriter?: Rewriter | null, writer?: HintWriter | null): Promise<HintOutput> {
  const diag = x.ladderKey === "syntax" ? syntaxDiagnosis(x.code, x.lineMap?.culprit_line ?? null) : null;
  const ladder = (diag ? syntaxLadder(diag) : ladderFor(x.challenge, x.ladderKey)).slice(0, HINT_RUNGS);
  // "give me the answer" → still exactly one rung up. Never a collapse.
  const rung = Math.min(Math.max(x.prevRung, 0) + 1, ladder.length);
  const base = ladder[rung - 1];
  const ledger: LedgerEntry[] = [];
  const fn = x.challenge.fn;
  const prompt = `tier=deterministic · challenge=${x.challenge.id} · ladder=${x.ladderKey} · rung=${rung}/${ladder.length}${isAnswerRequest(x.message) ? " · learner asked for the answer" : ""}`;

  let text = base;
  const line = x.lineMap?.culprit_line ?? null;
  const lineText = line ? (x.code.split(/\r?\n/)[line - 1] ?? "").trim() : "";

  // Rung 2 ("specific") points at their line. If quoting it would put code in
  // the hint, the guardrail rejects the draft and we keep the prose.
  if (rung === 2 && line && lineText && !diag) {
    const draft = `${base} Look at line ${line}: \`${lineText}\`.`;
    const v = validateHint(draft, { fn });
    if (v.ok) text = draft;
    else {
      ledger.push({ kind: "hint", prompt: `${prompt} · contextual draft (quotes line ${line})`, response: draft, model: "deterministic:contextual-draft", rejected_for_code: true });
      text = `${base} Start with line ${line}.`;
    }
  }

  let source: HintOutput["source"] = "built-in";
  if (writer && x.context && !diag) {
    // Written fresh for THIS learner's code. One retry if the checker rejects it; then the hand-written rung.
    const hc: HintContext = { ...x.context, challenge: x.challenge, code: x.code, rung, ladderKey: x.ladderKey, lineMap: x.lineMap, draft: text };
    let reason: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await writer.write(hc, reason).catch(() => null);
      if (!r) break;
      const verdict = acceptHint(r.text, hc);
      ledger.push({ kind: "hint", prompt: r.prompt, response: r.text, model: r.model ?? writer.model, rejected_for_code: !verdict.ok });
      if (verdict.ok) {
        text = verdict.text;
        source = "ai";
        break;
      }
      reason = verdict.reason;
    }
  } else if (rewriter) {
    const r = await rewriter.rewriteHint({ challenge: x.challenge, code: x.code, draft: text, rung }).catch(() => null);
    if (r) {
      const v = validateHint(r.text, { fn });
      const leak = findLeak(r.text, x.challenge, [], x.code);
      ledger.push({ kind: "hint", prompt: r.prompt, response: r.text, model: rewriter.model, rejected_for_code: !v.ok });
      if (v.ok && !leak && r.text.length < 400) {
        text = r.text;
        source = "ai";
      }
    }
  }

  // Last line of defence: whatever we ship has passed the validator.
  if (!validateHint(text, { fn }).ok || findLeak(text, x.challenge, [], x.code)) {
    text = base;
    source = "built-in";
  }

  ledger.push({ kind: "hint", prompt, response: text, model: null, rejected_for_code: false });
  return {
    rung,
    text,
    remaining: ladder.length - rung,
    note: isAnswerRequest(x.message)
      ? "I won't hand you the answer — but here is the next, sharper hint. You're closer than you think."
      : rung === ladder.length
        ? "That's the last hint. Try once more — or open the answer below to see exactly what's wrong and the fixed code."
        : undefined,
    source,
    ledger,
    masteryDeltas: hintDelta(x.challenge.concepts),
  };
}

/* ─────────────────────────────── checking a program ─────────────────────────────── */

/**
 * Runs a program against every visible + hidden test and reports only pass/fail
 * and the KIND of input that failed. Used to prove the answer's fixed code is
 * correct before anyone sees it. Nothing is saved.
 */
export async function checkProgram(challenge: Challenge, code: string, sandbox: Sandbox): Promise<{ passed: boolean; total: number; failingKinds: string[] }> {
  const cases = [...challenge.visible, ...challenge.hidden];
  const session = sandbox.session();
  try {
    const runs = await session.runTests({ code, fn: challenge.fn, tests: cases.map((c) => ({ args: c.args })), timeoutMs: TEST_TIMEOUT_MS });
    const failing = cases.filter((c, i) => classify(runs[i], c.expected, challenge).outcome !== "passed");
    return {
      passed: failing.length === 0,
      total: cases.length,
      failingKinds: [...new Set(failing.map((c) => (c.edge && challenge.edges[c.edge] ? challenge.edges[c.edge].one : "an ordinary input")))],
    };
  } finally {
    session.close();
  }
}

/* ─────────────────────────────── learner ─────────────────────────────── */

export function learnerSummary(learnerId: string, history: HistoryItem[], mastery: MasteryRow[]) {
  const r = rollup(history);
  return { learner_id: learnerId, recurring_mistakes: r.recurring, one_off_mistakes: r.oneOff, where: r.where, next_challenge: nextChallenge(history, mastery) };
}
