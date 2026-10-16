"use client";

/**
 * "Summarise" — Priya presents an animated, step-by-step walkthrough of the
 * learner's OWN code: the line that runs lights up, lists become rows of
 * boxes, index variables become pointers that slide along them (and fall off
 * the end when the code reads a position that doesn't exist), changed values
 * flash, and every scene is narrated. Built only from public data: the
 * learner's code, the stored result, and a replay on a PUBLIC probe input.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Lock, Pause, Play, RotateCcw, SkipForward, Sparkles, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightLine } from "@/lib/python";
import type { MentorSegment, MentorSession, TraceResult, TraceStep } from "@/lib/api";
import { estimateMs, sleep, type Speaker } from "@/lib/voice";
import { TAG_COLOR } from "@/components/app/bits";

/* ───────────────────────── timeline ───────────────────────── */

interface Frame {
  seg: number;
  traceStep?: number;
}

function buildFrames(segments: MentorSegment[], trace: TraceResult | null): Frame[] {
  const frames: Frame[] = [];
  let last = -1;
  segments.forEach((s, i) => {
    if (s.visual.kind === "trace" && trace?.steps.length) {
      const target = Math.min(Math.max(0, s.visual.step), trace.steps.length - 1);
      const from = s.id === "trace-start" ? target : last + 1;
      let range: number[] = [];
      for (let k = Math.min(from, target); k <= target; k++) range.push(k);
      // long runs are sampled so a scene never drags (the target step is always kept)
      if (range.length > 12) {
        const keep = new Set<number>([range[0], target]);
        for (let j = 1; j < 11; j++) keep.add(range[Math.round((j * (range.length - 1)) / 11)]);
        range = [...keep].sort((a, b) => a - b);
      }
      range.forEach((k) => frames.push({ seg: i, traceStep: k }));
      last = target;
    } else frames.push({ seg: i });
  });
  return frames;
}

/* ───────────────────────── value parsing ───────────────────────── */

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let q: string | null = null;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      cur += ch;
      if (ch === "\\") {
        cur += s[++i] ?? "";
        continue;
      }
      if (ch === q) q = null;
      continue;
    }
    if (ch === "'" || ch === '"') q = ch;
    if ("[({".includes(ch)) depth++;
    if ("])}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

type Seq = { kind: "list" | "str"; items: string[] };

function parseSeq(repr: string | undefined): Seq | null {
  if (!repr) return null;
  const t = repr.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    const items = inner ? splitTop(inner) : [];
    return items.length <= 16 ? { kind: "list", items } : null;
  }
  const m = t.match(/^'([^\n]*)'$/) ?? t.match(/^"([^\n]*)"$/);
  if (m && m[1].length <= 18 && m[1].length > 1 && !m[1].includes("\\")) return { kind: "str", items: [...m[1]] };
  return null;
}

const POINTER = /^(i|j|idx|index|pos|start|end|left|right|lo|hi|mid|l|r|p|q|ptr|cur|slow|fast)$/i;
const ELEMENT = /^(ch|c|char|letter|x|item|m|mark|num|v|val|value|w|word|e|el|elem|d|digit)$/i;

/* ───────────────────────── small pieces ───────────────────────── */

