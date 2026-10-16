"use client";

/**
 * The workspace: write → submit → see what happened (in plain words) →
 * see WHERE (Line Map) → see HOW (Time-Travel Replay) → climb the hint ladder
 * if stuck → watch mastery move → go to the next problem chosen for you.
 */
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Lightbulb, Loader2, MapPin, Pause, Play, RotateCcw, Send, Sparkles, StepBack, StepForward, History } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { CodeEditor } from "@/components/app/CodeEditor";
import { Card, LEVEL_STYLE, MasteryBar, OutcomeChip, Prose, TagBadge } from "@/components/app/bits";
import { api, type Challenge, type HintResult, type LearnerView, type Outcome, type SubmitResult, type TraceResult } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { cn } from "@/lib/utils";

const RUNG_NAMES = ["", "nudge", "specific", "mechanism", "built-in"];

function DrawCheck() {
  return (
    <svg viewBox="0 0 52 52" className="size-12">
      <motion.circle cx="26" cy="26" r="24" fill="none" stroke="#359462" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
      <motion.path d="M15 27 l7 7 l15 -16" fill="none" stroke="#359462" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.45, duration: 0.45 }} />
    </svg>
  );
}

async function celebrate() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({ particleCount: 110, spread: 75, origin: { y: 0.35 }, colors: ["#bbf451", "#359462", "#0586d2", "#f59e0b", "#7B35F0"] });
  setTimeout(() => confetti({ particleCount: 60, spread: 110, origin: { y: 0.4 } }), 250);
}

