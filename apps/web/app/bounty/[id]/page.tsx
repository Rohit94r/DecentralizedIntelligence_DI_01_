"use client";

/**
 * One bug-bounty program.
 *   • Layerflow programs: a file tree + clickable code, the report form, a
 *     nudge (half reward), and the bugs you've confirmed revealed in place.
 *   • Company / open-source programs: scope, rewards, a hunting checklist and
 *     the report form — and, for the owner, the triage queue and payment.
 */
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, ChevronDown, CircleAlert, CreditCard, ExternalLink, Globe, Lightbulb, LoaderCircle, PartyPopper, ShieldCheck, Trophy, X, Zap } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card } from "@/components/app/bits";
import { LogoTile, TechLogo } from "@/components/app/Logo";
import { companyName } from "@/components/bounty/Directory";
import { DemoCheckoutSheet, PaymentsBadge } from "@/components/payments/Checkout";
import { PaymentCancelled, payWithRazorpay } from "@/lib/razorpay";
import { CodeViewer, FileTree, type FoundMark } from "@/components/bounty/CodeViewer";
import { ReportForm } from "@/components/bounty/ReportForm";
import { SEVERITY_STYLE, SeverityChip, StatusPill } from "@/components/bounty/bits";
import { usePin } from "@/components/rewards/PinDialog";
import { api, timeAgo, type BountyReport, type BountySeverity, type DemoCheckout, type FileReportResult, type HostedProgramDetail, type PlatformProgramDetail, type ProgramDetail } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { cn } from "@/lib/utils";

const SEVS = ["critical", "high", "medium", "low"] as const;

function RewardsRow({ rewards }: { rewards: Record<BountySeverity, number> }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {SEVS.map((s) => (
        <div key={s} className="rounded-2xl px-2 py-2 text-center" style={{ backgroundColor: SEVERITY_STYLE[s].color + "14" }}>
          <p className="text-[10.5px] font-bold" style={{ color: SEVERITY_STYLE[s].color }}>
            {SEVERITY_STYLE[s].label}
          </p>
          <p className="text-[15px] font-semibold tabular-nums text-neutral-950">{rewards[s].toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-neutral-500">₹{(rewards[s] / 10).toLocaleString("en-IN")}</p>
        </div>
      ))}
    </div>
  );
}