function CodePanel({ code, active, culprit, flagged, spotlight = false, className }: { code: string; active?: number | null; culprit?: number | null; flagged?: boolean; spotlight?: boolean; className?: string }) {
  const lines = code.replace(/\s+$/, "").split(/\r?\n/);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-line="${active ?? culprit}"]`);
    if (el && box.current) {
      const top = el.offsetTop - box.current.clientHeight / 2 + el.clientHeight / 2;
      box.current.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [active, culprit]);
  return (
    <div ref={box} className={cn("lf-editor relative max-h-full overflow-auto rounded-2xl border border-white/[0.08] bg-[#111214] py-3 text-[12.5px] leading-[1.75] sm:text-[13px]", className)}>
      {lines.map((l, i) => {
        const n = i + 1;
        const isActive = active === n;
        const isCulprit = culprit === n;
        return (
          <div
            key={n}
            data-line={n}
            className={cn(
              "relative flex items-start gap-3 pr-4 transition-all duration-300",
              isActive && !flagged && "bg-[#bbf451]/[0.13]",
              isActive && flagged && "bg-[#f28b82]/[0.16]",
              spotlight && !isCulprit && "opacity-30 blur-[0.4px]",
              spotlight && isCulprit && "scale-[1.02] bg-[#fdd663]/[0.12]",
            )}
          >
            <span className={cn("absolute inset-y-0 left-0 w-[3px] rounded-r transition-colors", isActive ? (flagged ? "bg-[#f28b82]" : "bg-[#bbf451]") : spotlight && isCulprit ? "bg-[#fdd663]" : "bg-transparent")} />
            <span className={cn("w-9 shrink-0 select-none text-right tabular-nums", isActive ? "text-[#e8eaed]" : "text-[#5f6368]")}>
              {isCulprit && <span className="mr-1 inline-block size-1.5 -translate-y-px rounded-full bg-[#f28b82]" />}
              {n}
            </span>
            <code className="min-w-0 flex-1 whitespace-pre text-[#e8eaed]" dangerouslySetInnerHTML={{ __html: highlightLine(l) }} />
          </div>
        );
      })}
    </div>
  );
}

function SeqRow({ name, seq, pointers, elementValues, changed }: { name: string; seq: Seq; pointers: { name: string; value: number }[]; elementValues: string[]; changed: boolean }) {
  const n = seq.items.length;
  const cellOf = (v: number) => (v < 0 ? n + v : v);
  const outOfRange = pointers.filter((p) => cellOf(p.value) < 0 || cellOf(p.value) >= n);
  const display = (it: string) => (seq.kind === "str" ? it : it.replace(/^'(.*)'$/, "$1"));
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[12px] font-semibold text-[#8ab4f8]">{name}</span>
        <span className="text-[10.5px] text-[#9aa0a6]">{seq.kind === "str" ? `text · ${n} letter${n === 1 ? "" : "s"}` :`list · ${n} item${n === 1 ? "" : "s"}`}</span>
        {changed && <span className="rounded-full bg-[#fdd663]/15 px-1.5 text-[10px] font-semibold text-[#fdd663]">changed</span>}
      </div>
      <div className="flex flex-wrap items-start gap-1.5">
        {n === 0 && <div className="flex h-10 items-center rounded-lg border border-dashed border-white/20 px-3 font-mono text-[12px] text-[#9aa0a6]">empty</div>}
        <AnimatePresence initial={false}>
          {seq.items.map((it, i) => {
            const here = pointers.filter((p) => cellOf(p.value) === i);
            const isElem = elementValues.includes(display(it)) || elementValues.includes(it);
            return (
              <motion.div key={`${i}`} layout initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 font-mono text-[13px] font-semibold transition-colors duration-300",
                    here.length ? "border-[#8ab4f8] bg-[#8ab4f8]/15 text-white shadow-[0_0_0_3px_rgba(138,180,248,0.15)]" : isElem ? "border-[#bbf451]/70 bg-[#bbf451]/10 text-[#bbf451]" : "border-white/15 bg-white/[0.04] text-[#e8eaed]",
                  )}
                >
                  {display(it) === " " ? "␣" : display(it)}
                </div>
                <span className="mt-1 font-mono text-[9.5px] text-[#5f6368]">{i}</span>
                <div className="flex h-7 flex-col items-center">
                  {here.map((p) => (
                    <motion.div key={p.name} layoutId={`ptr-${name}-${p.name}`} transition={{ type: "spring", stiffness: 380, damping: 30 }} className="flex flex-col items-center">
                      <span className="text-[11px] leading-none text-[#8ab4f8]">▲</span>
                      <span className="rounded bg-[#8ab4f8] px-1 font-mono text-[10px] font-bold leading-[1.35] text-[#202124]">
                        {p.name}
                        {p.value < 0 ? ` = ${p.value}` : ""}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {outOfRange.length > 0 && (
            <motion.div key="oob" layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center">
              <div className="flex h-10 min-w-10 items-center justify-center rounded-lg border-2 border-dashed border-[#f28b82] bg-[#f28b82]/10 px-2 font-mono text-[13px] font-bold text-[#f28b82]">?</div>
              <span className="mt-1 font-mono text-[9.5px] text-[#f28b82]">no item</span>
              <div className="flex h-7 flex-col items-center">
                {outOfRange.map((p) => (
                  <motion.div key={p.name} layoutId={`ptr-${name}-${p.name}`} className="flex flex-col items-center">
                    <span className="text-[11px] leading-none text-[#f28b82]">▲</span>
                    <span className="rounded bg-[#f28b82] px-1 font-mono text-[10px] font-bold leading-[1.35] text-[#202124]">
                      {p.name} = {p.value}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScalarChip({ name, value, changed }: { name: string; value: string; changed: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="font-mono text-[12px] font-semibold text-[#8ab4f8]">{name}</span>
      <span className="text-[#5f6368]">=</span>
      <motion.span
        key={value}
        initial={changed ? { backgroundColor: "rgba(253,214,99,0.45)", scale: 1.15 } : false}
        animate={{ backgroundColor: "rgba(253,214,99,0)", scale: 1 }}
        transition={{ duration: 0.9 }}
        className="rounded-md px-1.5 font-mono text-[13px] font-semibold text-[#e8eaed]"
      >
        {value.length > 34 ? value.slice(0, 34) + "…" : value}
      </motion.span>
    </div>
  );
}

/* ───────────────────────── scenes ───────────────────────── */

function TraceScene({ session, stepIdx }: { session: MentorSession; stepIdx: number }) {
  const trace = session.trace!;
  const step: TraceStep = trace.steps[stepIdx];
  const prev: TraceStep | undefined = trace.steps[stepIdx - 1];
  const culprit = session.line_map?.culprit_line ?? null;
  const flaggedNow = !!step.flag || trace.firstWrongStep === step.step;
  const entries = Object.entries(step.locals);
  const seqs = entries.map(([k, v]) => [k, parseSeq(v)] as const).filter((x): x is readonly [string, Seq] => !!x[1]);
  // A variable is drawn as a pointer only when the code really indexes a list with it (`marks[i]`) —
  // on THAT list. Loop elements (`for ch in text`) are highlighted on the list they come from.
  const code = session.code;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pointersFor = (seqName: string) =>
    entries
      .filter(([k, v]) => POINTER.test(k) && /^-?\d+$/.test(v) && new RegExp(`\\b${esc(seqName)}\\s*\\[\\s*-?\\s*${esc(k)}\\b`).test(code))
      .map(([k, v]) => ({ name: k, value: Number(v) }));
  const elementsFor = (seqName: string) =>
    entries
      .filter(([k, v]) => ELEMENT.test(k) && !parseSeq(v)?.items.length && new RegExp(`\\bfor\\s+${esc(k)}\\s+in\\s+${esc(seqName)}\\b`).test(code))
      .map(([, v]) => v.replace(/^'(.*)'$/, "$1"));
  const scalars = entries.filter(([k]) => !seqs.some(([s]) => s === k));
  const isDone = stepIdx === trace.steps.length - 1;

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-[#9aa0a6]">
          <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[#e8eaed]">{trace.call}</span>
          <span>your code, running on a safe example</span>
        </div>
        <CodePanel code={session.code} active={step.line} culprit={culprit} flagged={flaggedNow} className="min-h-[180px] flex-1" />
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa0a6]">What your variables hold</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10.5px] text-[#e8eaed]">
            step {step.step}/{trace.steps.length} · line {step.line}
          </span>
        </div>
        {entries.length === 0 && <p className="text-[13px] text-[#9aa0a6]">The function is just starting — no variables yet.</p>}
        {seqs.map(([k, s]) => (
          <SeqRow key={k} name={k} seq={s} pointers={pointersFor(k)} elementValues={elementsFor(k)} changed={!!prev && prev.locals[k] !== step.locals[k]} />
        ))}
        {scalars.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {scalars.map(([k, v]) => (
              <ScalarChip key={k} name={k} value={v} changed={!!prev && prev.locals[k] !== v} />
            ))}
          </div>
        )}
        <AnimatePresence mode="wait">
          {flaggedNow && (
            <motion.div key="flag" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2.5 rounded-xl border border-[#f28b82]/40 bg-[#f28b82]/10 px-3.5 py-2.5 text-[13px] text-[#fce8e6]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#f28b82]" />
              <span>{step.note ? step.note : `This is the step where it starts to go wrong (line ${step.line}).`}</span>
            </motion.div>
          )}
          {step.event === "exception" && (
            <motion.div key="exc" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-[#f28b82]/50 bg-[#f28b82]/15 px-3.5 py-2.5 font-mono text-[12.5px] font-semibold text-[#f28b82]">
              💥 {trace.error ?? "error"}
            </motion.div>
          )}
          {isDone && step.event !== "exception" && trace.result !== undefined && (
            <motion.div key="ret" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-[#fdd663]/40 bg-[#fdd663]/10 px-3.5 py-2.5 text-[13px] text-[#fef7e0]">
              ↩ hands back <span className="font-mono font-semibold text-[#fdd663]">{trace.result}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const OUT_STYLE: Record<string, string> = {
  passed: "border-[#81c995]/50 bg-[#81c995]/12 text-[#81c995]",
  wrong_output: "border-[#fdd663]/50 bg-[#fdd663]/12 text-[#fdd663]",
  runtime_error: "border-[#f28b82]/50 bg-[#f28b82]/12 text-[#f28b82]",
  timeout: "border-[#c58af9]/50 bg-[#c58af9]/12 text-[#c58af9]",
};
const OUT_WORD: Record<string, string> = { passed: "pass", wrong_output: "wrong", runtime_error: "crash", timeout: "too slow" };

function TestsScene({ seg }: { seg: Extract<MentorSegment["visual"], { kind: "tests" }> }) {
  const passV = seg.visible.filter((v) => v.outcome === "passed").length;
  const passH = seg.hidden.filter((v) => v.outcome === "passed").length;
  return (
    <div className="grid h-full min-h-0 gap-5 lg:grid-cols-2">
      <div className="min-h-0 overflow-y-auto">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa0a6]">
          Visible tests · <NumberFlow value={passV} />/{seg.visible.length} pass
        </p>
        <div className="space-y-2">
          {seg.visible.map((v, i) => (
            <motion.div key={v.test} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.25 }} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <code className="truncate font-mono text-[12.5px] text-[#e8eaed]">{v.call}</code>
                {v.got !== "—" && <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", OUT_STYLE[v.outcome])}>{OUT_WORD[v.outcome]}</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px]">
                <span className="text-[#9aa0a6]">
                  expected <span className="text-[#81c995]">{v.expected}</span>
                </span>
                {v.got !== "—" && (
                  <span className="text-[#9aa0a6]">
                    got <span className={v.outcome === "passed" ? "text-[#81c995]" : "text-[#fdd663]"}>{v.got}</span>
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="min-h-0">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa0a6]">
          Hidden tests · {seg.hidden.length ? <><NumberFlow value={passH} />/{seg.hidden.length} pass</> : "you haven't submitted yet"}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {(seg.hidden.length ? seg.hidden : Array.from({ length: 6 }, (_, i) => ({ test: i + 1, outcome: null as string | null }))).map((h, i) => (
            <motion.div
              key={h.test}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.22, duration: 0.45 }}
              className={cn("flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border text-center", h.outcome ? OUT_STYLE[h.outcome] : "border-white/10 bg-white/[0.03] text-[#9aa0a6]")}
            >
              <Lock className="size-3.5 opacity-70" />
              <span className="font-mono text-[11px] font-semibold">#{h.test}</span>
              {h.outcome && <span className="text-[10.5px] font-semibold">{OUT_WORD[h.outcome]}</span>}
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-[1.5] text-[#9aa0a6]">🔒 You only ever see pass / fail for hidden tests — never their inputs. That's what trains you to think about edge cases yourself.</p>
      </div>
    </div>
  );
}

function IntroScene({ session, seg }: { session: MentorSession; seg: Extract<MentorSegment["visual"], { kind: "intro" }> }) {
  const badge = seg.status === "solved" ? ["Solved", "bg-[#81c995] text-[#0d2b16]"] : seg.status === "struggling" ? ["Needs a fix", "bg-[#fdd663] text-[#3a2c00]"] : ["Not tried yet", "bg-[#8ab4f8] text-[#0b2147]"];
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(187,244,81,0.12),transparent_55%)]" />
      <motion.img src={session.mentor.avatar} alt="" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }} className="relative size-20 rounded-full object-cover ring-4 ring-[#bbf451]/40 sm:size-24" />
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="relative mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9aa0a6]">
        Mentor summary
      </motion.p>
      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="relative mt-2 text-[2rem] font-medium tracking-[-0.03em] text-white sm:text-[2.6rem]">
        {seg.title}
      </motion.h2>
      <motion.code initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="relative mt-3 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1 font-mono text-[13px] text-[#bbf451]">
        {seg.signature}
      </motion.code>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="relative mt-5 flex items-center gap-3 text-[13px] text-[#e8eaed]">
        <span className={cn("rounded-full px-3 py-1 text-[12px] font-bold", badge[1])}>{badge[0]}</span>
        <span>
          <NumberFlow value={seg.attempts} /> attempt{seg.attempts === 1 ? "" : "s"}
        </span>
      </motion.div>
    </div>
  );
}

function LineMapScene({ session, seg }: { session: MentorSession; seg: Extract<MentorSegment["visual"], { kind: "linemap" }> }) {
  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <CodePanel code={session.code} culprit={seg.line} spotlight className="min-h-[180px]" />
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="flex flex-col justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa0a6]">Line Map</p>
        <p className="mt-2 text-[2.4rem] font-medium leading-none tracking-[-0.04em] text-[#fdd663]">
          Line <NumberFlow value={seg.line} />
        </p>
        <p className="mt-4 rounded-2xl border border-[#fdd663]/30 bg-[#fdd663]/[0.07] p-4 text-[14px] leading-[1.55] text-[#fef7e0]">{seg.reason}</p>
        <p className="mt-3 text-[12px] text-[#9aa0a6]">Found by reading the shape of YOUR code — not by peeking at hidden tests.</p>
      </motion.div>
    </div>
  );
}

function PatternScene({ seg }: { seg: Extract<MentorSegment["visual"], { kind: "pattern" }> }) {
  const color = TAG_COLOR[seg.tag] ?? "#bbf451";
  return (
    <div className="grid h-full min-h-0 items-center gap-6 lg:grid-cols-2">
      <div>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }} className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[12.5px] font-semibold" style={{ color, borderColor: color + "80", backgroundColor: color + "1f" }}>
          <span className="size-2 rounded-full" style={{ backgroundColor: color }} /> {seg.tag}
        </motion.div>
        <motion.h3 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-4 text-[2rem] font-medium leading-[1.05] tracking-[-0.035em] text-white sm:text-[2.4rem]">
          {seg.label}
        </motion.h3>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-3 max-w-md text-[15px] leading-[1.55] text-[#e8eaed]">
          {seg.rule}
        </motion.p>
        {seg.example && (
          <motion.pre initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="lf-editor mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#111214] px-3.5 py-2.5 text-[12px] text-[#e8eaed]">
            <span className="mb-1 block font-sans text-[10px] uppercase tracking-[0.14em] text-[#9aa0a6]">what it usually looks like</span>
            <code dangerouslySetInnerHTML={{ __html: highlightLine(seg.example) }} />
          </motion.pre>
        )}
      </div>
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa0a6]">Where you've hit it</p>
        <div className="relative space-y-3 pl-5">
          <div className="absolute bottom-3 left-[7px] top-3 w-px border-l border-dashed border-white/20" />
          {seg.where.map((w, i) => (
            <motion.div key={w} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.3 }} className="relative flex items-center gap-3">
              <span className="absolute -left-5 size-3.5 rounded-full border-2" style={{ borderColor: color, backgroundColor: "#202124" }} />
              <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[12.5px] text-[#e8eaed]">{w}</span>
            </motion.div>
          ))}
        </div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + seg.where.length * 0.3 }} className={cn("mt-4 inline-flex rounded-full px-3 py-1 text-[12px] font-semibold", seg.where.length >= 2 ? "bg-[#f28b82]/15 text-[#f28b82]" : "bg-white/[0.06] text-[#9aa0a6]")}>
          {seg.where.length >= 2 ? `Recurring — ${seg.where.length} different problems` : "One-off so far — not a habit"}
        </motion.p>
      </div>
    </div>
  );
}

function PlanScene({ seg }: { seg: Extract<MentorSegment["visual"], { kind: "plan" }> }) {
  return (
    <div className="grid h-full min-h-0 items-center gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
      <div>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa0a6]">Your plan — no code, just the path</p>
        <ol className="space-y-2.5">
          {seg.steps.map((s, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.55 }} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 + i * 0.55, type: "spring", stiffness: 300 }} className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#bbf451] text-[11px] font-bold text-[#17152a]">
                {i + 1}
              </motion.span>
              <span className="text-[14px] leading-[1.5] text-[#e8eaed]">{s}</span>
            </motion.li>
          ))}
        </ol>
      </div>
      {seg.next && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + seg.steps.length * 0.55 }} className="rounded-3xl border border-[#bbf451]/30 bg-[#bbf451]/[0.06] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#bbf451]">After this</p>
          <p className="mt-2 text-[1.4rem] font-medium tracking-[-0.03em] text-white">{seg.next.title}</p>
          <p className="mt-2 line-clamp-4 text-[12.5px] leading-[1.5] text-[#9aa0a6]">{seg.next.reason}</p>
          <Link href={`/challenge/${seg.next.challenge_id}`} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#bbf451] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#17152a]">
            Open it <ArrowRight className="size-3.5" />
          </Link>
        </motion.div>
      )}
    </div>
  );
}

/* ───────────────────────── player ───────────────────────── */

export function VisualSummary({
  session,
  speaker,
  lang = "en",
  autoPlay = true,
  onCaption,
  onFinished,
  onExit,
  pauseSignal = 0,
}: {
  pauseSignal?: number;
  session: MentorSession;
  speaker: Speaker;
  lang?: string;
  autoPlay?: boolean;
  onCaption?: (text: string | null) => void;
  onFinished?: () => void;
  onExit?: () => void;
}) {
  const frames = useMemo(() => buildFrames(session.segments, session.trace), [session]);
  const [fi, setFi] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const run = useRef(0);
  const speedRef = useRef(1);
  const cbs = useRef({ onCaption, onFinished });
  useEffect(() => {
    cbs.current = { onCaption, onFinished };
  });
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const frame = frames[Math.min(fi, frames.length - 1)];
  const seg = session.segments[frame?.seg ?? 0];

  const pause = useCallback(() => {
    run.current++;
    speaker.stop();
    setPlaying(false);
  }, [speaker]);

  const playFrom = useCallback(
    async (start: number) => {
      const my = ++run.current;
      setPlaying(true);
      let speech: Promise<void> = Promise.resolve();
      let est = 0;
      for (let f = start; f < frames.length; f++) {
        if (run.current !== my) return;
        setFi(f);
        const fr = frames[f];
        const inSeg = frames.filter((x) => x.seg === fr.seg);
        const pos = inSeg.indexOf(fr);
        if (pos === 0 || f === start) {
          const s = session.segments[fr.seg];
          cbs.current.onCaption?.(s.say);
          est = estimateMs(s.say);
          speech = speaker.speak(s.speech, { lang });
        }
        if (pos < inSeg.length - 1) await sleep(Math.min(1700, Math.max(650, est / inSeg.length)) / speedRef.current);
        else {
          await speech;
          await sleep(500 / speedRef.current);
        }
      }
      if (run.current !== my) return;
      setPlaying(false);
      cbs.current.onFinished?.();
    },
    [frames, session, speaker, lang],
  );

  // the meeting asks us to stop (the learner asked a question, raised a hand…)
  const lastPause = useRef(pauseSignal);
  useEffect(() => {
    if (pauseSignal !== lastPause.current) {
      lastPause.current = pauseSignal;
      run.current++;
      setPlaying(false);
    }
  }, [pauseSignal]);

  // auto-start on mount (re-scheduled correctly if React mounts twice in dev)
  const playRef = useRef(playFrom);
  useEffect(() => {
    playRef.current = playFrom;
  });
  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(() => playRef.current(0), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, []);
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  const goto = (f: number) => {
    pause();
    const n = Math.max(0, Math.min(frames.length - 1, f));
    setFi(n);
    cbs.current.onCaption?.(session.segments[frames[n].seg].say);
  };
  const segStart = (segIdx: number) => frames.findIndex((x) => x.seg === segIdx);
  const toggle = () => (playing ? pause() : playFrom(fi >= frames.length - 1 ? 0 : fi));

  // keyboard: space / arrows (like the DSA visualiser)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") goto(fi + 1);
      else if (e.key === "ArrowLeft") goto(fi - 1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  if (!frame || !seg) return null;
  const v = seg.visual;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#18191c] text-[#e8eaed]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#bbf451] text-[#17152a]">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-white">
            {session.challenge.title} <span className="font-normal text-[#9aa0a6]">· visual summary</span>
          </p>
          <p className="truncate text-[11px] text-[#9aa0a6]">
            Scene {frame.seg + 1} of {session.segments.length} — {seg.title}
          </p>
        </div>
        <span className="hidden rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] tabular-nums text-[#e8eaed] sm:inline">
          Step {fi + 1} / {frames.length}
        </span>
        {onExit && (
          <button onClick={onExit} className="flex items-center gap-1.5 rounded-full bg-[#8ab4f8] px-3 py-1.5 text-[12px] font-semibold text-[#202124] hover:bg-[#aecbfa]">
            <X className="size-3.5" /> Stop presenting
          </button>
        )}
      </div>

      {/* stage */}
      <div className="relative min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={v.kind === "trace" ? "trace" : seg.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="h-full min-h-0"
          >
            {v.kind === "intro" && <IntroScene session={session} seg={v} />}
            {v.kind === "tests" && <TestsScene seg={v} />}
            {v.kind === "trace" && session.trace && <TraceScene session={session} stepIdx={frame.traceStep ?? v.step} />}
            {v.kind === "linemap" && <LineMapScene session={session} seg={v} />}
            {v.kind === "pattern" && <PatternScene seg={v} />}
            {v.kind === "plan" && <PlanScene seg={v} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* narration */}
      <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/30 px-3.5 py-3 sm:mx-5">
        <div className="relative shrink-0">
          <img src={session.mentor.avatar} alt="" className={cn("size-8 rounded-full object-cover transition-shadow", speaker.speaking && "ring-2 ring-[#8ab4f8] ring-offset-2 ring-offset-[#18191c]")} />
          {speaker.speaking && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-[#8ab4f8]" />}
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={seg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0 flex-1 text-[13.5px] leading-[1.55] text-[#e8eaed]">
            <span className="mr-1.5 font-semibold text-white">{session.mentor.name}:</span>
            {seg.say}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3 sm:gap-3 sm:px-5">
        <div className="flex items-center gap-1">
          <CtlButton label="Restart" onClick={() => playFrom(0)}>
            <RotateCcw className="size-4" />
          </CtlButton>
          <CtlButton label="Previous step" onClick={() => goto(fi - 1)} disabled={fi === 0}>
            <ChevronLeft className="size-4" />
          </CtlButton>
          <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex size-10 items-center justify-center rounded-full bg-[#bbf451] text-[#17152a] transition-transform hover:scale-105 active:scale-95">
            {playing ? <Pause className="size-4.5" /> : <Play className="size-4.5 translate-x-px" />}
          </button>
          <CtlButton label="Next step" onClick={() => goto(fi + 1)} disabled={fi >= frames.length - 1}>
            <ChevronRight className="size-4" />
          </CtlButton>
          <CtlButton label="Next scene" onClick={() => goto(segStart(Math.min(session.segments.length - 1, frame.seg + 1)))} disabled={frame.seg >= session.segments.length - 1}>
            <SkipForward className="size-4" />
          </CtlButton>
        </div>
        {/* segmented progress — one block per scene, click to jump */}
        <div className="flex min-w-[140px] flex-1 items-center gap-1">
          {session.segments.map((s, i) => {
            const fs = frames.filter((x) => x.seg === i);
            const first = segStart(i);
            const done = fi > first + fs.length - 1;
            const cur = frame.seg === i;
            const pct = cur ? ((fi - first + 1) / fs.length) * 100 : done ? 100 : 0;
            return (
              <button key={s.id} title={s.title} onClick={() => goto(first)} className="group relative h-6 flex-1">
                <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
                  <motion.span className="block h-full rounded-full bg-[#bbf451]" animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
                </span>
              </button>
            );
          })}
        </div>
        <button onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 0.75 : 1))} className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] text-[#e8eaed] hover:bg-white/[0.06]">
          {speed}×
        </button>
        {fi >= frames.length - 1 && !playing && (
          <span className="flex items-center gap-1 text-[12px] font-semibold text-[#81c995]">
            <CircleCheck className="size-4" /> Summary complete
          </span>
        )}
      </div>
    </div>
  );
}

function CtlButton({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="flex size-9 items-center justify-center rounded-full text-[#e8eaed] transition-colors hover:bg-white/[0.08] disabled:opacity-30">
      {children}
    </button>
  );
}

