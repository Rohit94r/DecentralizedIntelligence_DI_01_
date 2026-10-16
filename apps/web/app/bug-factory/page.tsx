"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Bug, CheckCircle2, Crosshair, Loader2, Send, Wrench } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, OutcomeChip, PageHeading, TagBadge } from "@/components/app/bits";
import { CodeEditor } from "@/components/app/CodeEditor";
import { api, type Challenge, type SubmitResult, type Outcome } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { cn } from "@/lib/utils";

interface Pick {
  challenge: Challenge;
  tag: string;
  tag_label: string;
  reason: string;
  found: boolean;
  attempts: number;
  templates?: { challenge_id: string; tag: string; title: string }[];
}

function Factory() {
  const [learner] = useLearner();
  const [pick, setPick] = useState<Pick | null>(null);
  const [templates, setTemplates] = useState<Pick["templates"]>([]);
  const [mode, setMode] = useState<"find" | "fix">("find");
  const [marks, setMarks] = useState<Record<number, "right" | "wrong">>({});
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (challengeId?: string) => {
      if (!learner) return;
      api
        .bugFactory(learner, challengeId)
        .then((p) => {
          setPick(p);
          if (p.templates) setTemplates(p.templates);
          setCode(p.challenge.starter);
          setMode(p.found ? "fix" : "find");
          setMarks({});
          setMessage(p.found ? "You already found this bug — now fix it." : null);
          setResult(null);
        })
        .catch(() => {});
    },
    [learner],
  );
  useEffect(() => load(), [load]);

  const locate = async (line: number) => {
    if (!learner || !pick || mode !== "find") return;
    const r = await api.locate(learner, pick.challenge.id, line);
    setMarks((m) => ({ ...m, [line]: r.correct ? "right" : "wrong" }));
    setMessage(r.message);
    if (r.correct) setTimeout(() => setMode("fix"), 900);
  };

  const submit = async () => {
    if (!learner || !pick) return;
    setBusy(true);
    try {
      const r = await api.submit(learner, pick.challenge.id, code);
      setResult(r);
      if (r.debug?.passed) (await import("canvas-confetti")).default({ particleCount: 120, spread: 80, origin: { y: 0.4 } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Bug Factory" subtitle="find the bug, don't write the code">
      <PageHeading eyebrow="OB3 · Bug Factory" title="Find the bug." accent="Then fix it." body="Writing from scratch is hard; spotting one bug is a learnable skill. This program was generated from the mistake you make most — click the line you think is wrong, then repair it. It counts as a real challenge: it feeds your mastery and your recurrence." />
      {!pick ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card tint="purple">
              <div className="flex flex-wrap items-center gap-2">
                <Bug className="size-4 text-[#5e2ac4]" />
                <TagBadge tag={pick.tag} />
                <span className="text-[12px] text-[#6D6878]">{pick.tag_label}</span>
              </div>
              <h2 className="mt-2 font-instrumental text-3xl leading-none text-[#151515]">{pick.challenge.title.replace("Bug Factory · ", "")}</h2>
              <p className="mt-1 font-mono text-[12.5px] text-[#5e2ac4]">{pick.challenge.signature}</p>
              <p className="mt-2 text-[13.5px] leading-5 text-[#4a3d6b]">{pick.challenge.description}</p>
              <p className="mt-2 text-[12px] italic text-[#6D6878]">{pick.reason}</p>
            </Card>

            <div className="flex gap-2">
              {(["find", "fix"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => (m === "fix" && !Object.values(marks).includes("right") && !pick.found ? null : setMode(m))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold",
                    mode === m ? "bg-[#bbf451] text-black" : "border border-neutral-200/80 bg-white text-neutral-500",
                    m === "fix" && !Object.values(marks).includes("right") && !pick.found && "cursor-not-allowed opacity-50",
                  )}
                >
                  {m === "find" ? <Crosshair className="size-3.5" /> : <Wrench className="size-3.5" />}
                  {m === "find" ? "1 · Find it" : "2 · Fix it"}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {message && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("rounded-2xl px-4 py-2.5 text-[13px]", Object.values(marks).includes("right") || pick.found ? "bg-[#eeffe8] text-[#2f7c53]" : "bg-[#fff2df] text-[#a8401f]")}>
                  {message}
                </motion.p>
              )}
            </AnimatePresence>

            {mode === "find" ? (
              <>
                <p className="text-[12.5px] text-neutral-500">Click the line number (or the line) you think holds the bug.</p>
                <CodeEditor value={pick.challenge.starter} readOnly onLineClick={locate} markedLines={marks} minLines={6} />
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <CodeEditor value={code} onChange={setCode} minLines={6} culpritLine={result?.debug?.culprit_line ?? null} culpritNote={result?.debug?.reason ?? null} />
                <button type="submit" disabled={busy} className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-6 text-[14px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit the fix
                </button>
              </form>
            )}
          </div>

          <div className="space-y-4">
            {result && (
              <Card>
                <p className={cn("text-[17px] font-semibold", result.debug?.passed ? "text-[#2f7c53]" : "text-neutral-900")}>
                  {result.debug?.passed ? (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="size-5" /> Fixed. Every test passes.
                    </span>
                  ) : (
                    result.debug?.headline
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {[...result.visible, ...result.hidden].map((t, i) => (
                    <OutcomeChip key={i} outcome={t.outcome as Outcome} className="text-[10px]" />
                  ))}
                </div>
                <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3 text-[13.5px] leading-[1.55] text-neutral-800">{result.explanation}</p>
                {!result.debug?.passed && (
                  <Link href={`/challenge/${pick.challenge.id}`} className="mt-3 inline-flex text-[12.5px] font-semibold text-neutral-600 hover:text-neutral-950">
                    Need a hint or a replay? Open it in the workspace →
                  </Link>
                )}
              </Card>
            )}
            <Card>
              <SectionLabel>Other templates</SectionLabel>
              <div className="mt-3 space-y-1.5">
                {templates?.map((t) => (
                  <button key={t.challenge_id} onClick={() => load(t.challenge_id)} className={cn("flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left hover:bg-neutral-50", t.challenge_id === pick.challenge.id && "bg-neutral-100")}>
                    <TagBadge tag={t.tag} />
                    <span className="truncate text-[12.5px] text-neutral-600">{t.title.replace("Bug Factory · ", "")}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function BugFactoryPage() {
  return (
    <Suspense>
      <Factory />
    </Suspense>
  );
}