function ScopeCard({ scope, out, rules, checklist }: { scope: string[]; out: string[]; rules?: string[]; checklist?: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="!p-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-neutral-950">
          <ShieldCheck className="size-4 text-[#359462]" /> Scope & rules — read before you hunt
        </span>
        <ChevronDown className={cn("size-4 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-4 border-t border-neutral-100 px-5 py-4 md:grid-cols-3">
              <div>
                <SectionLabel className="!text-[#2f7c53]">In scope</SectionLabel>
                <ul className="mt-2 space-y-1 text-[12.5px] text-neutral-700">
                  {scope.map((s) => (
                    <li key={s} className="flex gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-[#359462]" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <SectionLabel className="!text-[#a8401f]">Out of scope</SectionLabel>
                <ul className="mt-2 space-y-1 text-[12.5px] text-neutral-700">
                  {out.map((s) => (
                    <li key={s} className="flex gap-1.5">
                      <X className="mt-0.5 size-3.5 shrink-0 text-[#c64e27]" /> {s}
                    </li>
                  ))}
                  {!out.length && <li className="text-neutral-400">—</li>}
                </ul>
              </div>
              <div>
                <SectionLabel>{rules ? "Rules" : "How to hunt"}</SectionLabel>
                <ol className="mt-2 space-y-1 text-[12.5px] leading-[1.45] text-neutral-700">
                  {(rules ?? checklist ?? []).map((s, i) => (
                    <li key={s} className="flex gap-1.5">
                      <span className="font-mono text-[11px] text-neutral-400">{i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function Outcome({ r, onClose }: { r: FileReportResult; onClose: () => void }) {
  const tone =
    r.outcome === "valid" ? "border-[#359462] bg-[#359462]/10" : r.outcome === "needs_info" ? "border-[#f59e0b] bg-[#f59e0b]/10" : r.outcome === "duplicate" ? "border-sky-300 bg-sky-50" : r.outcome === "triage" ? "border-neutral-300 bg-neutral-50" : "border-[#c64e27]/50 bg-[#c64e27]/[0.07]";
  return (
    <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className={cn("relative rounded-2xl border-2 p-4", tone)}>
      <button onClick={onClose} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-white/60" aria-label="Dismiss">
        <X className="size-3.5" />
      </button>
      <div className="flex items-center gap-2 pr-6">
        {r.outcome === "valid" ? <PartyPopper className="size-5 text-[#2f7c53]" /> : <CircleAlert className="size-5 text-neutral-500" />}
        <StatusPill status={r.outcome} />
      </div>
      <p className="mt-2 text-[13.5px] font-semibold text-neutral-900">{r.message}</p>
      {r.bug && (
        <div className="mt-3 space-y-2 text-[12.5px] leading-[1.5]">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityChip severity={r.bug.severity} />
            <span className="font-semibold text-neutral-900">{r.bug.title}</span>
          </div>
          <p className="text-neutral-700">{r.bug.explanation}</p>
          <p className="text-neutral-700">
            <b>Fix:</b> {r.bug.fix}
          </p>
          {typeof r.remaining === "number" && <p className="font-semibold text-[#2f7c53]">{r.remaining ? `${r.remaining} more bug${r.remaining === 1 ? "" : "s"} hiding in this program.` : "You found every bug in this program! 🏆"}</p>}
        </div>
      )}
    </motion.div>
  );
}

function Board({ rows }: { rows: ProgramDetail["board"] }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-[#f59e0b]" />
        <SectionLabel>Top hunters here</SectionLabel>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((b, i) => (
          <div key={b.learner_id} className="flex items-center gap-2.5 text-[13px]">
            <span className="w-4 text-right font-mono text-[11px] text-neutral-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-neutral-800">{b.name}</span>
            <span className="text-[11.5px] text-neutral-500">{b.valid} bug{b.valid === 1 ? "" : "s"}</span>
            <span className="font-bold tabular-nums text-neutral-900">{b.points.toLocaleString("en-IN")}</span>
          </div>
        ))}
        {!rows.length && <p className="text-[12.5px] text-neutral-500">No confirmed bugs yet — the first name here could be yours.</p>}
      </div>
    </Card>
  );
}

function MyReports({ reports }: { reports: BountyReport[] }) {
  if (!reports.length) return null;
  return (
    <Card>
      <SectionLabel>Your reports here</SectionLabel>
      <div className="mt-3 divide-y divide-neutral-100">
        {reports.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-neutral-900">{r.title}</p>
              <p className="text-[11.5px] text-neutral-500">
                {r.file ? `${r.file}${r.line ? `:${r.line}` : ""} · ` : ""}
                {timeAgo(r.created_at)}
              </p>
              {r.triage_note && <p className="mt-0.5 text-[11.5px] leading-[1.45] text-neutral-600">{r.triage_note}</p>}
            </div>
            {r.points > 0 && <span className="text-[12.5px] font-bold tabular-nums text-[#2f7c53]">+{r.points}</span>}
            <StatusPill status={r.status} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ───────────────────────── Layerflow program ───────────────────────── */

function PlatformView({ p, learner, reload }: { p: PlatformProgramDetail; learner: string | null; reload: () => void }) {
  const [plan, setPlan] = useState<"free" | "pro" | null>(null);
  useEffect(() => {
    if (learner && p.pro_only)
      api
        .rewardsSummary(learner)
        .then((s) => setPlan(s.plan ?? "free"))
        .catch(() => {});
  }, [learner, p.pro_only]);
  const [file, setFile] = useState(p.files.find((f) => f.language !== "markdown")?.path ?? p.files[0].path);
  const [line, setLine] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<FileReportResult | null>(null);
  const [nudge, setNudge] = useState<{ nudge: string; message?: string } | null>(null);
  const [nudging, setNudging] = useState(false);
  const active = p.files.find((f) => f.path === file)!;
  const found: FoundMark[] = p.found.map((b) => ({ file: b.file, line: b.line, color: SEVERITY_STYLE[b.severity].color, title: b.title }));
  const earned = p.found.reduce((n, b) => n + b.points, 0);
  const pct = Math.round((p.found.length / p.bug_count) * 100);

  const askNudge = async () => {
    if (!learner) return;
    setNudging(true);
    try {
      setNudge(await api.bountyNudge(learner, p.id));
    } finally {
      setNudging(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <LogoTile src={p.logo} name={companyName(p.company).name} size={56} full />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-neutral-500">{companyName(p.company).name} · practice program</p>
              <h1 className="text-[26px] font-medium leading-[1.15] tracking-[-0.035em] text-neutral-950">{p.title}</h1>
              <p className="mt-1 text-[13.5px] leading-[1.55] text-neutral-600">{p.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded-full bg-neutral-950 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-white">{p.difficulty}</span>
                {p.stack.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-px text-[11px] text-neutral-600">
                    <TechLogo name={s} size={11} /> {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5 lg:w-[22rem]">
            <div className="relative size-24 shrink-0">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="9" className="text-neutral-100" />
                <motion.circle cx="50" cy="50" r="42" fill="none" stroke="#359462" strokeWidth="9" strokeLinecap="round" strokeDasharray={2 * Math.PI * 42} initial={{ strokeDashoffset: 2 * Math.PI * 42 }} animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - pct / 100) }} transition={{ duration: 1 }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-semibold tabular-nums leading-none text-neutral-950">
                  {p.found.length}/{p.bug_count}
                </span>
                <span className="text-[10px] text-neutral-500">found</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <RewardsRow rewards={p.rewards} />
              <p className="mt-2 text-[11.5px] text-neutral-500">
                You've earned <b className="text-neutral-900">{earned.toLocaleString("en-IN")}</b> of {p.max_points.toLocaleString("en-IN")} points here.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {p.pro_only && plan === "free" && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-neutral-950 px-2.5 py-1 text-[11.5px] font-bold text-[#bbf451]">Pro program</span>
          <p className="min-w-0 flex-1 text-[13px] leading-[1.5] text-neutral-600">Read all the code you like — filing reports here needs Pro ($4 or ₹349 a month). ShopKart stays free for everyone.</p>
          <Link href="/pricing" className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#bbf451] px-4 text-[13px] font-semibold text-[#1a2e05]">
            See Pro
          </Link>
        </Card>
      )}
      <ScopeCard scope={p.scope} out={p.out_of_scope} rules={p.rules} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_23rem]">
        <Card className="!p-3 xl:self-start">
          <SectionLabel className="mb-2 px-1.5">Files</SectionLabel>
          <FileTree
            files={p.files}
            active={file}
            onPick={(f) => {
              setFile(f);
              setLine(null);
            }}
            found={found}
          />
          <div className="mt-3 border-t border-neutral-100 px-1.5 pt-3">
            <p className="text-[11px] font-semibold text-neutral-500">Bugs in this program</p>
            <div className="mt-1.5 space-y-1">
              {SEVS.filter((s) => p.by_severity[s]).map((s) => (
                <div key={s} className="flex items-center justify-between text-[11.5px]">
                  <SeverityChip severity={s} />
                  <span className="tabular-nums text-neutral-600">
                    {p.found.filter((b) => b.severity === s).length}/{p.by_severity[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <div className="min-w-0">
          <CodeViewer file={active} selected={line} onLine={setLine} found={found} />
        </div>
        <div className="space-y-3 xl:self-start">
          <Card className="!p-4">
            <p className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">File a report</p>
            <ReportForm
              programId={p.id}
              learner={learner}
              categories={p.categories}
              severities={p.severities}
              location={{ file, line, code: line ? active.content.replace(/\r\n/g, "\n").split("\n")[line - 1] : undefined }}
              left={p.reports_left_today}
              onFiled={(r) => {
                setOutcome(r);
                if (r.outcome === "valid") setNudge(null);
                reload();
              }}
            />
          </Card>
          <AnimatePresence>{outcome && <Outcome r={outcome} onClose={() => setOutcome(null)} />}</AnimatePresence>
          {p.found.length < p.bug_count && (
            <Card tint="amber" className="!p-4">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#96681c]" />
                <div className="min-w-0 flex-1">
                  {nudge ? (
                    <>
                      <p className="text-[13px] font-semibold leading-[1.45] text-[#151515]">{nudge.nudge}</p>
                      {nudge.message && <p className="mt-1 text-[11.5px] text-[#96681c]">{nudge.message}</p>}
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-semibold text-[#151515]">Stuck?</p>
                      <p className="text-[12px] leading-[1.45] text-[#6b5320] dark:text-neutral-300">A nudge says where to look — never what's wrong. That bug then pays half.</p>
                    </>
                  )}
                  <button onClick={askNudge} disabled={nudging || !learner} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#96681c] px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50">
                    {nudging ? <LoaderCircle className="size-3 animate-spin" /> : <Lightbulb className="size-3" />} {nudge ? "Nudge again" : "Get a nudge"}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {p.found.length > 0 && (
        <div>
          <p className="mb-3 text-[18px] font-medium tracking-[-0.02em] text-neutral-950">Bugs you've found</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {p.found.map((b) => (
              <Card key={b.id} className="!p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <SeverityChip severity={b.severity} />
                  <button
                    onClick={() => {
                      setFile(b.file);
                      setLine(b.line);
                    }}
                    className="font-mono text-[11.5px] text-neutral-500 hover:text-neutral-950"
                  >
                    {b.file}:{b.line}
                  </button>
                  <span className="ml-auto text-[12.5px] font-bold tabular-nums text-[#2f7c53]">+{b.points}</span>
                </div>
                <p className="mt-2 text-[14px] font-semibold text-neutral-950">{b.title}</p>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-neutral-600">{b.explanation}</p>
                <p className="mt-2 rounded-xl bg-[#359462]/10 px-3 py-2 text-[12px] leading-[1.5] text-[#24543a] dark:text-neutral-300">
                  <b>Fix:</b> {b.fix}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MyReports reports={p.my_reports} />
        <Board rows={p.board} />
      </div>
    </div>
  );
}

/* ───────────────────────── company / open-source program ───────────────────────── */

function TriageCard({ r, actor, onDone, ask }: { r: BountyReport; actor: string; onDone: () => void; ask: (title: string) => Promise<string | null> }) {
  const [sev, setSev] = useState<BountySeverity>((r.severity as BountySeverity) ?? "medium");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = r.status === "triage" || r.status === "needs_info";
  const act = async (status: "valid" | "duplicate" | "needs_info" | "invalid") => {
    setErr(null);
    const pin = await ask(status === "valid" ? `Confirm as ${sev} and pay the reward` : `Mark as ${status.replace("_", " ")}`);
    if (!pin) return;
    setBusy(true);
    try {
      await api.triageReport(r.id, { actor_id: actor, pin, status, final_severity: status === "valid" ? sev : undefined, note: note.trim() || undefined });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={r.status} />
        <SeverityChip severity={r.final_severity ?? r.severity} />
        <span className="text-[11.5px] text-neutral-500">
          by <b className="text-neutral-700">{r.reporter_name}</b> · {timeAgo(r.created_at)}
        </span>
        {r.points > 0 && <span className="ml-auto text-[12.5px] font-bold text-[#2f7c53]">paid {r.points}</span>}
      </div>
      <p className="mt-2 text-[14.5px] font-semibold text-neutral-950">{r.title}</p>
      {r.file && <p className="font-mono text-[11.5px] text-neutral-500">{r.file}{r.line ? `:${r.line}` : ""}</p>}
      <p className="mt-2 whitespace-pre-line text-[13px] leading-[1.55] text-neutral-700">{r.description}</p>
      {r.steps && <p className="mt-2 whitespace-pre-line rounded-xl bg-neutral-50 px-3 py-2 font-mono text-[12px] text-neutral-700">{r.steps}</p>}
      {r.impact && (
        <p className="mt-2 text-[12.5px] text-neutral-700">
          <b>Impact:</b> {r.impact}
        </p>
      )}
      {r.fix && (
        <p className="mt-1 text-[12.5px] text-neutral-700">
          <b>Suggested fix:</b> {r.fix}
        </p>
      )}
      {r.triage_note && <p className="mt-2 text-[12px] italic text-neutral-500">“{r.triage_note}”</p>}
      {open && (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] font-semibold text-neutral-600">Confirmed severity</span>
            {SEVS.map((s) => (
              <button key={s} onClick={() => setSev(s)} className={cn("rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold", sev === s ? "text-white" : "border-neutral-200 text-neutral-600")} style={sev === s ? { backgroundColor: SEVERITY_STYLE[s].color, borderColor: SEVERITY_STYLE[s].color } : undefined}>
                {SEVERITY_STYLE[s].label}
              </button>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the hunter (optional)" className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] outline-none focus:border-neutral-950" />
          {err && <p className="text-[12px] font-medium text-[#a8401f]">{err}</p>}
          <div className="flex flex-wrap gap-1.5">
            <button disabled={busy} onClick={() => act("valid")} className="inline-flex items-center gap-1 rounded-full bg-[#359462] px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
              <Check className="size-3.5" /> Confirm
            </button>
            {(["needs_info", "duplicate", "invalid"] as const).map((s) => (
              <button key={s} disabled={busy} onClick={() => act(s)} className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-neutral-700 hover:border-neutral-950 disabled:opacity-50">
                {s === "needs_info" ? "Needs info" : s === "duplicate" ? "Duplicate" : "Not valid"}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function HostedView({ p, learner, reload, banner }: { p: HostedProgramDetail; learner: string | null; reload: () => void; banner: React.ReactNode }) {
  const [outcome, setOutcome] = useState<FileReportResult | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(true);
  const [demo, setDemo] = useState<DemoCheckout | null>(null);
  const pin = usePin();
  useEffect(() => {
    if (learner)
      api
        .rewardsSummary(learner)
        .then((s) => setHasPin(s.has_pin))
        .catch(() => {});
  }, [learner]);
  const ask = (title: string) => (learner ? pin.ask(learner, hasPin, title).then((x) => (x && setHasPin(true), x)) : Promise.resolve(null));
  const queueOpen = p.queue.filter((r) => r.status === "triage" || r.status === "needs_info");

  const pay = async () => {
    if (!learner) return;
    setPayErr(null);
    const x = await ask("Continue to payment");
    if (!x) return;
    setPayBusy(true);
    try {
      const r = await api.programCheckout(p.id, learner, x);
      if (r.razorpay) {
        try {
          await payWithRazorpay(r.payment, r.razorpay, { name: p.company });
          reload();
        } catch (e) {
          if (!(e instanceof PaymentCancelled)) throw e;
        }
        setPayBusy(false);
      } else if (r.demo_checkout) {
        setDemo(r.demo_checkout);
        setPayBusy(false);
      }
    } catch (e) {
      setPayErr((e as Error).message);
      setPayBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {banner}
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <LogoTile src={p.logo} name={companyName(p.company).name} size={56} full={!!p.logo} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-semibold text-neutral-500">
                  {companyName(p.company).name} · {p.kind === "open_source" ? "open source" : companyName(p.company).demo ? "demo company program" : "company program"}
                </span>
                {p.plan !== "community" && <span className="rounded-full bg-[#bbf451] px-2 py-px text-[10px] font-bold text-[#1a2e05]">{p.plan_name}</span>}
              </div>
              <h1 className="text-[26px] font-medium leading-[1.15] tracking-[-0.035em] text-neutral-950">{p.title}</h1>
              <p className="mt-1 text-[13.5px] leading-[1.55] text-neutral-600">{p.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.repo_url && (
                  <a href={p.repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-3 py-1.5 text-[12px] font-semibold text-white">
                    <GithubIcon className="size-3.5" /> Open the repository <ExternalLink className="size-3" />
                  </a>
                )}
                {p.website && (
                  <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-700">
                    <Globe className="size-3.5" /> {p.website.replace(/^https:\/\//, "")} <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="lg:w-[22rem]">
            <RewardsRow rewards={p.rewards} />
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-neutral-500">
              <Zap className="size-3.5 fill-[#bbf451] text-[#4d7c0f]" />
              {p.pays_points ? `${p.points_left.toLocaleString("en-IN")} of ${p.points_pool.toLocaleString("en-IN")} reward points left in the pool` : "Community plan — confirmed bugs earn reputation, not points"}
            </p>
          </div>
        </div>
      </Card>

      {p.is_owner && p.status === "awaiting_payment" && (
        <Card tint="amber" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CreditCard className="size-5 shrink-0 text-[#96681c]" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#151515]">Waiting for payment — only you can see this program</p>
            <p className="text-[12.5px] text-[#6b5320] dark:text-neutral-300">It goes live for hunters as soon as the {p.plan_name} plan is paid.</p>
            {payErr && <p className="mt-1 text-[12px] font-medium text-[#a8401f]">{payErr}</p>}
            <PaymentsBadge label="Checkout by" className="mt-2" />
          </div>
          <button onClick={pay} disabled={payBusy} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-neutral-950 px-5 text-[13px] font-semibold text-white disabled:opacity-50">
            {payBusy ? <LoaderCircle className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Complete payment
          </button>
        </Card>
      )}

      <ScopeCard scope={p.scope} out={p.out_of_scope} checklist={p.checklist} />

      {p.is_owner ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[18px] font-medium tracking-[-0.02em] text-neutral-950">Triage queue</p>
              <span className="text-[12px] text-neutral-500">
                {queueOpen.length} waiting · {p.queue.length} total
              </span>
            </div>
            <div className="space-y-3">
              {p.queue.map((r) => (
                <TriageCard key={r.id} r={r} actor={learner ?? ""} onDone={reload} ask={ask} />
              ))}
              {!p.queue.length && <Card className="text-[13px] text-neutral-500">No reports yet. Hunters can see your program{p.status === "open" ? "" : " once it's live"}.</Card>}
            </div>
          </div>
          <div className="space-y-4">
            <Card tint="sky" className="!p-4 text-[12.5px] leading-[1.5] text-neutral-700">
              <p className="font-semibold text-neutral-950">How to triage well</p>
              <ul className="mt-1.5 space-y-1">
                <li>• Reproduce it with the hunter's steps before confirming.</li>
                <li>• Confirm the severity you actually saw — it sets the reward.</li>
                <li>• “Needs info” asks the hunter for more; they can file again.</li>
                <li>• Thank people — a kind “not valid” keeps hunters coming back.</li>
              </ul>
            </Card>
            {p.payments.length > 0 && (
              <Card className="!p-4">
                <SectionLabel>Payments</SectionLabel>
                {p.payments.map((x) => (
                  <p key={x.id} className="mt-2 flex items-center justify-between text-[12.5px]">
                    <span className="text-neutral-600">
                      {x.amount} · {timeAgo(x.created_at)}
                    </span>
                    <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", x.status === "succeeded" ? "bg-[#359462]/15 text-[#2f7c53]" : "bg-neutral-100 text-neutral-600")}>{x.status}</span>
                  </p>
                ))}
              </Card>
            )}
            <Board rows={p.board} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-4">
            <MyReports reports={p.my_reports} />
            <Board rows={p.board} />
          </div>
          <div className="space-y-3 lg:order-none">
            <Card className="!p-4">
              <p className="mb-1 text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">File a report</p>
              <p className="mb-3 text-[12px] text-neutral-500">{p.company} triages it by hand — you'll see the result in “Your reports”.</p>
              <ReportForm programId={p.id} learner={learner} categories={p.categories} severities={p.severities} location={null} left={p.reports_left_today} onFiled={(r) => (setOutcome(r), reload())} />
            </Card>
            <AnimatePresence>{outcome && <Outcome r={outcome} onClose={() => setOutcome(null)} />}</AnimatePresence>
          </div>
        </div>
      )}
      {pin.dialog}
      {demo && learner && (
        <DemoCheckoutSheet
          checkout={demo}
          ownerId={learner}
          onClose={() => setDemo(null)}
          onPaid={() => {
            setDemo(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const [learner] = useLearner();
  const [p, setP] = useState<ProgramDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    if (!learner) return;
    api
      .bountyProgram(id, learner)
      .then((x) => {
        setP(x);
        setErr(null);
      })
      .catch((e) => setErr((e as Error).message));
  }, [id, learner]);
  useEffect(() => load(), [load]);

  const banner = useMemo(
    () =>
      payNote && (
        <div className={cn("rounded-2xl px-4 py-3 text-[13px] font-medium", payNote.ok ? "bg-[#359462]/12 text-[#2f7c53]" : "bg-[#f59e0b]/12 text-[#96681c]")}>{payNote.text}</div>
      ),
    [payNote],
  );

  return (
    <AppShell title={p ? p.title : "Bug Bounty"} subtitle={p ? `${p.company} · bug bounty` : undefined} wide>
      <Link href="/bounty" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-neutral-500 hover:text-neutral-950">
        <ArrowLeft className="size-3.5" /> All programs
      </Link>
      {err && <Card className="text-[13px] text-[#a8401f]">{err}</Card>}
      {!p && !err && (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
          <div className="h-96 animate-pulse rounded-3xl bg-neutral-100" />
        </div>
      )}
      {p && (p.kind === "platform" ? <PlatformView p={p as PlatformProgramDetail} learner={learner} reload={load} /> : <HostedView p={p as HostedProgramDetail} learner={learner} reload={load} banner={banner} />)}
    </AppShell>
  );
}

export default function BountyProgramPage() {
  return (
    <Suspense>
      <ProgramPage />
    </Suspense>
  );
}
