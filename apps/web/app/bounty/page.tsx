"use client";

/**
 * Bug Bounty — the hub. Watch how bug bounty works, then hunt: Layerflow's own
 * programs (real code, planted bugs, instant triage), company programs and
 * open-source programs (triaged by their owners). Confirmed bugs pay points,
 * and points are money (100 = ₹10). Companies can host a program here; paid
 * plans go through Dodo Payments.
 */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ArrowRight, Bug, Building2, Crosshair, ExternalLink, Globe, GraduationCap, Plus, ShieldCheck, Trophy, Users, Zap } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { BountyExplainer } from "@/components/bounty/BountyExplainer";
import { HostForm } from "@/components/bounty/HostForm";
import { SEVERITY_STYLE, StatusPill } from "@/components/bounty/bits";
import { api, timeAgo, type BountyList, type BountyReport, type HostedProgram, type PlatformProgram } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { cn } from "@/lib/utils";

const DIFF: Record<PlatformProgram["difficulty"], string> = {
  beginner: "bg-[#359462]/12 text-[#2f7c53]",
  intermediate: "bg-[#f59e0b]/15 text-[#96681c]",
  advanced: "bg-[#5e2ac4]/12 text-[#5e2ac4]",
};

function PlatformCard({ p, i }: { p: PlatformProgram; i: number }) {
  const found = p.stats.found_by_you;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
      <Link href={`/bounty/${p.id}`} className="group flex h-full flex-col rounded-3xl border border-neutral-200/80 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow-[0_18px_40px_-24px_rgba(16,15,25,0.4)]">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">{p.logo}</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", DIFF[p.difficulty])}>{p.difficulty}</span>
        </div>
        <p className="mt-3 text-[11.5px] font-semibold text-neutral-500">{p.company}</p>
        <p className="text-[16px] font-semibold leading-[1.3] tracking-[-0.02em] text-neutral-950">{p.title}</p>
        <p className="mt-1 flex-1 text-[12.5px] leading-[1.5] text-neutral-600">{p.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {p.stack.map((s) => (
            <span key={s} className="rounded-full border border-neutral-200 px-2 py-px text-[10.5px] font-medium text-neutral-600">
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1">
          {(["critical", "high", "medium", "low"] as const).flatMap((s) => Array.from({ length: p.by_severity[s] }, (_, k) => <span key={s + k} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: SEVERITY_STYLE[s].color }} title={`${s} bug`} />))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="font-semibold text-neutral-800">
            {found}/{p.bug_count} found{found === p.bug_count && found > 0 ? " 🏆" : ""}
          </span>
          <span className="inline-flex items-center gap-1 font-bold tabular-nums text-neutral-900">
            <Zap className="size-3.5 fill-[#bbf451] text-[#4d7c0f]" /> up to {p.max_points.toLocaleString("en-IN")}
          </span>
        </div>
        <span className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-neutral-950 text-[13px] font-semibold text-white">
          <Crosshair className="size-3.5" /> {found ? "Keep hunting" : "Start hunting"}
        </span>
      </Link>
    </motion.div>
  );
}

function HostedCard({ p }: { p: HostedProgram }) {
  return (
    <Link href={`/bounty/${p.id}`} className="group flex flex-col gap-3 rounded-3xl border border-neutral-200/80 bg-white p-5 transition-all hover:border-neutral-950 sm:flex-row sm:items-center">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">{p.logo}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-neutral-500">{p.company}</span>
          {p.plan !== "community" && <span className="rounded-full bg-[#bbf451] px-2 py-px text-[10px] font-bold text-[#1a2e05]">{p.plan_name}</span>}
          {p.status === "awaiting_payment" && <span className="rounded-full bg-[#f59e0b]/15 px-2 py-px text-[10px] font-bold text-[#96681c]">waiting for payment</span>}
        </div>
        <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">{p.title}</p>
        <p className="line-clamp-2 text-[12.5px] leading-[1.45] text-neutral-600">{p.summary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
        <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums text-neutral-900">
          <Zap className="size-3.5 fill-[#bbf451] text-[#4d7c0f]" /> {p.pays_points ? `up to ${p.rewards.critical.toLocaleString("en-IN")}` : "reputation"}
        </span>
        <span className="text-[11.5px] text-neutral-500">
          {p.stats.valid} confirmed · {p.stats.hunters} hunter{p.stats.hunters === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}

function ReportsList({ reports }: { reports: BountyReport[] }) {
  if (!reports.length)
    return (
      <Card className="text-center">
        <p className="text-3xl">🕵️</p>
        <p className="mt-2 text-[14px] font-semibold text-neutral-900">No reports yet</p>
        <p className="mt-1 text-[12.5px] text-neutral-500">Pick a program, read the code like an attacker, and file your first report.</p>
      </Card>
    );
  return (
    <Card className="!p-0">
      <div className="divide-y divide-neutral-100">
        {reports.map((r) => (
          <Link key={r.id} href={`/bounty/${r.program_id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-neutral-50">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_STYLE[(r.final_severity ?? r.severity) as keyof typeof SEVERITY_STYLE]?.color ?? "#999" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-neutral-900">{r.title}</p>
              <p className="truncate text-[11.5px] text-neutral-500">
                {r.company} · {r.program_title}
                {r.file ? ` · ${r.file}${r.line ? `:${r.line}` : ""}` : ""} · {timeAgo(r.created_at)}
              </p>
            </div>
            {r.points > 0 && <span className="text-[13px] font-bold tabular-nums text-[#2f7c53]">+{r.points.toLocaleString("en-IN")}</span>}
            <StatusPill status={r.status} />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function BountyPage() {
  const [learner] = useLearner();
  const router = useRouter();
  const [data, setData] = useState<BountyList | null>(null);
  const [mine, setMine] = useState<BountyReport[]>([]);
  const [tab, setTab] = useState<"programs" | "mine" | "fame" | "host">("programs");

  useEffect(() => {
    if (!learner) return;
    api.bountyPrograms(learner).then(setData).catch(() => {});
    api
      .bountyReports(learner)
      .then((r) => setMine(r.reports))
      .catch(() => {});
  }, [learner]);

  const earned = useMemo(() => mine.reduce((n, r) => n + r.points, 0), [mine]);

  return (
    <AppShell title="Bug Bounty" subtitle="Find real bugs · report them well · get rewarded" wide>
      <PageHeading eyebrow="Bug Bounty" title="Hunt real bugs." accent="Get rewarded." body="Security teams pay people who find problems before attackers do. Learn the craft on Layerflow's own programs — real code with real bugs — then take on company and open-source programs. Every confirmed bug pays points, and 100 points are worth ₹10." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <BountyExplainer />
        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-2">
          {[
            { k: "Programs", v: data?.stats.programs ?? 0, icon: ShieldCheck },
            { k: "Bugs confirmed", v: data?.stats.valid ?? 0, icon: Bug },
            { k: "Hunters", v: data?.stats.hunters ?? 0, icon: Users },
            { k: "You've earned", v: earned, icon: Zap, suffix: "pts" },
          ].map(({ k, v, icon: Icon, suffix }) => (
            <div key={k} className="rounded-3xl border border-neutral-200/80 bg-white px-5 py-4">
              <Icon className="size-4 text-neutral-400" />
              <p className="mt-2 text-[28px] font-medium tabular-nums leading-none tracking-[-0.04em] text-neutral-950">
                <NumberFlow value={v} />
                {suffix && <span className="ml-1 text-[13px] font-medium text-neutral-400">{suffix}</span>}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{k}</p>
            </div>
          ))}
          <Link href="/bug-factory" className="group flex items-center gap-3 rounded-3xl border border-[#ddd0ff] bg-[#f2eeff] px-5 py-4 lf-tint-purple sm:col-span-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#5e2ac4] text-white">
              <GraduationCap className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[#151515]">New to this? Warm up in the training range</span>
              <span className="block text-[12px] leading-[1.4] text-[#4a3d6b] dark:text-neutral-300">Find one bug in a 10-line program built from your own most common mistake — then fix it.</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-[#5e2ac4] transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="mt-8 mb-5 flex gap-1 overflow-x-auto rounded-full border border-neutral-200 bg-white p-1 sm:w-fit">
        {(
          [
            ["programs", "Programs", Crosshair],
            ["mine", `My reports${mine.length ? ` · ${mine.length}` : ""}`, Bug],
            ["fame", "Hall of fame", Trophy],
            ["host", "Host a program", Plus],
          ] as const
        ).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors", tab === k ? "bg-neutral-950 text-white" : "text-neutral-600 hover:text-neutral-950")}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {!data ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
          ) : tab === "programs" ? (
            <div className="space-y-8">
              <section>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-[20px] font-medium tracking-[-0.03em] text-neutral-950">Layerflow programs</p>
                    <p className="text-[12.5px] text-neutral-500">Real codebases with real bugs planted in them. Point at the line, name the bug, get it confirmed instantly.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.platform.map((p, i) => (
                    <PlatformCard key={p.id} p={p} i={i} />
                  ))}
                </div>
              </section>
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="size-4 text-neutral-500" />
                  <p className="text-[20px] font-medium tracking-[-0.03em] text-neutral-950">Company programs</p>
                </div>
                <div className="space-y-3">
                  {data.company.map((p) => (
                    <HostedCard key={p.id} p={p} />
                  ))}
                  {!data.company.length && <Card className="text-[13px] text-neutral-500">No company programs yet.</Card>}
                </div>
              </section>
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Globe className="size-4 text-neutral-500" />
                  <p className="text-[20px] font-medium tracking-[-0.03em] text-neutral-950">Open source</p>
                </div>
                <div className="space-y-3">
                  {data.open_source.map((p) => (
                    <HostedCard key={p.id} p={p} />
                  ))}
                  {!data.open_source.length && <Card className="text-[13px] text-neutral-500">No open-source programs yet.</Card>}
                </div>
              </section>
            </div>
          ) : tab === "mine" ? (
            <ReportsList reports={mine} />
          ) : tab === "fame" ? (
            <Card>
              <SectionLabel>Top hunters · points from confirmed bugs</SectionLabel>
              <div className="mt-3 divide-y divide-neutral-100">
                {data.board.map((b, i) => (
                  <div key={b.learner_id} className={cn("flex items-center gap-3 py-3", b.learner_id === learner && "rounded-2xl bg-[#bbf451]/15 px-3")}>
                    <span className={cn("flex size-8 items-center justify-center rounded-full text-[13px] font-bold", i === 0 ? "bg-[#f59e0b] text-white" : i === 1 ? "bg-neutral-300 text-neutral-800" : i === 2 ? "bg-[#c2773a] text-white" : "bg-neutral-100 text-neutral-500")}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-neutral-900">{b.name}</p>
                      <p className="text-[11.5px] text-neutral-500">
                        {b.valid} confirmed · signal {b.signal}% <span className="text-neutral-400">(how often their reports are right)</span>
                      </p>
                    </div>
                    <span className="text-right">
                      <span className="block text-[15px] font-bold tabular-nums text-neutral-950">{b.points.toLocaleString("en-IN")}</span>
                      <span className="block text-[11px] text-neutral-500">{b.inr}</span>
                    </span>
                  </div>
                ))}
                {!data.board.length && <p className="py-3 text-[13px] text-neutral-500">Nobody yet — be the first name here.</p>}
              </div>
            </Card>
          ) : (
            <HostForm plans={data.plans} learner={learner} onCreated={(id) => router.push(`/bounty/${id}`)} />
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-neutral-400">
        <ExternalLink className="size-3" /> Only ever test what a program lists in its scope, with your own accounts. Hunting outside a scope isn't bug bounty — it's breaking in.
      </p>
    </AppShell>
  );
}
