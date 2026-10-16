"use client";

/**
 * Mentoring — every problem you've tried, what went wrong in each, and a
 * one-click "Join session" with Priya: a Google-Meet-style call where she
 * talks you through it and, on "Summarise", presents an animated replay of
 * your own code.
 */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CircleCheck, Clock, Flame, MapPin, Repeat, Sparkles, Video } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, LEVEL_STYLE, PageHeading, Spinner, TagBadge } from "@/components/app/bits";
import { MeetRoom } from "@/components/mentor/MeetRoom";
import { api, timeAgo, type MentorOverview, type MentorProblem } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type Filter = "attention" | "solved" | "all";

function StatusPill({ p }: { p: MentorProblem }) {
  return p.passed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eeffe8] px-2.5 py-0.5 text-[11px] font-semibold text-[#2f7c53]">
      <CircleCheck className="size-3" /> solved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff2df] px-2.5 py-0.5 text-[11px] font-semibold text-[#a8401f]">
      <Flame className="size-3" /> needs a fix
    </span>
  );
}

export default function MentoringPage() {
  const { t, lang } = useI18n();
  const [learner] = useLearner();
  const [data, setData] = useState<MentorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("attention");
  const [selected, setSelected] = useState<string | null>(null);
  const [room, setRoom] = useState<{ id: string; title: string; headline?: string } | null>(null);

  useEffect(() => {
    if (!learner) return;
    let alive = true;
    api
      .mentor(learner)
      .then((d) => {
        if (!alive) return;
        setData(d);
        const qs = new URLSearchParams(window.location.search);
        const want = qs.get("challenge");
        const first = d.problems.find((p) => !p.passed) ?? d.problems[0];
        const pick = want ?? first?.challenge_id ?? null;
        setSelected(pick);
        if (!d.problems.some((p) => !p.passed)) setFilter("all");
        if (want && qs.get("join") === "1") {
          const p = d.problems.find((x) => x.challenge_id === want);
          setRoom({ id: want, title: p?.title ?? d.fresh.find((f) => f.challenge_id === want)?.title ?? want, headline: p?.headline });
        }
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [learner]);

  const list = useMemo(() => {
    const ps = data?.problems ?? [];
    return filter === "attention" ? ps.filter((p) => !p.passed) : filter === "solved" ? ps.filter((p) => p.passed) : ps;
  }, [data, filter]);
  const sel = data?.problems.find((p) => p.challenge_id === selected) ?? null;
  const freshSel = !sel ? data?.fresh.find((f) => f.challenge_id === selected) : null;

  return (
    <AppShell title={t("app.mentoring")} subtitle="Talk it through with Priya — she points, you fix" wide>
      <PageHeading eyebrow="Mentoring" title="Stuck? Talk it through" accent="with Priya." body="Pick a problem, join a short call, and Priya explains what's going wrong in plain words. Press Summarise and she shows you — an animated replay of your own code. She'll never hand you the answer." />

      {/* how it works */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Pick a problem", "Your recent attempts are below, with what went wrong in each."],
          ["2", "Join the call", "Priya talks you through it — out loud, with captions. Ask her anything."],
          ["3", "Press ✨ Summarise", "She presents a step-by-step animation of where your code breaks."],
        ].map(([n, h, b]) => (
          <div key={n} className="flex items-start gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#bbf451] text-[12px] font-bold text-black">{n}</span>
            <div>
              <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-neutral-950">{h}</p>
              <p className="mt-0.5 text-[12.5px] leading-[1.5] text-neutral-500">{b}</p>
            </div>
          </div>
        ))}
      </div>

      {error && <Card className="text-[13px] text-[#a8401f]">Couldn't load your mentoring page: {error}</Card>}
      {!data && !error && (
        <Card className="flex items-center gap-3 text-[13px] text-neutral-500">
          <Spinner /> Loading your problems…
        </Card>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-5">
            {/* mentor card */}
            <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <img src={data.mentor.avatar} alt="Priya" className="size-20 rounded-2xl object-cover sm:size-24" />
                <span className="absolute -bottom-1 -right-1 flex items-center gap-1 rounded-full border-2 border-white bg-[#359462] px-1.5 py-0.5 text-[9.5px] font-bold text-white">● online</span>
              </div>
              <div className="min-w-0">
                <p className="text-[18px] font-medium tracking-[-0.02em] text-neutral-950">Hi {data.learner_name}, I'm Priya.</p>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-neutral-600">
                  {data.totals.attempted === 0
                    ? "You haven't tried a problem yet — pick one below and I'll explain it before you start."
                    : `You've tried ${data.totals.attempted} problem${data.totals.attempted === 1 ? "" : "s"}: ${data.totals.solved} solved, ${data.totals.struggling} still need a fix.`}
                  {data.recurring[0] && (
                    <>
                      {" "}
                      One thing keeps coming back: <b className="text-neutral-900">{data.recurring[0].label.toLowerCase()}</b> (in {data.recurring[0].where.length} different problems). Let's fix it once, properly.
                    </>
                  )}
                </p>
                {data.recurring.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {data.recurring.map((r) => (
                      <span key={r.tag} className="inline-flex items-center gap-1.5 rounded-full border border-[#f0d9b8] bg-[#fff2df] px-2.5 py-0.5 text-[11px] font-semibold text-[#a8401f]">
                        <Repeat className="size-3" /> {r.label} · {r.where.length} problems
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* filters */}
            {data.problems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["attention", `Needs attention · ${data.problems.filter((p) => !p.passed).length}`],
                    ["solved", `Solved · ${data.problems.filter((p) => p.passed).length}`],
                    ["all", `All · ${data.problems.length}`],
                  ] as [Filter, string][]
                ).map(([k, label]) => (
                  <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors", filter === k ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400")}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* problem list */}
            <div className="space-y-2.5">
              {list.map((p, i) => (
                <motion.button
                  key={p.challenge_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setSelected(p.challenge_id)}
                  className={cn(
                    "w-full rounded-3xl border bg-white p-4 text-left transition-all sm:p-5",
                    selected === p.challenge_id ? "border-neutral-950 shadow-[0_8px_30px_rgb(0,0,0,0.06)]" : "border-neutral-200/80 hover:border-neutral-400",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold tracking-[-0.02em] text-neutral-950">{p.title}</span>
                    <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-semibold", LEVEL_STYLE[p.difficulty])}>{p.difficulty}</span>
                    {p.bug_factory && <span className="rounded-full bg-neutral-100 px-2 py-px text-[10.5px] font-semibold text-neutral-600">bug factory</span>}
                    <span className="ml-auto">
                      <StatusPill p={p} />
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.5] text-neutral-600">{p.headline}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="size-3" /> {p.attempts} attempt{p.attempts === 1 ? "" : "s"}
                    </span>
                    {p.hints_used > 0 && <span>💡 {p.hints_used} hint{p.hints_used === 1 ? "" : "s"}</span>}
                    {p.culprit_line && !p.passed && (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#a8401f]">
                        <MapPin className="size-3" /> line {p.culprit_line}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {timeAgo(p.last_at)}
                    </span>
                    {p.tags_seen.map((tg) => (
                      <TagBadge key={tg} tag={tg} />
                    ))}
                  </div>
                </motion.button>
              ))}
              {list.length === 0 && data.problems.length > 0 && <Card className="text-[13px] text-neutral-500">Nothing here — nice! Switch the filter to see the rest.</Card>}
            </div>

            {/* fresh problems */}
            {data.fresh.length > 0 && (
              <div>
                <p className="mb-2.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Not tried yet — Priya can explain them first</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {data.fresh.map((f) => (
                    <button key={f.challenge_id} onClick={() => setSelected(f.challenge_id)} className={cn("flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 text-left transition-colors", selected === f.challenge_id ? "border-neutral-950" : "border-neutral-200/80 hover:border-neutral-400")}>
                      <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-neutral-900">{f.title}</span>
                      <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-semibold", LEVEL_STYLE[f.difficulty])}>{f.difficulty}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* selected problem */}
          <div className="lg:sticky lg:top-[77px] lg:self-start">
            {sel || freshSel ? (
              <motion.div key={selected} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white">
                {/* a mini "meet" preview */}
                <div className="relative aspect-video overflow-hidden bg-[#202124]">
                  <img src="/people/priya.jpg" alt="" className="h-full w-full object-cover opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                    <span className="size-1.5 animate-pulse rounded-full bg-[#81c995]" /> Priya is ready
                  </span>
                  <div className="absolute inset-x-4 bottom-3 text-white">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">Mentoring session</p>
                    <p className="text-[18px] font-medium tracking-[-0.02em]">{sel?.title ?? freshSel?.title}</p>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  {sel ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill p={sel} />
                        <code className="rounded-md bg-neutral-100 px-1.5 py-px font-mono text-[11.5px] text-neutral-700">{sel.signature}</code>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{sel.passed ? "Your result" : "What's going wrong"}</p>
                        <p className="text-[13.5px] leading-[1.55] text-neutral-800">{sel.headline}</p>
                      </div>
                      {sel.tag_labels.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Mistakes seen here</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sel.tags_seen.map((tg, i) => (
                              <span key={tg} className="flex items-center gap-1.5">
                                <TagBadge tag={tg} />
                                <span className="text-[12px] text-neutral-500">{sel.tag_labels[i]}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <ul className="space-y-1.5 text-[12.5px] text-neutral-600">
                        <li>🎙️ Priya explains it out loud, with captions</li>
                        <li>✨ Summarise → an animated replay of your code{sel.culprit_line && !sel.passed ? `, stopping at line ${sel.culprit_line}` : ""}</li>
                        <li>💬 Ask her anything — by voice or chat</li>
                      </ul>
                    </>
                  ) : (
                    <p className="text-[13.5px] leading-[1.55] text-neutral-700">You haven't tried this one yet. Priya will explain the task in plain words, show the examples, and give you a plan to start — no code, just the path.</p>
                  )}
                  <button
                    onClick={() => setRoom({ id: (sel?.challenge_id ?? freshSel?.challenge_id)!, title: (sel?.title ?? freshSel?.title)!, headline: sel?.headline })}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-[#1765cc]"
                  >
                    <Video className="size-4.5" /> Join session
                  </button>
                  <Link href={`/challenge/${sel?.challenge_id ?? freshSel?.challenge_id}`} className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-neutral-500 hover:text-neutral-950">
                    Open the problem instead <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </motion.div>
            ) : (
              <Card className="text-center">
                <Sparkles className="mx-auto size-6 text-[#359462]" />
                <p className="mt-3 text-[14px] font-semibold text-neutral-900">Pick a problem to start a session</p>
                <p className="mt-1 text-[12.5px] text-neutral-500">Or practise one first — Priya will be here when you need her.</p>
                <Link href="/practice" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-2 text-[12.5px] font-semibold text-white">
                  Go to Practice <ArrowRight className="size-3.5" />
                </Link>
              </Card>
            )}
            {data.next && (
              <Card tint="green" className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2f7c53]">Priya's pick for you next</p>
                <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-neutral-950">{data.next.title}</p>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-neutral-600">{data.next.reason}</p>
                <Link href={`/challenge/${data.next.challenge_id}`} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#2f7c53]">
                  Start it <ArrowRight className="size-3.5" />
                </Link>
              </Card>
            )}
          </div>
        </div>
      )}

      {room && learner && (
        <MeetRoom
          open
          learnerId={learner}
          learnerName={data?.learner_name ?? learner}
          challengeId={room.id}
          challengeTitle={room.title}
          headline={room.headline}
          initialLang={lang}
          onClose={() => setRoom(null)}
        />
      )}
    </AppShell>
  );
}
