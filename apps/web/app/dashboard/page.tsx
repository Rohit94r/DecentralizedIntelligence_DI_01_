"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ArrowRight, Bug, CheckCircle2, Flame, Lightbulb, TrendingUp, XCircle } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, MasteryBar, PageHeading, TagBadge, TAG_COLOR } from "@/components/app/bits";
import { api, timeAgo, type LearnerView } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { cn } from "@/lib/utils";

const CONCEPT_COLOR: Record<string, string> = {
  lists_indexing: "#5e2ac4",
  loops_range: "#0586d2",
  boundaries: "#c64e27",
  conditionals: "#359462",
  strings: "#ec4899",
  accumulators: "#f59e0b",
};

function Timeline({ data, concepts }: { data: LearnerView["mastery_timeline"]; concepts: string[] }) {
  const W = 560;
  const H = 150;
  if (data.length < 2) return <p className="text-[13px] text-neutral-500">Two or more submissions draw the line.</p>;
  const x = (i: number) => 10 + (i * (W - 20)) / (data.length - 1);
  const y = (v: number) => H - 10 - v * (H - 20);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke="currentColor" className="text-neutral-200" strokeDasharray="3 4" />
      ))}
      {concepts.map((c) => {
        const pts = data.map((p, i) => `${x(i)},${y(p.mastery[c] ?? 0.5)}`).join(" ");
        return <motion.polyline key={c} points={pts} fill="none" stroke={CONCEPT_COLOR[c] ?? "#737373"} strokeWidth={2.2} strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />;
      })}
      {data.map((p, i) => (
        <circle key={i} cx={x(i)} cy={H - 4} r={3} fill={p.label.startsWith("✓") ? "#359462" : "#c64e27"}>
          <title>{p.label}</title>
        </circle>
      ))}
    </svg>
  );
}

function Heat({ activity }: { activity: { day: string; n: number }[] }) {
  const days = useMemo(() => {
    const map = new Map(activity.map((a) => [a.day, a.n]));
    const out: { day: string; n: number }[] = [];
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7 * 12 + 1);
    for (let i = 0; i < 7 * 12; i++) {
      const k = d.toISOString().slice(0, 10);
      out.push({ day: k, n: map.get(k) ?? 0 });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }, [activity]);
  const lvl = (n: number) => (n === 0 ? "#f0e4d2" : n < 3 ? "#f5c9a8" : n < 6 ? "#e8956a" : n < 10 ? "#d96a3a" : "#c64e27");
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
      {days.map((d) => (
        <span key={d.day} title={`${d.day}: ${d.n} attempts`} className="size-[11px] rounded-[2px]" style={{ backgroundColor: lvl(d.n) }} />
      ))}
    </div>
  );
}

