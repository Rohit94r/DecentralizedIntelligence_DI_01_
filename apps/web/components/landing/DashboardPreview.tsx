"use client";

/**
 * The dark app mockup under the hero — same frame, sidebar and sizes as the
 * reference's dashboard preview, showing the REAL output Layerflow produces
 * for the statement's own example (Yash's last_k_total).
 */
import React, { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart2, ListChecks, MapPin, MessageCircleQuestion, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { Logo } from "@/components/Logo";
import { highlightLine } from "@/lib/python";
import { LAST_K_STARTER, MODEL_LADDER } from "./landingData";

const VISIBLE = [
  { call: "last_k_total([10, 20, 30, 40], 2)", expected: "70", got: "70" },
  { call: "last_k_total([5, 5, 5], 3)", expected: "15", got: "15" },
  { call: "last_k_total([7], 1)", expected: "7", got: "7" },
];
const HIDDEN = ["passed", "passed", "runtime_error", "wrong_output", "wrong_output", "passed"] as const;
const CHIP: Record<string, string> = {
  passed: "bg-[#359462]/20 text-[#8fe3a6] border-[#359462]/40",
  wrong_output: "bg-[#f59e0b]/15 text-[#f6c46a] border-[#f59e0b]/35",
  runtime_error: "bg-[#c64e27]/20 text-[#ff9b77] border-[#c64e27]/40",
};
const EXPLANATION =
  "All 3 visible tests pass, but 3 of the 6 hidden tests fail: one crashes and two give the wrong total. All three are cases where k is larger than the number of marks. Your loop starts at len(marks) - k, which is negative then.";

function PreviewResults() {
  const { t } = useI18n();
  const [run, setRun] = useState(1);
  const [phase, setPhase] = useState<"running" | "done">("running");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- replay the reveal on each run
    setPhase("running");
    const id = setTimeout(() => setPhase("done"), 900);
    return () => clearTimeout(id);
  }, [run]);
  const passedHidden = phase === "done" ? HIDDEN.filter((h) => h === "passed").length : 0;
  return (
    <div className="flex h-[330px] flex-col gap-3 overflow-hidden p-3 sm:h-auto sm:min-h-[640px] sm:gap-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] text-neutral-500 sm:text-sm">riya · last-k-total · s_0142</p>
          <p className="mt-1 font-poppins text-sm font-semibold text-white sm:text-xl">{phase === "done" ? "You're close — this is one edge case away." : t("hero.running")}</p>
        </div>
        <button
          onClick={() => setRun((r) => r + 1)}
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md border-2 border-neutral-700/60 bg-neutral-800 px-3 py-1.5 font-poppins text-xs text-white transition-all hover:bg-neutral-700/60 active:scale-98 sm:px-5 sm:py-2.5 sm:text-sm"
        >
          <Play className="size-3.5" /> {t("hero.submit")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-neutral-800/30 p-3 sm:p-5">
          <p className="font-poppins text-[10px] tracking-[0.1em] text-neutral-500 sm:text-sm">{t("hero.visible")}</p>
          <p className="mt-1 font-poppins text-lg font-semibold text-white sm:mt-2 sm:text-4xl">
            <NumberFlow value={phase === "done" ? 3 : 0} />
            <span className="text-neutral-500">/3</span>
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-neutral-800/30 p-3 sm:p-5">
          <p className="font-poppins text-[10px] tracking-[0.1em] text-neutral-500 sm:text-sm">{t("hero.hidden")}</p>
          <p className="mt-1 font-poppins text-lg font-semibold text-white sm:mt-2 sm:text-4xl">
            <NumberFlow value={passedHidden} />
            <span className="text-neutral-500">/6</span>
          </p>
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-white/10 bg-neutral-900 sm:block">
        {VISIBLE.map((v, i) => (
          <motion.div
            key={`${run}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: phase === "done" ? 1 : 0.35, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 font-mono text-[12.5px] last:border-0"
          >
            <span className="text-neutral-500">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-neutral-200">{v.call}</span>
            <span className="text-neutral-500">→ {v.got}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${CHIP.passed}`}>passed</span>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {HIDDEN.map((h, i) => (
          <motion.span
            key={`${run}-h${i}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={phase === "done" ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0.3 }}
            transition={{ delay: 0.25 + i * 0.05, type: "spring", stiffness: 400, damping: 22 }}
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] sm:px-3 sm:py-1 sm:text-xs ${phase === "done" ? CHIP[h] : "border-white/10 text-neutral-600"}`}
          >
            hidden {i + 1} · {phase === "done" ? h : "…"}
          </motion.span>
        ))}
      </div>
      <AnimatePresence>
        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.5 }} className="rounded-lg border border-[#bbf451]/20 bg-[#bbf451]/[0.06] p-3 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-[#c64e27]/25 px-2 py-0.5 font-mono text-[10px] text-[#ff9b77]">unhandled_short_input</span>
              <span className="font-poppins text-[10px] uppercase tracking-[0.14em] text-neutral-500">explanation</span>
            </div>
            <p className="font-poppins text-[11px] leading-5 text-neutral-200 sm:text-[15px] sm:leading-7">{EXPLANATION}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PreviewHints() {
  const { t } = useI18n();
  const [rung, setRung] = useState(1);
  return (
    <div className="flex h-[330px] flex-col gap-3 overflow-hidden p-3 sm:h-auto sm:min-h-[640px] sm:gap-4 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="font-poppins text-sm font-semibold text-white sm:text-xl">Hint ladder · rung {rung} of 4</p>
        <div className="flex gap-2">
          <button
            onClick={() => setRung((r) => Math.min(4, r + 1))}
            className="cursor-pointer rounded-md border-2 border-neutral-700/60 bg-neutral-800 px-3 py-1.5 font-poppins text-xs text-white transition-all hover:bg-neutral-700/60 sm:px-4 sm:py-2 sm:text-sm"
          >
            {t("features.askAnswer")}
          </button>
          <button onClick={() => setRung(1)} className="cursor-pointer rounded-md border-2 border-neutral-700/60 bg-neutral-900 px-3 py-1.5 font-poppins text-xs text-neutral-400 hover:text-white sm:text-sm">
            ↺
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:gap-3">
        {MODEL_LADDER.map((h, i) => {
          const shown = i < rung;
          return (
            <motion.div
              key={i}
              layout
              initial={false}
              animate={{ opacity: shown ? 1 : 0.28, scale: shown ? 1 : 0.98 }}
              className={`rounded-lg border p-3 sm:p-4 ${i === rung - 1 ? "border-[#bbf451]/40 bg-[#bbf451]/[0.07]" : "border-white/10 bg-neutral-800/30"}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] text-white">{i + 1}</span>
                <span className="font-poppins text-[10px] uppercase tracking-[0.16em] text-neutral-500">{["nudge", "specific", "mechanism", "built-in"][i]}</span>
                {shown && <span className="ml-auto font-poppins text-[10px] text-[#8fe3a6]">✓ {t("features.validated")}</span>}
              </div>
              <p className={`font-poppins text-[11px] leading-5 sm:text-sm sm:leading-6 ${shown ? "text-neutral-200" : "select-none text-neutral-600 blur-[3px]"}`}>{h}</p>
            </motion.div>
          );
        })}
      </div>
      {rung === 4 && <p className="font-poppins text-[11px] text-neutral-500 sm:text-xs">{t("features.answerNote")}</p>}
    </div>
  );
}

function PreviewLineMap() {
  const lines = LAST_K_STARTER.split("\n");
  // a PUBLIC example (the statement's own hint input) — never a hidden test
  const steps = [
    { step: 1, i: "–", note: "", total: 0 },
    { step: 2, i: -1, note: "i is -1, so marks[i] counts from the END", total: 0 },
    { step: 3, i: -1, note: "", total: 5 },
    { step: 4, i: 0, note: "", total: 7 },
    { step: 5, i: 1, note: "", total: 12 },
  ];
  return (
    <div className="flex h-[330px] flex-col gap-3 overflow-hidden p-3 sm:h-auto sm:min-h-[640px] sm:gap-5 sm:p-6">
      <p className="font-poppins text-sm font-semibold text-white sm:text-xl">Line Map — “your bug is on line 3”</p>
      <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-950 py-2 font-mono text-[11px] leading-6 sm:text-[13.5px] sm:leading-7">
        {lines.map((l, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={i === 2 ? { backgroundColor: ["rgba(251,146,60,0)", "rgba(251,146,60,0.22)", "rgba(251,146,60,0.16)"] } : {}}
            transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse" }}
            className={`flex gap-3 px-3 ${i === 2 ? "shadow-[inset_2px_0_0_#fb923c]" : ""}`}
          >
            <span className="w-4 shrink-0 text-right text-neutral-600">{i + 1}</span>
            <span className="min-w-0 flex-1 overflow-hidden whitespace-pre text-neutral-200" dangerouslySetInnerHTML={{ __html: highlightLine(l) }} />
            {i === 2 && <span className="hidden shrink-0 rounded bg-[#fb923c]/15 px-2 font-poppins text-[11px] text-[#fdba74] sm:inline">very likely · starts below zero when k &gt; len</span>}
          </motion.div>
        ))}
      </div>
      <p className="font-poppins text-[10px] uppercase tracking-[0.16em] text-neutral-500">Time-travel replay · last_k_total([2, 5], 3) → 12 (the 5 is added twice)</p>
      <div className="flex flex-col gap-1.5 sm:gap-2">
        {steps.map((s, k) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: k * 0.12 }}
            className={`flex items-center gap-3 rounded-md border px-3 py-1.5 font-mono text-[10.5px] sm:text-[12.5px] ${s.note ? "border-[#c64e27]/50 bg-[#c64e27]/10 text-[#ffb59a]" : "border-white/10 bg-neutral-800/30 text-neutral-300"}`}
          >
            <span className="text-neutral-500">step {s.step}</span>
            <span>i = {s.i}</span>
            <span>total = {s.total}</span>
            {s.note && <span className="ml-auto hidden font-poppins sm:inline">← first wrong step: {s.note}</span>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PreviewMastery() {
  const tiles = [
    { title: "Hostile programs contained", v: "15/15" },
    { title: "Outcome labels exact", v: "12/12" },
    { title: "Hidden values leaked", v: "0" },
    { title: "Hints containing code", v: "0" },
    { title: "Recurring mistakes", v: "2" },
    { title: "Next challenge", v: "rotate-left" },
  ];
  const bars = [
    { k: "lists", v: 61 },
    { k: "loops", v: 42 },
    { k: "edges", v: 28 },
    { k: "ifs", v: 70 },
    { k: "strings", v: 50 },
    { k: "sums", v: 55 },
  ];
  return (
    <div className="flex h-[330px] flex-col justify-center gap-3 px-3 sm:h-auto sm:min-h-[640px] sm:gap-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((s) => (
          <div key={s.title} className="min-h-16 rounded-lg border border-white/10 bg-neutral-800/30 p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition duration-200 hover:bg-neutral-800/40 sm:min-h-28 sm:p-5">
            <p className="font-poppins text-[10px] tracking-[0.1em] text-neutral-500 sm:text-sm">{s.title}</p>
            <p className="mt-2 font-poppins text-base font-semibold text-white sm:mt-3 sm:text-2xl">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-white/10 bg-neutral-900 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-2 border-b border-white/10 bg-neutral-800/50 px-4 py-3 sm:px-5 sm:py-4">
          <span className="size-2 rounded-full bg-green-500" />
          <p className="font-poppins text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:text-xs">mastery per concept · riya</p>
        </div>
        <div className="flex h-28 items-end justify-between gap-1.5 p-4 sm:h-[200px] sm:p-5">
          {bars.map((b) => (
            <div key={b.k} className="flex h-full flex-1 flex-col items-center justify-end">
              <motion.div initial={{ height: 0 }} animate={{ height: `${b.v}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="w-full max-w-[40px] rounded-t-[7px] bg-white/85" />
              <span className="mt-1.5 font-poppins text-[10px] text-neutral-500">{b.k}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardPreview() {
  const { t } = useI18n();
  const [active, setActive] = useState("results");
  const items = [
    { id: "results", label: t("hero.sidebar.results"), Icon: ListChecks },
    { id: "hints", label: t("hero.sidebar.hints"), Icon: MessageCircleQuestion },
    { id: "linemap", label: t("hero.sidebar.linemap"), Icon: MapPin },
    { id: "mastery", label: t("hero.sidebar.mastery"), Icon: BarChart2 },
  ];
  return (
    <div className="mx-auto w-full max-w-[410px] overflow-hidden rounded-[22px] border border-white/20 bg-neutral-900 text-left shadow-2xl shadow-black/25 sm:max-w-none sm:rounded-2xl">
      <div className="flex flex-col sm:flex-row">
        <div className="flex w-full shrink-0 flex-row items-center justify-start gap-1 border-b border-neutral-700/40 bg-neutral-900/98 p-2 sm:w-44 sm:flex-col sm:items-stretch sm:border-b-0 sm:border-r sm:p-3">
          <Logo className="hidden h-8 text-white sm:mb-6 sm:block" />
          <nav className="flex flex-row gap-1 sm:flex-col">
            {items.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex size-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg font-poppins text-[10px] font-medium transition-all duration-100 sm:size-auto sm:justify-start sm:px-3 sm:py-2 sm:text-xs ${
                  active === id ? "bg-neutral-700/40 text-white" : "text-neutral-500 hover:bg-neutral-700/30 hover:text-neutral-300"
                }`}
              >
                <Icon className="size-3.5 shrink-0 sm:size-4" />
                <span className="hidden truncate sm:inline">{label}</span>
              </button>
            ))}
          </nav>
          <div className="hidden border-t border-neutral-700/40 pt-3 sm:mt-auto sm:block">
            <div className="flex items-center gap-2 rounded-lg bg-neutral-800/50 px-3 py-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-[#359462] text-[10px] font-bold text-white">R</div>
              <p className="truncate font-poppins text-[11px] text-neutral-400">{t("hero.learner")}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {active === "results" && <PreviewResults />}
          {active === "hints" && <PreviewHints />}
          {active === "linemap" && <PreviewLineMap />}
          {active === "mastery" && <PreviewMastery />}
        </div>
      </div>
    </div>
  );
}
