"use client";

/**
 * Dashboard — one calm page with everything a learner needs: what to do next,
 * how their skills are moving, the mistakes that keep coming back, the hints
 * they used, their activity map, and their rewards.
 */
import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Flame, Gift, IndianRupee, Lightbulb, Target, XCircle, Zap } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { ActivityMap } from "@/components/app/ActivityMap";
import { Card, MasteryBar, TagBadge } from "@/components/app/bits";
import { api, timeAgo, type LearnerView, type LedgerEntry, type RewardsView } from "@/lib/api";
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

const nameOf = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

function Stat({ label, value, sub, icon: Icon }: { label: string; value: React.ReactNode; sub?: string; icon: typeof Target }) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-3.5">
      <div className="flex items-center justify-between text-neutral-400">
        <span className="text-[11.5px] font-medium text-neutral-500">{label}</span>
        <Icon className="size-4" />
      </div>
      <p className="mt-1.5 text-[24px] font-semibold tabular-nums leading-none tracking-[-0.02em] text-neutral-950">{value}</p>
      {sub && <p className="mt-1 text-[11.5px] text-neutral-500">{sub}</p>}
    </div>
  );
}

function hintInfo(e: LedgerEntry) {
  return { challenge: e.prompt.match(/challenge=([\w-]+)/)?.[1] ?? null, rung: e.prompt.match(/rung=(\d+)/)?.[1] ?? null };
}