function Dashboard() {
  const [learner] = useLearner();
  const [me, setMe] = useState<LearnerView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!learner) return;
    setMe(null);
    api.learner(learner).then(setMe).catch((e) => setErr(e.message));
  }, [learner]);

  const concepts = me ? (me.touched_concepts.length ? me.touched_concepts : Object.keys(me.mastery)) : [];
  const first = me?.mastery_timeline[0]?.mastery ?? {};
  const avgNow = concepts.length ? concepts.reduce((s, c) => s + (me?.mastery[c] ?? 0.5), 0) / concepts.length : 0.5;
  const avgFirst = concepts.length ? concepts.reduce((s, c) => s + (first[c] ?? 0.5), 0) / concepts.length : 0.5;

  return (
    <AppShell title="Dashboard" subtitle={learner ? `learner · ${learner}` : undefined}>
      <PageHeading eyebrow="Your arc" title={learner ?? "…"} accent="— how you're learning" body="Mastery is a Beta posterior per concept: a pass without hints moves it most, a hinted pass much less, every failure and every hint pulls it down a little. A mistake is a pattern only when it shows up in two different challenges." />
      {err && <Card className="text-sm text-[#a8401f]">{err}</Card>}
      {!me ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { k: "Submissions", v: me.totals.submissions, icon: TrendingUp },
              { k: "Challenges cleared", v: me.totals.challenges_cleared, icon: CheckCircle2 },
              { k: "First-try passes", v: me.totals.first_try_passes, icon: CheckCircle2 },
              { k: "Hints taken", v: me.totals.hints, icon: Lightbulb },
              { k: "Day streak", v: me.streak_days, icon: Flame },
            ].map(({ k, v, icon: Icon }) => (
              <div key={k} className="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3.5">
                <Icon className="size-4 text-neutral-400" />
                <p className="mt-2 text-[24px] font-medium tabular-nums leading-none tracking-[-0.03em] text-neutral-950">
                  <NumberFlow value={v} />
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">{k}</p>
              </div>
            ))}
          </div>

          <motion.div initial={{ rotateX: -75, opacity: 0, y: 20 }} animate={{ rotateX: 0, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.25 }} style={{ transformPerspective: 900 }}>
            <Card tint="green" className="relative overflow-hidden">
              <p className="font-poppins text-[10px] font-semibold uppercase tracking-[0.18em] text-[#359462]">Why this next</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <h3 className="font-instrumental text-4xl leading-none text-[#151515]">{me.next_challenge.challenge_id}</h3>
                  <p className="mt-3 text-[14.5px] leading-[1.6] text-[#33473a]">{me.next_challenge.reason}</p>
                </div>
                <Link href={`/challenge/${me.next_challenge.challenge_id}`} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#359462] px-6 text-[14px] font-semibold text-white hover:bg-[#2c7a51]">
                  Start it <ArrowRight className="size-4" />
                </Link>
              </div>
            </Card>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between">
                <SectionLabel>Mastery per concept</SectionLabel>
                {me.mastery_timeline.length > 1 && (
                  <span className={cn("text-[12px] font-semibold", avgNow >= avgFirst ? "text-[#2f7c53]" : "text-[#a8401f]")}>
                    {avgNow >= avgFirst ? "▲" : "▼"} {Math.abs(Math.round((avgNow - avgFirst) * 100))} pts since your first attempt
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-3.5">
                {concepts.map((c) => (
                  <MasteryBar key={c} label={me.concept_labels[c] ?? c} value={me.mastery[c] ?? 0.5} color={CONCEPT_COLOR[c]} delta={(me.mastery[c] ?? 0.5) - (first[c] ?? 0.5)} />
                ))}
              </div>
              <div className="mt-5">
                <SectionLabel className="mb-1">Mastery over time</SectionLabel>
                <Timeline data={me.mastery_timeline} concepts={concepts} />
                <div className="flex flex-wrap gap-3 text-[11px] text-neutral-500">
                  {concepts.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full" style={{ backgroundColor: CONCEPT_COLOR[c] }} />
                      {me.concept_labels[c]}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            <div className="space-y-5">
              <Card tint="orange">
                <SectionLabel>Recurring mistakes</SectionLabel>
                {me.recurring_mistakes.length ? (
                  <div className="mt-3 space-y-3">
                    {me.recurring_mistakes.map((t) => (
                      <div key={t} className="rounded-2xl bg-white/80 px-4 py-3">
                        <TagBadge tag={t} />
                        <p className="mt-2 text-[12.5px] text-[#6D6878]">
                          in {me.recurring_where[t]?.length} different challenges: <span className="font-mono text-neutral-800">{me.recurring_where[t]?.join(", ")}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] text-[#6D6878]">Nothing recurring. A tag only counts when it appears in two different challenges.</p>
                )}
                {me.one_off_mistakes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b08968]">One-off slips (not patterns)</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {me.one_off_mistakes.map((t) => (
                        <TagBadge key={t} tag={t} className="opacity-70" />
                      ))}
                    </div>
                  </div>
                )}
              </Card>
              <Card tint="purple">
                <div className="flex items-center gap-2">
                  <Bug className="size-4 text-[#5e2ac4]" />
                  <SectionLabel>Bug Factory, built for you</SectionLabel>
                </div>
                <p className="mt-2 text-[13.5px] leading-5 text-[#4a3d6b]">{me.bug_factory.reason}</p>
                <Link href="/bug-factory" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#5e2ac4] px-4 text-[13px] font-semibold text-white hover:bg-[#4c22a3]">
                  Find the bug <ArrowRight className="size-3.5" />
                </Link>
              </Card>
              <Card>
                <SectionLabel>Practice · last 12 weeks</SectionLabel>
                <div className="mt-3 overflow-x-auto">
                  <Heat activity={me.activity} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-neutral-500">
                    {me.streak.today_done
                      ? `${me.streak_days}-day streak — today is done, come back tomorrow.`
                      : me.streak.at_risk
                        ? `Solve one problem today to keep your ${me.streak_days}-day streak.`
                        : "Solve one problem a day to build a streak — each day pays 100 points."}
                  </p>
                  <Link href="/rewards" className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3 py-1 text-[11.5px] font-semibold text-white">
                    ⚡ {me.streak.points.toLocaleString("en-IN")} points · Rewards <ArrowRight className="size-3" />
                  </Link>
                </div>
              </Card>
            </div>
          </div>

          <Card>
            <SectionLabel>History — what you tried</SectionLabel>
            <div className="mt-3 divide-y divide-neutral-100">
              {[...me.history].reverse().map((h, i) => (
                <motion.div key={h.submission_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                  <Link href={`/challenge/${h.challenge_id}?submission=${h.submission_id}`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-neutral-50/70">
                    {h.passed ? <CheckCircle2 className="size-4 text-[#359462]" /> : <XCircle className="size-4 text-[#c64e27]" />}
                    <span className="font-mono text-[12.5px] font-semibold text-neutral-900">{h.challenge_id}</span>
                    {h.tags.map((t) => (
                      <span key={t} className="font-mono text-[11px]" style={{ color: TAG_COLOR[t] }}>
                        {t}
                      </span>
                    ))}
                    {h.hints_used > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                        <Lightbulb className="size-3" /> {h.hints_used}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[11px] text-neutral-400">
                      {h.submission_id} · {timeAgo(h.at)}
                    </span>
                  </Link>
                </motion.div>
              ))}
              {!me.history.length && <p className="py-3 text-[13px] text-neutral-500">No submissions yet — <Link className="font-semibold underline" href="/practice">start practising</Link>.</p>}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
