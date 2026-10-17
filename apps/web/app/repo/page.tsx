"use client";

/**
 * Repo Analyse — paste a GitHub repo and get it explained for a beginner:
 *   Overview      what it is, its parts (frontend, backend, database…), how a
 *                 click travels through them, languages, folders, where to start
 *                 reading and how to run it
 *   Bugs to fix   code-level bugs with the exact line, why and how to fix
 *   Architecture  health score, findings, layers, Priya's review
 *   Roadmap       step-by-step plan, the shape to aim for, what to learn next
 * …and Priya to ask about any of it. Works offline on this project too.
 *
 * No repo? Switch to Website and paste a URL: the live site is checked for
 * security, speed, search, accessibility and good practice, and what it's
 * built with (see components/repo/SiteReport.tsx).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  ArrowRight,
  BookOpen,
  Bug,
  ChevronDown,
  CircleCheck,
  Compass,
  FileCode,
  FolderTree,
  Gauge,
  Globe,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  ShieldCheck as ShieldCheckIcon,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { Markdown } from "@/components/app/Markdown";
import { RepoBugs } from "@/components/repo/RepoBugs";
import { RepoOverview } from "@/components/repo/RepoOverview";
import { SiteReportView } from "@/components/repo/SiteReport";
import { SEV } from "@/components/repo/bits";
import { api, isPlanLimit, isSiteReport, timeAgo, type RepoFinding, type RepoReport, type Severity, type SiteReport } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { useI18n } from "@/lib/i18n/context";
import { useSpeaker } from "@/lib/voice";
import { cn } from "@/lib/utils";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const GRADE_COLOR: Record<string, string> = { A: "#359462", B: "#5aa832", C: "#f59e0b", D: "#e8792b", E: "#c64e27" };

const STEPS = ["Reading the file tree", "Opening the key files", "Sorting it into frontend, backend…", "Checking every line for bugs", "Writing your step-by-step plan"];
const SITE_STEPS = ["Opening the page", "Reading headers & cookies", "Checking robots.txt & sitemap", "Measuring scripts & images", "Spotting the tech it's built with"];

type TabId = "overview" | "bugs" | "architecture" | "roadmap";

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = GRADE_COLOR[grade] ?? "#359462";
  return (
    <div className="relative size-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-neutral-100" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] font-medium leading-none tracking-[-0.04em] text-neutral-950">
          <NumberFlow value={score} />
        </span>
        <span className="mt-1 rounded-full px-2 py-px text-[11px] font-bold text-white" style={{ backgroundColor: color }}>
          grade {grade}
        </span>
      </div>
    </div>
  );
}

const MAIN_LAYERS = ["ui", "api", "logic", "data"];

function LayerDiagram({ report }: { report: RepoReport }) {
  const main = MAIN_LAYERS.map((id) => report.layers.find((l) => l.id === id)!).filter(Boolean);
  const side = report.layers.filter((l) => !MAIN_LAYERS.includes(l.id));
  return (
    <div className="space-y-5">
      <div className="relative">
        {main.map((l, i) => (
          <div key={l.id}>
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.15 }}
              className={cn("relative rounded-2xl border-2 px-4 py-3", l.present ? "border-[#cfe9c8] bg-[#eeffe8]" : "border-dashed border-[#f3c8b8] bg-[#fdeee8]/60")}
            >
              <div className="flex items-start gap-2.5">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white", l.present ? "bg-[#359462]" : "bg-[#c64e27]")}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">{l.label}</p>
                  <p className="text-[12px] leading-[1.4] text-neutral-500">{l.simple}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-px text-[10.5px] font-bold", l.present ? "bg-white text-[#2f7c53]" : "bg-white text-[#a8401f]")}>{l.present ? `${l.files} files` : "missing"}</span>
              </div>
              {l.present && l.paths.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {l.paths.slice(0, 4).map((p) => (
                    <code key={p} className="max-w-full truncate rounded-md bg-white/80 px-1.5 py-px font-mono text-[11px] text-neutral-600">
                      {p}
                    </code>
                  ))}
                </div>
              )}
            </motion.div>
            {i < main.length - 1 && (
              <div className="relative mx-auto h-7 w-px bg-neutral-200">
                {l.present && main[i + 1].present && (
                  <motion.span className="absolute -left-[3px] size-[7px] rounded-full bg-[#359462]" animate={{ y: [0, 22], opacity: [0, 1, 0] }} transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.3 }} />
                )}
              </div>
            )}
          </div>
        ))}
        <div className="relative mx-auto h-7 w-px bg-neutral-200" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-center text-[12.5px] font-semibold text-neutral-600">
          🗄️ Database & outside services
        </motion.div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Around every layer</p>
      <div className="grid grid-cols-2 gap-2">
        {side.map((l, i) => (
          <motion.div key={l.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className={cn("min-w-0 rounded-xl border px-3 py-2", l.present ? "border-neutral-200 bg-white" : "border-dashed border-[#f3c8b8] bg-[#fdeee8]/50")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-neutral-900">{l.label}</span>
              {l.present ? <CircleCheck className="size-3.5 shrink-0 text-[#359462]" /> : <span className="text-[10.5px] font-bold text-[#a8401f]">missing</span>}
            </div>
            <p className="mt-0.5 text-[11px] leading-[1.4] text-neutral-500">{l.simple}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FindingCard({ f, onAsk, open, onToggle }: { f: RepoFinding; onAsk: (q: string) => void; open: boolean; onToggle: () => void }) {
  const s = SEV[f.severity];
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <s.Icon className="mt-0.5 size-4 shrink-0" style={{ color: s.dot }} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-[1.35] tracking-[-0.01em] text-neutral-950">{f.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-bold", s.chip)}>{s.label}</span>
            <span className="rounded-full bg-neutral-100 px-2 py-px text-[10.5px] font-semibold text-neutral-600">{f.area}</span>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-neutral-100 px-4 py-3.5 text-[13px] leading-[1.55]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Why it matters</p>
                <p className="mt-0.5 text-neutral-700">{f.why}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">What to do</p>
                <p className="mt-0.5 text-neutral-800">{f.fix}</p>
              </div>
              {f.files && f.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {f.files.map((p) => (
                    <code key={p} className="flex max-w-full items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700">
                      <FileCode className="size-3 shrink-0" /> <span className="truncate">{p}</span>
                    </code>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {f.learn && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f2eeff] px-2.5 py-0.5 text-[11px] font-semibold text-[#5e2ac4]">
                    <BookOpen className="size-3" /> Learn: {f.learn}
                  </span>
                )}
                <button onClick={() => onAsk(`How exactly do I fix this: ${f.title}?`)} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-950">
                  <Sparkles className="size-3" /> Ask Priya how
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AskRepo({ report, pending, onConsumed }: { report: RepoReport | SiteReport; pending: string | null; onConsumed: () => void }) {
  const [learner] = useLearner();
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setDraft("");
    setBusy(true);
    const r = await api.chat({ learner_id: learner, message: q, history, context: { page: "repo", repo_report_id: report.id } }).catch((e: Error) => ({ reply: isPlanLimit(e.message) ? `${e.message}\n\n[See the Pro plan →](/pricing)` : "I couldn't reach the server — try again." }));
    setMsgs((m) => [...m, { role: "assistant", content: r.reply }]);
    setBusy(false);
  };
  useEffect(() => {
    if (pending) {
      ask(pending);
      onConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);
  const site = isSiteReport(report);
  const suggestions = site ? ["What should I fix first?", "Is this site secure?", "What is it built with?"] : ["What should I fix first?", (report.bugs?.length ?? 0) > 0 ? "Which bug is the most serious?" : "How do I make it scalable?", "Where should I start reading?"];
  return (
    <div>
      <div ref={box} className="max-h-[340px] space-y-3 overflow-y-auto">
        {msgs.length === 0 && <p className="text-[12.5px] text-neutral-500">{site ? "Ask about anything in this report — a header, a problem, the tech, or what to fix first." : "Ask about anything in this report — a part, a folder, a bug, or what to fix first."}</p>}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] break-words rounded-2xl rounded-tr-md bg-neutral-950 px-3 py-2 text-[13px] text-white">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <img src="/people/priya.jpg" alt="" className="size-6 shrink-0 rounded-full object-cover" />
              <div className="min-w-0 rounded-2xl rounded-tl-md bg-neutral-100 px-3 py-2 text-neutral-800">
                <Markdown text={m.content} className="text-[13px]" />
              </div>
            </div>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-2 text-[12px] text-neutral-500">
            <LoaderCircle className="size-3.5 animate-spin" /> Priya is thinking…
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-neutral-700 hover:border-neutral-950 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="mt-2.5 flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white p-1 pl-3.5"
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={site ? "Ask Priya about this site…" : "Ask Priya about this repo…"} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
        <button disabled={!draft.trim() || busy} className="flex size-8 items-center justify-center rounded-full bg-neutral-950 text-white disabled:opacity-30" aria-label="Send">
          <SendHorizontal className="size-3.5" />
        </button>
      </form>
    </div>
  );
}

/** Reports saved before the beginner overview / bug check existed: offer a fresh run. */
function OldReport({ what, onRerun }: { what: string; onRerun: () => void }) {
  return (
    <Card className="text-center">
      <p className="text-[14px] font-semibold text-neutral-950">This report was saved before {what} existed.</p>
      <p className="mt-1 text-[12.5px] text-neutral-500">Run the analysis again to see it — it takes a few seconds.</p>
      <button onClick={onRerun} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-1.5 text-[12.5px] font-semibold text-white">
        <RefreshCw className="size-3.5" /> Analyse again
      </button>
    </Card>
  );
}