function Dashboard() {
  const [learner] = useLearner();
  const [me, setMe] = useState<LearnerView | null>(null);
  const [rw, setRw] = useState<RewardsView | null>(null);
  const [hints, setHints] = useState<LedgerEntry[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(12);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .challenges(true)
      .then((c) => {
        setTitles(Object.fromEntries(c.challenges.map((x) => [x.id, x.title.replace("Bug Factory · ", "")])));
        setTotal(c.challenges.filter((x) => !x.bug_factory).length);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!learner) return;
    setMe(null);
    setRw(null);
    api.learner(learner).then(setMe).catch((e) => setErr((e as Error).message));
    api.rewards(learner).then(setRw).catch(() => {});
    api
      .ledger({ learner_id: learner, kind: "hint" })
      .then((l) => setHints(l.entries.filter((e) => !e.rejected_for_code).slice(0, 4)))
      .catch(() => {});
  }, [learner]);

  const title = (id: string) => titles[id] ?? id;
  const concepts = me ? (me.touched_concepts.length ? me.touched_concepts : []) : [];
  const first = me?.mastery_timeline[0]?.mastery ?? {};
  const isNew = !!me && me.history.length === 0;
  const recent = useMemo(() => (me ? [...me.history].reverse().slice(0, 6) : []), [me]);
  const nextGoodie = rw ? ([...rw.goodies].sort((a, b) => a.points - b.points).find((g) => !g.affordable) ?? [...rw.goodies].sort((a, b) => b.points - a.points)[0]) : null;

  return (
    <AppShell title="Dashboard" subtitle={learner ? `learner · ${learner}` : undefined}>
      {err && <Card className="mb-4 text-sm text-[#a8401f]">{err}</Card>}
      {!me ? (
        <div className="space-y-4">
          <div className="h-16 w-72 animate-pulse rounded-2xl bg-neutral-100" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-3xl bg-neutral-100" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* greeting */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-neutral-950">Hi, {nameOf(me.learner_id)}</h1>
              <p className="mt-1 text-[14px] text-neutral-500">
                {isNew ? "Welcome to Layerflow. Your progress will show up here as you practise." : `${me.totals.challenges_cleared} of ${total} problems solved · ${me.streak_days}-day streak`}
              </p>
            </div>
            <Link href={`/challenge/${me.next_challenge.challenge_id}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-neutral-950 px-5 text-[13.5px] font-semibold text-white hover:bg-neutral-800">
              {isNew ? "Start your first problem" : `Continue: ${title(me.next_challenge.challenge_id)}`} <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* numbers */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Problems solved" value={`${me.totals.challenges_cleared}/${total}`} sub={`${me.totals.first_try_passes} on the first try`} icon={CheckCircle2} />
            <Stat label="Submissions" value={me.totals.submissions} sub={`${me.totals.hints} hint${me.totals.hints === 1 ? "" : "s"} used`} icon={Target} />
            <Stat label="Streak" value={`${me.streak_days} day${me.streak_days === 1 ? "" : "s"}`} sub={me.streak.today_done ? "today done" : me.streak.at_risk ? "solve one today" : `longest ${me.streak.longest}`} icon={Flame} />
            <Stat label="Points" value={me.streak.points.toLocaleString("en-IN")} sub={`worth ₹${(me.streak.points / 10).toLocaleString("en-IN")}`} icon={Zap} />
          </div>

          {/* activity */}
          <Card>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <SectionLabel>Activity</SectionLabel>
              <span className="text-[12px] text-neutral-500">A square turns green on every day you solve something.</span>
            </div>
            {rw ? <ActivityMap days={rw.calendar} today={rw.streak.today} /> : <div className="h-[118px] animate-pulse rounded-xl bg-neutral-100" />}
          </Card>

          {isNew ? (
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#359462]/10 text-[#359462]">
                <Target className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-neutral-950">Start with {title(me.next_challenge.challenge_id)}</p>
                <p className="mt-0.5 text-[13.5px] leading-[1.55] text-neutral-600">It takes about five minutes. After your first submission you'll see your skills, the mistakes to watch and the hints you used — right here.</p>
              </div>
              <Link href={`/challenge/${me.next_challenge.challenge_id}`} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#359462] px-5 text-[13.5px] font-semibold text-white hover:bg-[#2c7a51]">
                Start <ArrowRight className="size-4" />
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <Card>
                  <SectionLabel>Up next</SectionLabel>
                  <p className="mt-2 text-[17px] font-semibold text-neutral-950">{title(me.next_challenge.challenge_id)}</p>
                  <p className="mt-1 text-[13.5px] leading-[1.55] text-neutral-600">{me.next_challenge.reason}</p>
                  <Link href={`/challenge/${me.next_challenge.challenge_id}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#2f7c53] hover:underline">
                    Start it <ArrowRight className="size-3.5" />
                  </Link>
                </Card>
                <Card>
                  <SectionLabel>Skills</SectionLabel>
                  <div className="mt-4 space-y-3.5">
                    {concepts.map((c) => (
                      <MasteryBar key={c} label={me.concept_labels[c] ?? c} value={me.mastery[c] ?? 0.5} color={CONCEPT_COLOR[c]} delta={(me.mastery[c] ?? 0.5) - (first[c] ?? 0.5)} />
                    ))}
                  </div>
                  <p className="mt-4 text-[12px] leading-[1.5] text-neutral-500">A pass without hints moves a skill up the most. Each hint or failed attempt pulls it down a little.</p>
                </Card>
              </div>
              <div className="space-y-5">
                <Card>
                  <SectionLabel>Mistakes to watch</SectionLabel>
                  {me.recurring_mistakes.length ? (
                    <div className="mt-3 space-y-2.5">
                      {me.recurring_mistakes.map((t) => (
                        <div key={t} className="rounded-xl border border-neutral-200/80 px-3.5 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <TagBadge tag={t} />
                            <span className="text-[12.5px] font-medium text-neutral-700">{me.tag_labels[t]}</span>
                          </div>
                          <p className="mt-1.5 text-[12px] text-neutral-500">Seen in {me.recurring_where[t]?.map(title).join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] text-neutral-500">No repeated mistakes. A mistake only counts here once it shows up in two different problems.</p>
                  )}
                  {me.one_off_mistakes.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-neutral-500">
                      One-off slips:
                      {me.one_off_mistakes.map((t) => (
                        <TagBadge key={t} tag={t} className="opacity-70" />
                      ))}
                    </div>
                  )}
                </Card>
                <Card>
                  <div className="flex items-baseline justify-between">
                    <SectionLabel>Hints you used</SectionLabel>
                    <Link href="/ledger" className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-950">
                      All hints →
                    </Link>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {hints.map((h) => {
                      const info = hintInfo(h);
                      return (
                        <div key={h.id} className="flex gap-3">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f59e0b]/15 text-[#96681c]">
                            <Lightbulb className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] text-neutral-500">
                              {info.challenge ? title(info.challenge) : "Hint"}
                              {info.rung ? ` · hint ${info.rung}` : ""} · {timeAgo(h.ts)}
                            </p>
                            <p className="line-clamp-2 text-[13px] leading-[1.45] text-neutral-800">{h.response}</p>
                          </div>
                        </div>
                      );
                    })}
                    {!hints.length && <p className="text-[13px] text-neutral-500">No hints used yet.</p>}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {!isNew && (
            <Card>
              <SectionLabel>Recent submissions</SectionLabel>
              <div className="mt-2 divide-y divide-neutral-100">
                {recent.map((h) => (
                  <Link key={h.submission_id} href={`/challenge/${h.challenge_id}?submission=${h.submission_id}`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-neutral-50/70">
                    {h.passed ? <CheckCircle2 className="size-4 text-[#359462]" /> : <XCircle className="size-4 text-[#c64e27]" />}
                    <span className="text-[13.5px] font-medium text-neutral-900">{title(h.challenge_id)}</span>
                    {h.tags.map((t) => (
                      <TagBadge key={t} tag={t} className="!text-[10px]" />
                    ))}
                    <span className="ml-auto text-[12px] text-neutral-400">{timeAgo(h.at)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* rewards */}
          <Card>
            <div className="flex items-baseline justify-between">
              <SectionLabel>Rewards</SectionLabel>
              <Link href="/rewards" className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-950">
                Open rewards →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center">
              <div>
                <p className="flex items-baseline gap-2">
                  <span className="text-[34px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-neutral-950">{(rw?.points.balance ?? me.streak.points).toLocaleString("en-IN")}</span>
                  <span className="text-[13px] text-neutral-500">points · ₹{((rw?.points.balance ?? me.streak.points) / 10).toLocaleString("en-IN")}</span>
                </p>
                <p className="mt-1.5 text-[12.5px] text-neutral-500">100 points for every streak day · bug bounty finds pay more</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/rewards" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[12.5px] font-semibold text-white hover:bg-neutral-800">
                    <Gift className="size-3.5" /> Redeem goodies
                  </Link>
                  <Link href="/rewards" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-[12.5px] font-semibold text-neutral-700 hover:border-neutral-950">
                    <IndianRupee className="size-3.5" /> Withdraw
                  </Link>
                </div>
              </div>
              {nextGoodie && rw && (
                <div className="flex items-center gap-4 rounded-2xl border border-neutral-200/80 p-3">
                  {nextGoodie.image ? <img src={nextGoodie.image} alt="" className="h-20 w-[106px] shrink-0 rounded-xl bg-[#dfdcd9] object-cover" /> : <span className="flex h-20 w-[106px] shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-3xl">{nextGoodie.emoji}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-neutral-500">{nextGoodie.affordable ? "You can redeem" : "Next goodie"}</p>
                    <p className="truncate text-[14px] font-semibold text-neutral-950">{nextGoodie.name}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div className={cn("h-full rounded-full", nextGoodie.affordable ? "bg-[#359462]" : "bg-[#f59e0b]")} style={{ width: `${Math.min(100, Math.round((rw.points.balance / nextGoodie.points) * 100))}%` }} />
                    </div>
                    <p className="mt-1 text-[11.5px] text-neutral-500">{nextGoodie.affordable ? `${nextGoodie.points.toLocaleString("en-IN")} points` : `${(nextGoodie.points - rw.points.balance).toLocaleString("en-IN")} points to go`}</p>
                  </div>
                </div>
              )}
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
