"use client";

/**
 * Repo Analyse — paste a GitHub repo, get a beginner-friendly architecture
 * review: a health score, the layers your project has (and is missing), what
 * to fix first and WHY, a step-by-step roadmap, the shape to aim for so it can
 * scale, and Priya to ask about any of it. Works offline on this project too.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleCheck,
  FileCode,
  FolderTree,
  Gauge,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  SendHorizontal,
  ShieldAlert,
  Sparkles,
  Star,
  TriangleAlert,
  Volume2,
  VolumeX,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { Markdown } from "@/components/app/Markdown";
import { api, timeAgo, type RepoFinding, type RepoReport, type Severity } from "@/lib/api";
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

const SEV: Record<Severity, { label: string; dot: string; chip: string; Icon: typeof ShieldAlert }> = {
  high: { label: "Fix first", dot: "#c64e27", chip: "border-[#f3c8b8] bg-[#fdeee8] text-[#a8401f]", Icon: ShieldAlert },
  medium: { label: "Fix soon", dot: "#f59e0b", chip: "border-[#fde1a8] bg-[#fff6e3] text-[#96681c]", Icon: TriangleAlert },
  low: { label: "Polish", dot: "#0586d2", chip: "border-sky-200 bg-sky-50 text-sky-700", Icon: Wrench },
};

const GRADE_COLOR: Record<string, string> = { A: "#359462", B: "#5aa832", C: "#f59e0b", D: "#e8792b", E: "#c64e27" };

const STEPS = ["Reading the file tree", "Opening the key files", "Checking for secrets and risky code", "Finding your project's layers", "Writing your step-by-step plan"];

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
                    <code key={p} className="rounded-md bg-white/80 px-1.5 py-px font-mono text-[11px] text-neutral-600">
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
          <motion.div key={l.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className={cn("rounded-xl border px-3 py-2", l.present ? "border-neutral-200 bg-white" : "border-dashed border-[#f3c8b8] bg-[#fdeee8]/50")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-neutral-900">{l.label}</span>
              {l.present ? <CircleCheck className="size-3.5 text-[#359462]" /> : <span className="text-[10.5px] font-bold text-[#a8401f]">missing</span>}
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
      <button onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
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
                    <code key={p} className="flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700">
                      <FileCode className="size-3" /> {p}
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

function AskRepo({ report, pending, onConsumed }: { report: RepoReport; pending: string | null; onConsumed: () => void }) {
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
    const r = await api.chat({ learner_id: learner, message: q, history, context: { page: "repo", repo_report_id: report.id } }).catch(() => ({ reply: "I couldn't reach the server — try again." }));
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
  return (
    <div>
      <div ref={box} className="max-h-[320px] space-y-3 overflow-y-auto">
        {msgs.length === 0 && <p className="text-[12.5px] text-neutral-500">Ask about anything in this report — “What should I fix first?”, “How do I add tests?”, “How do I make it scale?”</p>}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-neutral-950 px-3 py-2 text-[13px] text-white">{m.content}</div>
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
        {["What should I fix first?", "How do I make it scalable?", "What's already good?"].map((s) => (
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
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask Priya about this repo…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
        <button disabled={!draft.trim() || busy} className="flex size-8 items-center justify-center rounded-full bg-neutral-950 text-white disabled:opacity-30" aria-label="Send">
          <SendHorizontal className="size-3.5" />
        </button>
      </form>
    </div>
  );
}

export default function RepoPage() {
  const { t } = useI18n();
  const [learner] = useLearner();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RepoReport | null>(null);
  const [history, setHistory] = useState<{ id: string; repo: string; source: string; score: number; grade: string; created_at: string }[]>([]);
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [openId, setOpenId] = useState<string | null>(null);
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
    const id = setInterval(() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)), 900);
    return () => clearInterval(id);
  }, [busy]);

  const run = async (body: { url?: string; local?: boolean }) => {
    setBusy(true);
    setError(null);
    setReport(null);
    speaker.stop();
    try {
      const r = await api.analyzeRepo({ ...body, learner_id: learner });
      setReport(r);
      setOpenId(r.findings[0]?.id ?? null);
      loadHistory();
      setTimeout(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const findings = useMemo(() => (report ? report.findings.filter((f) => sev === "all" || f.severity === sev) : []), [report, sev]);
  const counts = useMemo(() => ({ high: report?.findings.filter((f) => f.severity === "high").length ?? 0, medium: report?.findings.filter((f) => f.severity === "medium").length ?? 0, low: report?.findings.filter((f) => f.severity === "low").length ?? 0 }), [report]);

  return (
    <AppShell title={t("app.repo")} subtitle="Learn architecture from your own project" wide>
      <PageHeading eyebrow="Repo Analyse" title="Paste a repo." accent="Learn how to build it right." body="Layerflow reads your GitHub project and explains — in plain words — what's risky, what's messy, and how to shape it so it can grow. Every finding comes with the why and the fix." />

      {/* input */}
      <Card className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) run({ url });
          }}
          className="flex flex-col gap-2.5 sm:flex-row"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-4 focus-within:border-neutral-950">
            <GithubMark className="size-4 shrink-0 text-neutral-500" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo  — or just owner/repo" className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-neutral-400" />
          </div>
          <button disabled={busy || !url.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Gauge className="size-4" />} Analyse
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-neutral-400">Try:</span>
          <button onClick={() => run({ local: true })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe9c8] bg-[#eeffe8] px-3 py-1 font-semibold text-[#2f7c53] disabled:opacity-50">
            <FolderTree className="size-3.5" /> This project (works offline)
          </button>
          {["icancodefyi/VH26-IMPIC", "rohit94r/Apply-saas"].map((r) => (
            <button key={r} onClick={() => (setUrl(r), run({ url: r }))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700 hover:border-neutral-950 disabled:opacity-50">
              <GithubMark className="size-3" /> {r}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {busy && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <ol className="mt-4 grid gap-1.5 sm:grid-cols-5">
                {STEPS.map((s, i) => (
                  <li key={s} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] transition-colors", i < stepIdx ? "bg-[#eeffe8] text-[#2f7c53]" : i === stepIdx ? "bg-neutral-100 font-semibold text-neutral-900" : "text-neutral-400")}>
                    {i < stepIdx ? <CircleCheck className="size-3.5 shrink-0" /> : i === stepIdx ? <LoaderCircle className="size-3.5 shrink-0 animate-spin" /> : <span className="size-3.5 shrink-0 rounded-full border border-neutral-300" />}
                    {s}
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="mt-3 rounded-2xl bg-[#fdeee8] px-4 py-3 text-[13px] text-[#a8401f]">{error}</p>}
      </Card>

      {!report && !busy && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["🔐", "Is it safe?", "Secrets committed by accident, SQL built from strings, debug mode left on."],
            ["🧱", "Is it organised?", "Screens, routes, logic and data in their own layers — or tangled together?"],
            ["🚀", "Can it grow?", "Tests, CI, config, health checks — what you'll need before real users arrive."],
          ].map(([e, h, b]) => (
            <Card key={h}>
              <p className="text-2xl">{e}</p>
              <p className="mt-2 text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">{h}</p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-neutral-500">{b}</p>
            </Card>
          ))}
          {history.length > 0 && (
            <Card className="sm:col-span-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Your recent reports</p>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button key={h.id} onClick={() => api.repoReport(h.id).then((r) => (setReport(r), setOpenId(r.findings[0]?.id ?? null)))} className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] hover:border-neutral-950">
                    <span className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: GRADE_COLOR[h.grade] }}>
                      {h.grade}
                    </span>
                    <span className="font-semibold text-neutral-800">{h.repo === "local" ? "this project" : h.repo}</span>
                    <span className="text-neutral-400">{timeAgo(h.created_at)}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {report && (
        <div ref={top} className="scroll-mt-20 space-y-6">
          {/* summary */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ScoreRing score={report.score} grade={report.grade} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {report.repo.source === "github" ? <GithubMark className="size-4 text-neutral-500" /> : <FolderTree className="size-4 text-neutral-500" />}
                  {report.repo.url ? (
                    <a href={report.repo.url} target="_blank" rel="noreferrer" className="truncate text-[17px] font-semibold tracking-[-0.02em] text-neutral-950 hover:underline">
                      {report.repo.owner ? `${report.repo.owner}/` : ""}
                      {report.repo.name}
                    </a>
                  ) : (
                    <span className="text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">{report.repo.name}</span>
                  )}
                  {typeof report.repo.stars === "number" && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-neutral-500">
                      <Star className="size-3" /> {report.repo.stars}
                    </span>
                  )}
                </div>
                {report.repo.description && <p className="mt-1 text-[12.5px] text-neutral-500">{report.repo.description}</p>}
                <p className="mt-3 text-[15px] font-medium leading-[1.45] tracking-[-0.01em] text-neutral-900">{report.verdict}</p>
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
              {report.metrics.languages.length > 0 && (
                <>
                  <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Languages</p>
                  <div className="flex h-2.5 overflow-hidden rounded-full">
                    {report.metrics.languages.map((l, i) => (
                      <div key={l.name} style={{ width: `${l.share}%`, backgroundColor: ["#359462", "#0586d2", "#f59e0b", "#7B35F0", "#ec4899", "#c64e27"][i % 6] }} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                    {report.metrics.languages.map((l, i) => (
                      <span key={l.name} className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: ["#359462", "#0586d2", "#f59e0b", "#7B35F0", "#ec4899", "#c64e27"][i % 6] }} />
                        {l.name} {l.share}%
                      </span>
                    ))}
                  </div>
                </>
              )}
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

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            {/* findings */}
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
                  <FindingCard
                    key={f.id}
                    f={f}
                    open={openId === f.id}
                    onToggle={() => setOpenId((o) => (o === f.id ? null : f.id))}
                    onAsk={(q) => {
                      setPendingQ(q);
                      askRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  />
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
                        <div>
                          <p className="text-[13px] font-semibold text-neutral-950">{s.title}</p>
                          <p className="text-[12px] leading-[1.45] text-neutral-600">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* layers + ask */}
            <div className="min-w-0 space-y-6">
              <Card>
                <div className="mb-4 flex items-center gap-2">
                  <Layers className="size-4 text-neutral-500" />
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Your project's layers</p>
                </div>
                <LayerDiagram report={report} />
              </Card>
              <div ref={askRef}>
                <Card>
                  <div className="mb-3 flex items-center gap-2">
                    <img src="/people/priya.jpg" alt="" className="size-6 rounded-full object-cover" />
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Ask Priya about this repo</p>
                  </div>
                  <AskRepo report={report} pending={pendingQ} onConsumed={() => setPendingQ(null)} />
                </Card>
              </div>
            </div>
          </div>

          {/* roadmap + target */}
          <div className="grid gap-6 lg:grid-cols-2">
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
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {report.learn.map((l) => (
                  <button key={l.topic} onClick={() => (setPendingQ(`Explain "${l.topic}" to me like I'm a beginner, using my repo as the example.`), askRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }))} className="rounded-2xl border border-[#ddd0ff] bg-[#f2eeff] px-4 py-3 text-left transition-transform hover:-translate-y-0.5">
                    <p className="flex items-center justify-between text-[13.5px] font-semibold text-[#3f1d8a]">
                      {l.topic} <ArrowRight className="size-3.5" />
                    </p>
                    <p className="mt-0.5 text-[12px] leading-[1.45] text-[#5e4a8f]">{l.why}</p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <p className="text-center text-[11.5px] text-neutral-400">
            Read {report.metrics.sampled_files} of {report.metrics.files} files in full{report.truncated ? " (GitHub truncated the file list — very large repo)" : ""}. Secrets are reported by file and line only — their values are never copied.
          </p>
        </div>
      )}
    </AppShell>
  );
}