function ArchitectureTab({ report, onAsk, speaker }: { report: RepoReport; onAsk: (q: string) => void; speaker: ReturnType<typeof useSpeaker> }) {
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [openId, setOpenId] = useState<string | null>(report.findings[0]?.id ?? null);
  const findings = report.findings.filter((f) => sev === "all" || f.severity === sev);
  const counts = { high: report.findings.filter((f) => f.severity === "high").length, medium: report.findings.filter((f) => f.severity === "medium").length, low: report.findings.filter((f) => f.severity === "low").length };
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={report.score} grade={report.grade} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Architecture health</p>
            <p className="mt-1.5 text-[15px] font-medium leading-[1.45] tracking-[-0.01em] text-neutral-900">{report.verdict}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-neutral-950 px-2.5 py-0.5 text-[11px] font-semibold text-white">{report.kind}</span>
              {report.stack.map((s) => (
                <span key={s} className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:max-w-sm">
              {[
                ["files", report.metrics.files],
                ["code files", report.metrics.code_files],
                ["test files", report.metrics.test_files],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-2xl bg-neutral-50 px-2 py-2">
                  <p className="text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                    <NumberFlow value={v as number} />
                  </p>
                  <p className="text-[10.5px] text-neutral-500">{k}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Health by area</p>
          <div className="space-y-2.5">
            {report.areas.map((a, i) => (
              <div key={a.area} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[12.5px] font-medium text-neutral-700">{a.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: a.score >= 80 ? "#359462" : a.score >= 55 ? "#f59e0b" : "#c64e27" }} initial={{ width: 0 }} animate={{ width: `${a.score}%` }} transition={{ delay: 0.1 + i * 0.06, duration: 0.8 }} />
                </div>
                <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-neutral-800">{a.score}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Priya's review */}
      <Card tint="sky" className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img src="/people/priya.jpg" alt="Priya" className="size-14 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-neutral-950">Priya's review</p>
            <span className="rounded-full bg-white/70 px-2 py-px text-[10.5px] font-semibold text-neutral-500">{report.review_model ? report.review_model : "built-in"}</span>
            <button onClick={() => (speaker.speaking ? speaker.stop() : speaker.speak(report.review))} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-neutral-800 shadow-sm">
              {speaker.speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />} {speaker.speaking ? "Stop" : "Listen"}
            </button>
          </div>
          <p className="mt-2 text-[14px] leading-[1.6] text-neutral-800">{report.review}</p>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-[18px] font-medium tracking-[-0.02em] text-neutral-950">What to fix ({report.findings.length})</p>
            {(
              [
                ["all", `All`],
                ["high", `Fix first · ${counts.high}`],
                ["medium", `Soon · ${counts.medium}`],
                ["low", `Polish · ${counts.low}`],
              ] as ["all" | Severity, string][]
            ).map(([k, label]) => (
              <button key={k} onClick={() => setSev(k)} className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", sev === k ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400")}>
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {findings.map((f) => (
              <FindingCard key={f.id} f={f} open={openId === f.id} onToggle={() => setOpenId((o) => (o === f.id ? null : f.id))} onAsk={onAsk} />
            ))}
            {report.findings.length === 0 && <Card className="text-[13px] text-neutral-600">Nothing important to fix — this is a well-kept project. 🎉</Card>}
          </div>
          {report.strengths.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[18px] font-medium tracking-[-0.02em] text-neutral-950">Already good 👏</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {report.strengths.map((s) => (
                  <div key={s.title} className="flex items-start gap-2.5 rounded-2xl border border-[#cfe9c8] bg-[#eeffe8] px-4 py-3">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-[#359462]" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-neutral-950">{s.title}</p>
                      <p className="text-[12px] leading-[1.45] text-neutral-600">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Card className="min-w-0 self-start">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="size-4 text-neutral-500" />
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Your project's layers</p>
          </div>
          <LayerDiagram report={report} />
        </Card>
      </div>
    </div>
  );
}

function RoadmapTab({ report, onAsk }: { report: RepoReport; onAsk: (q: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <MapIcon className="size-4 text-neutral-500" />
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Your roadmap — one step at a time</p>
          </div>
          <ol className="relative space-y-4 pl-8">
            <span className="absolute bottom-2 left-[11px] top-2 w-px bg-neutral-200" />
            {report.roadmap.map((r, i) => (
              <motion.li key={r.step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="relative">
                <span className="absolute -left-8 flex size-6 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-bold text-white">{r.step}</span>
                <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-neutral-950">{r.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-neutral-600">{r.detail}</p>
              </motion.li>
            ))}
            {report.roadmap.length === 0 && <li className="text-[13px] text-neutral-500">No steps needed — keep doing what you're doing.</li>}
          </ol>
        </Card>
        <Card tint="green">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-4 text-[#2f7c53]" />
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">The shape to aim for (so it can scale)</p>
          </div>
          <p className="mb-4 text-[12.5px] leading-[1.5] text-neutral-600">{report.target.note}</p>
          <div className="space-y-0">
            {report.target.layers.map((l, i) => (
              <div key={l.label}>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="rounded-2xl border border-[#cfe9c8] bg-white/80 px-4 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13.5px] font-semibold text-neutral-950">{l.label}</span>
                    <code className="font-mono text-[11px] text-[#2f7c53]">{l.holds}</code>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-[1.45] text-neutral-600">{l.rule}</p>
                </motion.div>
                {i < report.target.layers.length - 1 && <div className="mx-auto flex h-5 w-px items-center justify-center bg-[#cfe9c8] text-[10px] text-[#2f7c53]" />}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {report.learn.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="size-4 text-neutral-500" />
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">What to learn next</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {report.learn.map((l) => (
              <button key={l.topic} onClick={() => onAsk(`Explain "${l.topic}" to me like I'm a beginner, using my repo as the example.`)} className="rounded-2xl border border-[#ddd0ff] bg-[#f2eeff] px-4 py-3 text-left transition-transform hover:-translate-y-0.5">
                <p className="flex items-center justify-between gap-2 text-[13.5px] font-semibold text-[#3f1d8a]">
                  {l.topic} <ArrowRight className="size-3.5 shrink-0" />
                </p>
                <p className="mt-0.5 text-[12px] leading-[1.45] text-[#5e4a8f]">{l.why}</p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function RepoPage() {
  const { t } = useI18n();
  const [learner] = useLearner();
  const [mode, setMode] = useState<"repo" | "site">("repo");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RepoReport | SiteReport | null>(null);
  const [history, setHistory] = useState<{ id: string; repo: string; source: string; score: number; grade: string; created_at: string }[]>([]);
  const [tab, setTab] = useState<TabId>("overview");
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const speaker = useSpeaker();
  const top = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLDivElement>(null);

  const loadHistory = () => api.repoReports(learner).then((r) => setHistory(r.reports)).catch(() => {});
  useEffect(() => {
    if (learner) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner]);

  useEffect(() => {
    if (!busy) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the fake progress when a new analysis starts
    setStepIdx(0);
    const id = setInterval(() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)), mode === "site" ? 700 : 900);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const show = (r: RepoReport | SiteReport) => {
    setReport(r);
    if (isSiteReport(r)) setMode("site");
    else setTab(r.overview ? "overview" : "architecture");
    setTimeout(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const run = async (body: { url?: string; local?: boolean; site?: boolean }) => {
    setBusy(true);
    setError(null);
    setReport(null);
    speaker.stop();
    try {
      const r = body.site ? await api.analyzeSite({ url: body.url ?? "", learner_id: learner }) : await api.analyzeRepo({ url: body.url, local: body.local, learner_id: learner });
      show(r);
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const rerun = () => report && (isSiteReport(report) ? run({ url: report.site.url, site: true }) : run(report.repo.source === "local" ? { local: true } : { url: report.repo.url ?? `${report.repo.owner}/${report.repo.name}` }));
  const repoReport = report && !isSiteReport(report) ? report : null;
  const siteReport = report && isSiteReport(report) ? report : null;

  const ask = (q: string) => {
    setPendingQ(q);
    askRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const bugCount = repoReport?.bugs?.length ?? 0;
  const tabs = useMemo(
    () =>
      [
        { id: "overview", label: "Overview", hint: "for beginners", Icon: Compass, count: null },
        { id: "bugs", label: "Bugs to fix", hint: null, Icon: Bug, count: repoReport?.bugs ? bugCount : null },
        { id: "architecture", label: "Architecture", hint: null, Icon: Layers, count: repoReport?.findings.length ?? null },
        { id: "roadmap", label: "Roadmap & learn", hint: null, Icon: MapIcon, count: null },
      ] as { id: TabId; label: string; hint: string | null; Icon: typeof Compass; count: number | null }[],
    [repoReport, bugCount],
  );

  return (
    <AppShell title={t("app.repo")} subtitle="Understand any project — and learn to build it right" wide>
      <PageHeading
        eyebrow="Repo Analyse"
        title="Repo Analyse"
        body="Paste a GitHub repo to see how it's built, which lines look like bugs and how to fix them. No public code? Paste the website instead — it's checked for security, speed, SEO and accessibility, and what it's built with."
      />

      {/* input */}
      <Card className="mb-6">
        <div className="mb-3 inline-flex rounded-full border border-neutral-200 bg-white p-1" role="tablist" aria-label="What to analyse">
          {(
            [
              ["repo", "GitHub repo"],
              ["site", "Website URL"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode === k}
              onClick={() => {
                setMode(k);
                setUrl("");
                setError(null);
              }}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold", mode === k ? "bg-neutral-950 text-white" : "text-neutral-600 hover:text-neutral-950")}
            >
              {k === "site" ? <Globe className="size-3.5" /> : <GithubMark className="size-3.5" />} {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) run(mode === "site" ? { url, site: true } : { url });
          }}
          className="flex flex-col gap-2.5 sm:flex-row"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-4 focus-within:border-neutral-950">
            {mode === "site" ? <Globe className="size-4 shrink-0 text-neutral-500" /> : <GithubMark className="size-4 shrink-0 text-neutral-500" />}
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={mode === "site" ? "https://company.com — any public website" : "https://github.com/owner/repo  — or just owner/repo"} inputMode="url" className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-neutral-400" />
          </div>
          <button disabled={busy || !url.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Gauge className="size-4" />} Analyse
          </button>
        </form>
        {mode === "site" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-neutral-400">Try:</span>
            {["python.org", "wordpress.org", "nextjs.org"].map((r) => (
              <button key={r} onClick={() => (setUrl(r), run({ url: r, site: true }))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700 hover:border-neutral-950 disabled:opacity-50">
                <Globe className="size-3 shrink-0" /> {r}
              </button>
            ))}
          </div>
        ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-neutral-400">Try:</span>
          <button onClick={() => run({ local: true })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe9c8] bg-[#eeffe8] px-3 py-1 font-semibold text-[#2f7c53] disabled:opacity-50">
            <FolderTree className="size-3.5" /> This project (works offline)
          </button>
          {["icancodefyi/VH26-IMPIC", "rohit94r/Apply-saas"].map((r) => (
            <button key={r} onClick={() => (setUrl(r), run({ url: r }))} disabled={busy} className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700 hover:border-neutral-950 disabled:opacity-50">
              <GithubMark className="size-3 shrink-0" /> <span className="truncate">{r}</span>
            </button>
          ))}
        </div>
        )}
        <AnimatePresence>
          {busy && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <ol className="mt-4 grid gap-1.5 sm:grid-cols-5">
                {(mode === "site" ? SITE_STEPS : STEPS).map((s, i) => (
                  <li key={s} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] transition-colors", i < stepIdx ? "bg-[#eeffe8] text-[#2f7c53]" : i === stepIdx ? "bg-neutral-100 font-semibold text-neutral-900" : "text-neutral-400")}>
                    {i < stepIdx ? <CircleCheck className="size-3.5 shrink-0" /> : i === stepIdx ? <LoaderCircle className="size-3.5 shrink-0 animate-spin" /> : <span className="size-3.5 shrink-0 rounded-full border border-neutral-300" />}
                    {s}
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
        {error && (
          <p className="mt-3 rounded-2xl bg-[#fdeee8] px-4 py-3 text-[13px] text-[#a8401f]">
            {error}
            {isPlanLimit(error) && (
            <a href="/pricing" className="ml-1.5 font-semibold underline underline-offset-2">
              See Pro
            </a>
          )}
          </p>
        )}
        {history.length > 0 && (
          <div className="mt-4 border-t border-neutral-100 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Your recent reports</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => api.repoReport(h.id).then(show).catch((e) => setError((e as Error).message))}
                  className={cn("flex shrink-0 items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] hover:border-neutral-950", report?.id === h.id ? "border-neutral-950" : "border-neutral-200")}
                >
                  <span className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: GRADE_COLOR[h.grade] }}>
                    {h.grade}
                  </span>
                  {h.source === "site" ? <Globe className="size-3.5 text-neutral-400" /> : null}
                  <span className="font-semibold text-neutral-800">{h.repo === "local" ? "this project" : h.repo}</span>
                  <span className="text-neutral-400">{timeAgo(h.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {!report && !busy && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(mode === "site"
            ? [
                { Icon: ShieldCheckIcon, h: "Is it secure?", b: "HTTPS, security headers, cookies, mixed content, old libraries with known holes, keys left in the page." },
                { Icon: Gauge, h: "Is it fast?", b: "Server response time, compression, render-blocking scripts, heavy images, caching." },
                { Icon: Compass, h: "Can people find it?", b: "Title, description, headings, robots.txt, sitemap, social preview, structured data." },
                { Icon: Layers, h: "What's it built with?", b: "Framework, CMS, hosting, analytics and widgets — with the evidence for each." },
              ]
            : [
                { Icon: Compass, h: "What's inside?", b: "The frontend, the backend, the database and every language — explained like you're new." },
                { Icon: Bug, h: "Any bugs?", b: "Off-by-one loops, async mistakes, SQL built from text, unsafe HTML, plain-text passwords — with the exact line and the fix." },
                { Icon: Layers, h: "Is it organised?", b: "Screens, routes, logic and data in their own layers — or tangled together?" },
                { Icon: MapIcon, h: "Can it grow?", b: "Tests, CI, config, health checks — what you'll need before real users arrive." },
              ]
          ).map(({ Icon, h, b }) => (
            <Card key={h}>
              <Icon className="size-5 text-neutral-400" />
              <p className="mt-2 text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">{h}</p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-neutral-500">{b}</p>
            </Card>
          ))}
        </div>
      )}

      {siteReport && (
        <div ref={top} className="grid scroll-mt-20 gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <SiteReportView key={siteReport.id} report={siteReport} onAsk={ask} />
          </div>
          <aside ref={askRef} className="min-w-0 scroll-mt-32 2xl:sticky 2xl:top-[80px] 2xl:self-start">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <img src="/people/priya.jpg" alt="" className="size-6 rounded-full object-cover" />
                <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Ask Priya about this site</p>
              </div>
              <AskRepo key={siteReport.id} report={siteReport} pending={pendingQ} onConsumed={() => setPendingQ(null)} />
            </Card>
          </aside>
        </div>
      )}

      {repoReport && (
        <div ref={top} className="scroll-mt-20 space-y-4">
          {/* which repo */}
          <Card className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {repoReport.repo.source === "github" ? <GithubMark className="size-4 shrink-0 text-neutral-500" /> : <FolderTree className="size-4 shrink-0 text-neutral-500" />}
                {repoReport.repo.url ? (
                  <a href={repoReport.repo.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.02em] text-neutral-950 hover:underline">
                    {repoReport.repo.owner ? `${repoReport.repo.owner}/` : ""}
                    {repoReport.repo.name}
                  </a>
                ) : (
                  <span className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{repoReport.repo.name}</span>
                )}
                {typeof repoReport.repo.stars === "number" && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-neutral-500">
                    <Star className="size-3" /> {repoReport.repo.stars}
                  </span>
                )}
                <span className="rounded-full bg-neutral-950 px-2.5 py-0.5 text-[11px] font-semibold text-white">{repoReport.kind}</span>
              </div>
              {repoReport.repo.description && <p className="mt-1 text-[12.5px] text-neutral-500">{repoReport.repo.description}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2 lg:w-[340px]">
              <button onClick={() => setTab("architecture")} className="rounded-2xl bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100">
                <p className="flex items-center gap-1.5 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                  <span className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: GRADE_COLOR[repoReport.grade] }}>
                    {repoReport.grade}
                  </span>
                  <NumberFlow value={repoReport.score} />
                </p>
                <p className="text-[10.5px] text-neutral-500">health score</p>
              </button>
              <button onClick={() => setTab("bugs")} className="rounded-2xl bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100">
                <p className="flex items-center gap-1.5 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                  <Bug className={cn("size-4", bugCount ? "text-[#c64e27]" : "text-[#359462]")} />
                  {repoReport.bugs ? <NumberFlow value={bugCount} /> : "–"}
                </p>
                <p className="text-[10.5px] text-neutral-500">bugs to fix</p>
              </button>
              <button onClick={() => setTab("overview")} className="rounded-2xl bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100">
                <p className="text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                  <NumberFlow value={repoReport.metrics.files} />
                </p>
                <p className="text-[10.5px] text-neutral-500">files</p>
              </button>
            </div>
          </Card>

          {/* tabs — they scroll sideways on a phone; Ask Priya stays one tap away */}
          <div className="sticky top-[57px] z-20 -mx-1 bg-neutral-50/70 px-1 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label="Report sections" className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                {tabs.map((x) => (
                  <button
                    key={x.id}
                    role="tab"
                    aria-selected={tab === x.id}
                    onClick={() => setTab(x.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                      tab === x.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
                    )}
                  >
                    <x.Icon className="size-3.5" />
                    {x.label}
                    {x.hint && <span className={cn("hidden text-[11px] font-medium sm:inline", tab === x.id ? "opacity-70" : "text-neutral-400")}>· {x.hint}</span>}
                    {x.count !== null && (
                      <span className={cn("rounded-full px-1.5 text-[10.5px] font-bold tabular-nums", tab === x.id ? "bg-white/20" : x.id === "bugs" && x.count ? "bg-[#fdeee8] text-[#a8401f]" : "bg-neutral-100 text-neutral-600")}>{x.count}</span>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => askRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-3 text-[12.5px] font-semibold text-neutral-800 hover:border-neutral-950 2xl:hidden">
                <img src="/people/priya.jpg" alt="" className="size-7 rounded-full object-cover" />
                <span className="hidden sm:inline">Ask Priya</span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div key={`${repoReport.id}-${tab}`} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                  {tab === "overview" && (repoReport.overview ? <RepoOverview report={repoReport} onAsk={ask} /> : <OldReport what="the beginner overview" onRerun={rerun} />)}
                  {tab === "bugs" && (repoReport.bugs ? <RepoBugs report={repoReport} onAsk={ask} /> : <OldReport what="the bug check" onRerun={rerun} />)}
                  {tab === "architecture" && <ArchitectureTab report={repoReport} onAsk={ask} speaker={speaker} />}
                  {tab === "roadmap" && <RoadmapTab report={repoReport} onAsk={ask} />}
                </motion.div>
              </AnimatePresence>
            </div>
            <aside ref={askRef} className="min-w-0 scroll-mt-32 2xl:sticky 2xl:top-[124px] 2xl:self-start">
              <Card>
                <div className="mb-3 flex items-center gap-2">
                  <img src="/people/priya.jpg" alt="" className="size-6 rounded-full object-cover" />
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Ask Priya about this repo</p>
                </div>
                <AskRepo key={repoReport.id} report={repoReport} pending={pendingQ} onConsumed={() => setPendingQ(null)} />
              </Card>
            </aside>
          </div>

          <p className="text-center text-[11.5px] text-neutral-400">
            Read {repoReport.metrics.sampled_files} of {repoReport.metrics.files} files in full{repoReport.truncated ? " (GitHub truncated the file list — very large repo)" : ""}. Secrets are reported by file and line only — their values are never copied, and a line that looks like a secret is never shown in a snippet.
          </p>
        </div>
      )}
    </AppShell>
  );
}
