"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Circle, CircleDot, Gavel, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, LEVEL_STYLE, PageHeading, TagBadge } from "@/components/app/bits";
import { api, type ChallengeSummary, type LearnerView } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { cn } from "@/lib/utils";

const LEVELS = ["easy", "medium", "hard"] as const;

export default function PracticePage() {
  const router = useRouter();
  const [learner] = useLearner();
  const [list, setList] = useState<ChallengeSummary[]>([]);
  const [judge, setJudge] = useState<string[]>([]);
  const [me, setMe] = useState<LearnerView | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .challenges()
      .then((r) => {
        setList(r.challenges);
        setJudge(r.judge_challenges);
      })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    if (learner) api.learner(learner).then(setMe).catch(() => {});
  }, [learner]);

  const status = useMemo(() => {
    const s: Record<string, "passed" | "tried"> = {};
    for (const h of me?.history ?? []) s[h.challenge_id] = h.passed || s[h.challenge_id] === "passed" ? "passed" : "tried";
    return s;
  }, [me]);
  const isNew = !!me && me.history.length === 0;
  const shown = list.filter((c) => filter === "all" || c.difficulty === filter || (filter === "judge" && judge.includes(c.id)));

  return (
    <AppShell title="Practice" subtitle={`${list.length} challenges · Python`}>
      <PageHeading eyebrow="Practice" title="Pick a bug to hunt." accent="Learn the pattern." body="Every challenge starts with a beginner's attempt that almost works. Fix it. The dojo runs it safely, tells you what kind of input broke it, and points at the line — but never writes the code for you." />

      {err && <Card className="mb-5 text-sm text-[#a8401f]">Couldn&apos;t reach the API ({err}). Start it with <code className="rounded bg-neutral-100 px-1">npm start</code>.</Card>}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {isNew ? (
          <Card tint="green">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#359462]" />
              <p className="font-poppins text-[10px] font-semibold uppercase tracking-[0.18em] text-[#359462]">30-second start</p>
            </div>
            <h3 className="mt-2 font-instrumental text-3xl leading-none text-[#151515]">Where do you want to begin?</h3>
            <p className="mt-2 text-[13px] text-[#6D6878]">Pick a level — we&apos;ll open a challenge most people pass in under three minutes.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    const first = list.find((c) => c.difficulty === l);
                    if (first) router.push(`/challenge/${first.id}`);
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 font-poppins text-sm font-semibold capitalize text-neutral-800 transition-all hover:border-[#359462] hover:bg-[#359462] hover:text-white"
                >
                  {l}
                </button>
              ))}
            </div>
          </Card>
        ) : (
          <Card tint="green">
            <p className="font-poppins text-[10px] font-semibold uppercase tracking-[0.18em] text-[#359462]">Next for you</p>
            {me ? (
              <>
                <h3 className="mt-2 font-instrumental text-3xl leading-none text-[#151515]">{me.next_challenge.challenge_id}</h3>
                <p className="mt-2 text-[13px] leading-5 text-[#4b5b4f]">{me.next_challenge.reason}</p>
                <Link href={`/challenge/${me.next_challenge.challenge_id}`} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-[#359462] px-5 text-[13px] font-semibold text-white hover:bg-[#2c7a51]">
                  Start it <ArrowRight className="size-3.5" />
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">Loading…</p>
            )}
          </Card>
        )}
        <Card tint="purple">
          <p className="font-poppins text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5e2ac4]">Your patterns</p>
          {me && (me.recurring_mistakes.length || me.one_off_mistakes.length) ? (
            <div className="mt-3 space-y-2">
              {me.recurring_mistakes.map((t) => (
                <div key={t} className="flex flex-wrap items-center gap-2">
                  <TagBadge tag={t} />
                  <span className="text-[12px] text-[#6D6878]">recurring · {me.recurring_where[t]?.length ?? 2} challenges</span>
                </div>
              ))}
              {me.one_off_mistakes.map((t) => (
                <div key={t} className="flex flex-wrap items-center gap-2 opacity-70">
                  <TagBadge tag={t} />
                  <span className="text-[12px] text-[#6D6878]">one-off — not a pattern (yet)</span>
                </div>
              ))}
              <Link href="/bug-factory" className="mt-2 inline-flex text-[12.5px] font-semibold text-[#5e2ac4] hover:underline">
                Train it in the Bug Factory →
              </Link>
            </div>
          ) : (
            <>
              <h3 className="mt-2 font-instrumental text-3xl leading-none text-[#151515]">No patterns yet</h3>
              <p className="mt-2 text-[13px] text-[#6D6878]">A mistake becomes a pattern only when it shows up in two different challenges. One slip is just a slip.</p>
            </>
          )}
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {["all", "judge", ...LEVELS].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize transition-colors",
              filter === f ? "bg-[#bbf451] text-black" : "border border-neutral-200/80 bg-white text-neutral-600 hover:border-neutral-950 hover:text-neutral-950",
            )}
          >
            {f === "judge" ? (
              <span className="inline-flex items-center gap-1.5">
                <Gavel className="size-3.5" /> the 4 judge challenges
              </span>
            ) : (
              f
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c, i) => {
          const st = status[c.id];
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1], duration: 0.5 }}>
              <Link href={`/challenge/${c.id}`} className="group block h-full rounded-3xl border border-neutral-200/80 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow-[0_16px_40px_-16px_rgba(16,15,25,0.18)]">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize", LEVEL_STYLE[c.difficulty])}>{c.difficulty}</span>
                  {judge.includes(c.id) && <span className="rounded-full bg-neutral-950 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#bbf451]">judge</span>}
                  <span className="ml-auto">
                    {st === "passed" ? <CheckCircle2 className="size-4 text-[#359462]" /> : st === "tried" ? <CircleDot className="size-4 text-[#f59e0b]" /> : <Circle className="size-4 text-neutral-300" />}
                  </span>
                </div>
                <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{c.title}</h3>
                <p className="mt-0.5 font-mono text-[12px] text-[#0570b0]">{c.signature}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.concept_labels.map((l) => (
                    <span key={l} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-medium text-neutral-600">
                      {l}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-[11.5px] text-neutral-400">
                  <span>
                    {c.visible_count} visible · {c.hidden_count} hidden
                  </span>
                  <span className="font-semibold text-neutral-500 transition-colors group-hover:text-neutral-950">{st === "passed" ? "Practise again" : st === "tried" ? "Keep going" : "Start"} →</span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </AppShell>
  );
}
