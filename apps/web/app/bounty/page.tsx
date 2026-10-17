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
import { ArrowRight, Bug, Crosshair, ExternalLink, Plus, Trophy } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { LogoTile, TechLogo } from "@/components/app/Logo";
import { BountyExplainer } from "@/components/bounty/BountyExplainer";
import { DirectorySection, EXTERNAL_PROGRAMS, companyName } from "@/components/bounty/Directory";
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
  const { name } = companyName(p.company);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Link href={`/bounty/${p.id}`} className="group flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white p-5 transition-colors hover:border-neutral-400">
        <div className="flex items-start gap-3">
          <LogoTile src={p.logo} name={name} size={44} full />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-neutral-950">{name}</p>
            <p className="mt-0.5 text-[12px] text-neutral-500">{p.title.replace(/^[^—]+—\s*/, "")}</p>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", DIFF[p.difficulty])}>{p.difficulty}</span>
            {p.pro_only && <span className="rounded-md bg-neutral-950 px-2 py-0.5 text-[10.5px] font-bold text-[#bbf451]">Pro</span>}
          </span>
        </div>
        <p className="mt-3 flex-1 text-[13px] leading-[1.5] text-neutral-600">{p.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.stack.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
              <TechLogo name={s} size={12} /> {s}
            </span>
          ))}
        </div>
        <div className="mt-4 border-t border-neutral-100 pt-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-neutral-500">
              <b className="font-semibold text-neutral-900">{found}</b> of {p.bug_count} bugs found
            </span>
            <span className="font-semibold tabular-nums text-neutral-900">up to {p.max_points.toLocaleString("en-IN")} pts</span>
          </div>
          <div className="mt-2 flex gap-[3px]">
            {(["critical", "high", "medium", "low"] as const).flatMap((s) => Array.from({ length: p.by_severity[s] }, (_, k) => <span key={s + k} className="h-1 flex-1 rounded-full" style={{ backgroundColor: SEVERITY_STYLE[s].color }} title={`${s} bug`} />))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function ReportsList({ reports }: { reports: BountyReport[] }) {
  if (!reports.length)
    return (
      <Card className="text-center">
        <Bug className="mx-auto size-6 text-neutral-300" />
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
      <PageHeading title="Bug Bounty" body="Find security bugs, report them clearly, and get paid in points (100 points = ₹10). Start with the practice programs, then move on to company and open-source programs." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <BountyExplainer />
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
            {[
              { k: "Programs", v: data?.stats.programs ?? 0 },
              { k: "Bugs confirmed", v: data?.stats.valid ?? 0 },
              { k: "Hunters", v: data?.stats.hunters ?? 0 },
              { k: "You've earned", v: earned, suffix: "pts" },
            ].map(({ k, v, suffix }, i) => (
              <div key={k} className={cn("px-5 py-4", i % 2 === 1 && "border-l border-neutral-100", i > 1 && "border-t border-neutral-100")}>
                <p className="text-[24px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-neutral-950">
                  <NumberFlow value={v} />
                  {suffix && <span className="ml-1 text-[12px] font-medium text-neutral-400">{suffix}</span>}
                </p>
                <p className="mt-1.5 text-[12px] text-neutral-500">{k}</p>
              </div>
            ))}
          </div>
          <Card>
            <p className="text-[14px] font-semibold text-neutral-950">How it works</p>
            <ol className="mt-2.5 space-y-2 text-[13px] leading-[1.45] text-neutral-600">
              {["Pick a program and read its scope — what you may test.", "Find a bug in the code or the app.", "Report it: where it is, what's wrong, what an attacker could do.", "When it's confirmed, the points are yours."].map((s, i) => (
                <li key={s} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
          <Link href="/bug-factory" className="group flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white px-5 py-3.5 hover:border-neutral-400">
            <span>
              <span className="block text-[13.5px] font-semibold text-neutral-950">New to this? Start in the training range</span>
              <span className="block text-[12px] text-neutral-500">One bug in a 10-line program, based on your own most common mistake.</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
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
            <div className="space-y-9">
              <section>
                <div className="mb-3">
                  <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">Practice programs</p>
                  <p className="text-[12.5px] text-neutral-500">Small apps with real bugs planted in them. Read the code, click the line, and get an answer in seconds.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.platform.map((p, i) => (
                    <PlatformCard key={p.id} p={p} i={i} />
                  ))}
                </div>
              </section>
              <DirectorySection
                title="Company programs"
                note="Companies pay for bugs in their own products. Programs hosted here are triaged by the company on Layerflow."
                hosted={data.company}
                external={EXTERNAL_PROGRAMS.filter((x) => x.kind === "company")}
                empty="No company has hosted a program here yet."
              />
              <DirectorySection
                title="Open source programs"
                note="Projects whose code anyone can read — a good next step once the practice programs feel easy."
                hosted={data.open_source}
                external={EXTERNAL_PROGRAMS.filter((x) => x.kind === "open_source")}
                empty="No open-source project has hosted a program here yet."
              />
              <p className="text-[11.5px] leading-[1.5] text-neutral-400">
                Programs marked "On HackerOne" or "Own site" are run by those companies, not by Layerflow — sign up and report on their platform, and read their policy before you test anything.
              </p>
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