function Workspace() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [learner] = useLearner();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<HintResult[]>([]);
  const [hintBusy, setHintBusy] = useState(false);
  const [replay, setReplay] = useState<TraceResult | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [customArgs, setCustomArgs] = useState("");
  const [before, setBefore] = useState<LearnerView | null>(null);
  const [after, setAfter] = useState<LearnerView | null>(null);
  const autoran = useRef(false);
  const draftKey = learner ? `dojo-draft:${learner}:${id}` : null;

  useEffect(() => {
    api
      .challenge(id)
      .then((c) => {
        setChallenge(c);
        let draft: string | null = null;
        try {
          draft = draftKey ? localStorage.getItem(draftKey) : null;
        } catch {
          /* ignore */
        }
        setCode(search.get("fresh") ? c.starter : (draft ?? c.starter));
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, draftKey]);

  useEffect(() => {
    if (!learner) return;
    api.learner(learner).then(setBefore).catch(() => {});
  }, [learner]);

  // Reload a stored submission (from the dashboard's history) — shows the learner's own result only.
  useEffect(() => {
    const sid = search.get("submission");
    if (!sid) return;
    fetch(`/api/submissions/${sid}`)
      .then((r) => r.json())
      .then((s) => {
        if (!s.submission_id) return;
        setCode(s.code);
        setResult({
          submission_id: s.submission_id,
          learner_id: s.learner_id,
          challenge_id: s.challenge_id,
          visible: s.visible,
          hidden: s.hidden,
          mistake_tags: s.mistake_tags,
          explanation: s.explanation,
          debug: { culprit_line: s.analysis?.culprit_line ?? null, confidence: s.analysis?.confidence ?? null, reason: s.analysis?.reason ?? null, trace_ref: s.submission_id, passed: s.passed, detail: null, headline: s.passed ? "Every test passes. Beautiful." : "A past attempt — run it again or ask for a hint." },
        });
        setHints(s.hints.map((h: { idx: number; rung: number; text: string }) => ({ submission_id: s.submission_id, hint_index: h.idx, rung: h.rung, hint: h.text, remaining: 4 - h.rung })));
      })
      .catch(() => {});
  }, [search]);

  const saveDraft = (v: string) => {
    setCode(v);
    try {
      if (draftKey) localStorage.setItem(draftKey, v);
    } catch {
      /* ignore */
    }
  };

  const submit = useCallback(
    async (source?: string) => {
      if (!learner || !challenge) return;
      setRunning(true);
      setError(null);
      setReplay(null);
      setHints([]);
      setAfter(null);
      try {
        const r = await api.submit(learner, challenge.id, source ?? code);
        setResult(r);
        if (r.debug?.passed) celebrate();
        api.learner(learner).then((l) => setAfter(l)).catch(() => {});
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setRunning(false);
      }
    },
    [learner, challenge, code],
  );

  useEffect(() => {
    if (search.get("autorun") && challenge && learner && !autoran.current) {
      autoran.current = true;
      submit(challenge.starter);
    }
  }, [search, challenge, learner, submit]);

  const askHint = async (message?: string) => {
    if (!result) return;
    setHintBusy(true);
    try {
      const h = await api.hint(result.submission_id, message);
      setHints((x) => [...x, h]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHintBusy(false);
    }
  };

  const runReplay = async (opts: { kind?: string; args_source?: string } = {}) => {
    if (!result) return;
    setReplayBusy(true);
    setPlaying(false);
    try {
      const r = await api.replay(result.submission_id, opts);
      setReplay(r);
      setStep(r.firstWrongStep ? Math.max(0, r.firstWrongStep - 1) : 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReplayBusy(false);
    }
  };

  useEffect(() => {
    if (!playing || !replay) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= replay.steps.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 650);
    return () => clearInterval(id);
  }, [playing, replay]);

  const passed = !!result?.debug?.passed;
  const failing = result ? [...result.visible, ...result.hidden].filter((t) => t.outcome !== "passed").length : 0;
  const currentStep = replay?.steps[step];
  const concepts = challenge?.concepts ?? [];
  const nextUp = after?.next_challenge;
  const lastHint = hints[hints.length - 1];
  const remaining = lastHint ? lastHint.remaining : 4;

  const masteryRows = useMemo(
    () =>
      concepts.map((c) => ({
        c,
        label: after?.concept_labels?.[c] ?? before?.concept_labels?.[c] ?? c,
        now: after?.mastery?.[c] ?? before?.mastery?.[c] ?? 0.5,
        delta: after && before ? (after.mastery[c] ?? 0.5) - (before.mastery[c] ?? 0.5) : undefined,
      })),
    [concepts, after, before],
  );

  if (error && !challenge) {
    return (
      <AppShell title="Challenge">
        <Card>
          <p className="text-sm text-neutral-600">Couldn&apos;t load this challenge ({error}). Is the API running? Try <Link className="underline" href="/practice">the practice list</Link>.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title={challenge?.title ?? "Loading…"} subtitle={challenge?.signature} wide>
      {!challenge ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" /> Loading the challenge…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* ── left: the task + the code ── */}
          <div className="min-w-0 space-y-5">
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize", LEVEL_STYLE[challenge.difficulty])}>{challenge.difficulty}</span>
                {challenge.concept_labels.map((c) => (
                  <span key={c} className="rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600">
                    {c}
                  </span>
                ))}
                {challenge.bug_factory && <TagBadge tag={challenge.bug_factory.tag} />}
              </div>
              <h1 className="mt-3 text-[1.7rem] font-medium leading-[1.1] tracking-[-0.04em] text-[#17152A] dark:text-neutral-50">{challenge.title}</h1>
              <p className="mt-1 font-mono text-[13px] text-[#0570b0]">{challenge.signature}</p>
              <p className="mt-3 text-[14.5px] font-medium leading-[1.55] tracking-[-0.01em] text-neutral-700">{challenge.description}</p>
              <p className="mt-2 text-[12.5px] text-neutral-500">
                <span className="font-semibold text-neutral-600">Inputs:</span> {challenge.inputs}
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200/70">
                <div className="flex items-center justify-between bg-neutral-50 px-3.5 py-2">
                  <SectionLabel>Visible examples</SectionLabel>
                  <span className="text-[11px] text-neutral-400">+ {challenge.hidden_count} hidden tests you won&apos;t see</span>
                </div>
                {challenge.visible.map((v) => (
                  <div key={v.test} className="flex items-center gap-3 border-t border-neutral-100 px-3.5 py-2 font-mono text-[12.5px]">
                    <span className="text-neutral-400">{v.test}</span>
                    <span className="min-w-0 flex-1 truncate text-neutral-800">{v.call}</span>
                    <span className="text-neutral-400">→</span>
                    <span className="font-semibold text-neutral-900">{v.expected}</span>
                  </div>
                ))}
              </div>
            </Card>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <CodeEditor
                value={code}
                onChange={saveDraft}
                culpritLine={replay ? null : (result?.debug?.culprit_line ?? null)}
                culpritNote={result?.debug?.reason ?? null}
                confidence={result?.debug?.confidence ?? null}
                replayLine={currentStep?.line ?? null}
                minLines={10}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={running || !learner}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-6 text-[14px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:bg-neutral-400"
                >
                  {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {running ? `Running ${challenge.visible_count + challenge.hidden_count} tests in the sandbox…` : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => askHint()}
                  disabled={!result || passed || hintBusy || remaining <= 0}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-lime-500/70 bg-lime-300 px-5 text-[14px] font-semibold text-black transition-colors hover:bg-lime-400 disabled:opacity-40"
                >
                  <Lightbulb className="size-4" /> Get a hint
                </button>
                <button
                  type="button"
                  onClick={() => runReplay()}
                  disabled={!result || replayBusy}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-5 text-[14px] font-semibold text-neutral-800 transition-colors hover:border-neutral-950 disabled:opacity-40"
                >
                  <History className="size-4" /> Replay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveDraft(challenge.starter);
                    setResult(null);
                    setReplay(null);
                    setHints([]);
                  }}
                  className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <RotateCcw className="size-3.5" /> Reset to starter
                </button>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">Tab indents · Ctrl/⌘ + Enter submits · your draft is saved in this browser</p>
            </form>
          </div>

          {/* ── right: what happened ── */}
          <div className="min-w-0 space-y-5">
            {error && <div className="rounded-2xl border border-[#f0d9b8] bg-[#fff2df] px-4 py-3 text-[13px] text-[#a8401f]">{error}</div>}

            <div className={cn("rounded-3xl", running && "scan-sweep")}>
              {!result && !running && (
                <Card className="text-center">
                  <Sparkles className="mx-auto size-6 text-[#359462]" />
                  <p className="mt-3 text-[15px] font-semibold text-neutral-900">Run your code to see what happens</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-neutral-500">
                    Visible tests show their values. Hidden tests only show whether they pass — the dojo tells you what <em>kind</em> of input broke, never the input itself.
                  </p>
                </Card>
              )}
              {running && !result && (
                <Card>
                  <p className="shimmer text-[15px] font-semibold">Running your code in a fresh WebAssembly sandbox…</p>
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i} className="h-9 rounded-xl bg-neutral-100" />
                    ))}
                  </div>
                </Card>
              )}
              {result && (
                <Card className={cn(running && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    {passed && <DrawCheck />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[18px] font-semibold leading-snug tracking-[-0.02em]", passed ? "text-[#2f7c53]" : "text-neutral-900")}>{result.debug?.headline}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
                        <span className="font-semibold tabular-nums text-neutral-800">
                          {result.visible.filter((v) => v.outcome === "passed").length}/{result.visible.length} visible
                        </span>
                        <span>·</span>
                        <span className="font-semibold tabular-nums text-neutral-800">
                          {result.hidden.filter((v) => v.outcome === "passed").length}/{result.hidden.length} hidden
                        </span>
                        {result.mistake_tags.map((t) => (
                          <TagBadge key={t} tag={t} />
                        ))}
                        {result.debug?.detail && <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-600">{result.debug.detail}</span>}
                        <span className="ml-auto font-mono text-[11px] text-neutral-400">{result.submission_id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200/70">
                    {result.visible.map((v, i) => (
                      <motion.div
                        key={`${result.submission_id}-${v.test}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={v.outcome === "passed" ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: [0, -2, 2, -2, 0] }}
                        transition={{ delay: i * 0.04, x: { delay: 0.3 + i * 0.04, duration: 0.35 } }}
                        className="border-t border-neutral-100 px-3.5 py-2.5 first:border-t-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[12px] text-neutral-400">{v.test}</span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-neutral-800">{v.call}</span>
                          <OutcomeChip outcome={v.outcome} />
                        </div>
                        {v.outcome !== "passed" && (
                          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 pl-6 font-mono text-[12px]">
                            <span className="text-neutral-400">expected</span>
                            <span className="text-neutral-800">{v.expected}</span>
                            <span className="text-neutral-400">got</span>
                            <span className="break-all text-[#a8401f]">{v.got}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.hidden.map((h, i) => (
                      <motion.span
                        key={`${result.submission_id}-h${h.test}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.04, type: "spring", stiffness: 420, damping: 22 }}
                        className={`out-${h.outcome as Outcome} rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold`}
                        title="Hidden tests show only their outcome — never their input or expected value"
                      >
                        hidden {h.test} · {h.outcome}
                      </motion.span>
                    ))}
                  </div>

                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3.5">
                    <SectionLabel>What happened</SectionLabel>
                    <p className="mt-1.5 text-[14px] leading-[1.6] text-neutral-800">{result.explanation}</p>
                  </motion.div>

                  {result.debug?.culprit_line && !passed && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[#fde1a8] bg-[#fff6e3] px-4 py-3">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-[#c98a2b]" />
                      <p className="text-[13px] leading-5 text-[#7a5414]">
                        <span className="font-semibold">Line Map · line {result.debug.culprit_line}</span> ({result.debug.confidence}) — {result.debug.reason}
                      </p>
                    </motion.div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!passed && (
                      <button onClick={() => askHint()} disabled={hintBusy || remaining <= 0} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-neutral-800 hover:border-neutral-950 disabled:opacity-40">
                        <Lightbulb className="size-3.5" /> Get a hint
                      </button>
                    )}
                    {!passed && (
                      <button onClick={() => runReplay()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-neutral-800 hover:border-neutral-950">
                        <History className="size-3.5" /> Watch it run
                      </button>
                    )}
                    {nextUp && (
                      <Link href={`/challenge/${nextUp.challenge_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800">
                        Next for you: {nextUp.challenge_id} <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                  {nextUp && <p className="mt-2 text-[12px] leading-5 text-neutral-500">{nextUp.reason}</p>}
                </Card>
              )}
            </div>

            {/* hint ladder */}
            {result && !passed && (
              <Card tint="green">
                <div className="flex items-center justify-between">
                  <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Hint ladder</h3>
                  <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#359462]">{hints.length ? `rung ${lastHint.rung} of 4` : "4 rungs · never the answer"}</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[1, 2, 3, 4].map((r) => {
                    const got = hints.find((x) => x.rung === r);
                    return (
                      <AnimatePresence key={r} mode="popLayout">
                        <motion.div
                          layout
                          initial={got ? { opacity: 0, scale: 0.96, y: 6 } : false}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className={cn("rounded-2xl px-4 py-3", got ? "bg-white shadow-sm" : "bg-white/50")}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold", got ? "bg-[#359462] text-white" : "bg-neutral-200 text-neutral-500")}>{r}</span>
                            <span className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{RUNG_NAMES[r]}</span>
                            {got && <span className="ml-auto text-[10.5px] font-semibold text-[#2f7c53]">✓ prose only · validated</span>}
                          </div>
                          <p className={cn("mt-1.5 text-[13.5px] leading-[1.55]", got ? "text-neutral-800" : "select-none text-neutral-400 blur-[3px]")}>
                            {got ? <Prose text={got.hint} /> : "Locked until you ask — try one more idea of your own first."}
                          </p>
                          {got?.note && <p className="mt-1.5 text-[12px] font-semibold text-[#0586d2]">{got.note}</p>}
                        </motion.div>
                      </AnimatePresence>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => askHint()} disabled={hintBusy || remaining <= 0} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#359462] px-4 text-[13px] font-semibold text-white hover:bg-[#2c7a51] disabled:opacity-40">
                    {hintBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Lightbulb className="size-3.5" />} {hints.length ? "Next hint" : "First hint"}
                  </button>
                  <button
                    onClick={() => askHint("just tell me the answer")}
                    disabled={hintBusy || remaining <= 0}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#359462]/40 bg-white/70 px-4 text-[13px] font-semibold text-[#2f7c53] hover:bg-white disabled:opacity-40"
                  >
                    Just tell me the answer
                  </button>
                </div>
                <p className="mt-2 text-[11.5px] text-[#4b6b55]">Each hint costs a little mastery — a pass without hints counts for almost three times as much.</p>
              </Card>
            )}

            {/* time-travel replay */}
            {replay && (
              <Card tint="purple">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Time-travel replay</h3>
                  <span className="font-mono text-[11.5px] text-[#5e2ac4]">{replay.call}</span>
                </div>
                <p className="mt-1.5 text-[12px] text-[#6D6878]">Your own code, on a public example of the failing kind of input — every value is yours, none are hidden.</p>
                {replay.steps.length > 0 ? (
                  <>
                    <div className="mt-4 flex items-center gap-2">
                      <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="flex size-8 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm hover:bg-neutral-50">
                        <StepBack className="size-3.5" />
                      </button>
                      <button onClick={() => setPlaying((p) => !p)} className="flex size-8 items-center justify-center rounded-full bg-[#5e2ac4] text-white shadow-sm">
                        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </button>
                      <button onClick={() => setStep((s) => Math.min(replay.steps.length - 1, s + 1))} className="flex size-8 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm hover:bg-neutral-50">
                        <StepForward className="size-3.5" />
                      </button>
                      <input type="range" min={0} max={replay.steps.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))} className="flex-1 cursor-pointer accent-[#5e2ac4]" />
                      <span className="w-16 text-right font-mono text-[11px] tabular-nums text-neutral-500">
                        {step + 1}/{replay.steps.length}
                      </span>
                    </div>
                    {currentStep && (
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 6 }}
                        animate={currentStep.flag ? { opacity: 1, y: 0, boxShadow: ["0 0 0 0 rgba(198,78,39,0.5)", "0 0 0 8px rgba(198,78,39,0)", "0 0 0 0 rgba(198,78,39,0)"] } : { opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className={cn("mt-3 rounded-2xl px-4 py-3", currentStep.flag ? "border border-[#c64e27]/40 bg-[#fff2df]" : "bg-white shadow-sm")}
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-500">
                          <span>step {currentStep.step}</span>
                          <span>·</span>
                          <span>line {currentStep.line}</span>
                          <span>·</span>
                          <span>{currentStep.event}</span>
                          {replay.firstWrongStep === currentStep.step && <span className="ml-auto rounded-full bg-[#c64e27] px-2 py-0.5 text-[10px] text-white">first wrong step</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[12px]">
                          {Object.entries(currentStep.locals).map(([k, v]) => (
                            <span key={k} className="rounded-lg bg-neutral-100 px-2 py-0.5 text-neutral-800">
                              <span className="text-[#5e2ac4]">{k}</span> = {v}
                            </span>
                          ))}
                        </div>
                        {currentStep.note && <p className="mt-2 text-[12.5px] font-semibold text-[#a8401f]">{currentStep.note}</p>}
                      </motion.div>
                    )}
                    <div className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto">
                      {replay.steps.map((s, i) => (
                        <button
                          key={s.step}
                          onClick={() => setStep(i)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2.5 py-1 text-left font-mono text-[11px]",
                            i === step ? "bg-[#5e2ac4] text-white" : s.flag ? "bg-[#fff2df] text-[#a8401f]" : "bg-white/60 text-neutral-600 hover:bg-white",
                          )}
                        >
                          <span className="w-12 shrink-0">#{s.step} L{s.line}</span>
                          <span className="truncate">{Object.entries(s.locals).map(([k, v]) => `${k}=${v}`).join("  ")}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-[13px] text-neutral-600">{replay.error ?? "Nothing to step through."}</p>
                )}
                {(replay.result || replay.error) && (
                  <p className="mt-3 font-mono text-[12px] text-neutral-700">
                    {replay.error ? `→ ${replay.error}` : `→ returned ${replay.result}`}
                    {replay.truncated && " (stopped after 250 steps — that loop may never end)"}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {replay.kinds?.map((k) => (
                    <button
                      key={k.kind}
                      onClick={() => runReplay({ kind: k.kind })}
                      className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", replay.used_kind === k.kind ? "border-[#5e2ac4] bg-[#5e2ac4] text-white" : "border-[#ddd0ff] bg-white text-[#5e2ac4] hover:border-[#5e2ac4]")}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customArgs.trim()) runReplay({ args_source: customArgs });
                  }}
                >
                  <input
                    value={customArgs}
                    onChange={(e) => setCustomArgs(e.target.value)}
                    placeholder={`Your own input, e.g. ${challenge.probes[0]?.call.replace(/^[^(]*\(|\)$/g, "") ?? "[2, 5], 3"}`}
                    className="h-9 min-w-0 flex-1 rounded-full border border-[#ddd0ff] bg-white px-3.5 font-mono text-[12px] outline-none focus:border-[#5e2ac4]"
                  />
                  <button disabled={replayBusy} className="h-9 rounded-full bg-[#5e2ac4] px-4 text-[12px] font-semibold text-white disabled:opacity-50">
                    {replayBusy ? "…" : "Replay"}
                  </button>
                </form>
              </Card>
            )}

            {/* mastery moving with the evidence */}
            {result && (
              <Card>
                <div className="flex items-center justify-between">
                  <SectionLabel>Mastery · {learner}</SectionLabel>
                  <Link href="/dashboard" className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-950">
                    Dashboard →
                  </Link>
                </div>
                <div className="mt-3 space-y-3">
                  {masteryRows.map((m) => (
                    <MasteryBar key={m.c} label={m.label} value={m.now} delta={m.delta} color={passed ? "#359462" : "#f59e0b"} />
                  ))}
                </div>
                {after?.recurring_mistakes?.length ? (
                  <p className="mt-3 text-[12px] text-neutral-500">
                    Recurring for you: {after.recurring_mistakes.map((t) => (
                      <TagBadge key={t} tag={t} className="mr-1" />
                    ))}
                  </p>
                ) : null}
              </Card>
            )}
            {failing > 0 && <span className="sr-only">{failing} tests failing</span>}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ChallengePage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
