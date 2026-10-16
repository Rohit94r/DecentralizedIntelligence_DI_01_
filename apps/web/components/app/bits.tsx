"use client";

/** Small shared pieces for the app pages: outcome chips, tag badges, mastery bars, cards. */
import React from "react";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";
import { OUTCOME_LABEL, type Outcome } from "@/lib/api";

export const TAG_COLOR: Record<string, string> = {
  unhandled_short_input: "#c64e27",
  print_not_return: "#0586d2",
  mutates_input: "#7B35F0",
  off_by_one: "#359462",
  boundary_comparison: "#f59e0b",
  wrong_index_direction: "#ec4899",
};

export const LEVEL_STYLE: Record<string, string> = {
  easy: "bg-[#eeffe8] text-[#2f7c53] border-[#cfe9c8]",
  medium: "bg-[#fff6e3] text-[#96681c] border-[#fde1a8]",
  hard: "bg-[#f2eeff] text-[#5e2ac4] border-[#ddd0ff]",
};

export function OutcomeChip({ outcome, className, short = false }: { outcome: Outcome; className?: string; short?: boolean }) {
  return (
    <span className={cn(`out-${outcome} inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold`, className)}>
      {short ? OUTCOME_LABEL[outcome] : outcome}
    </span>
  );
}

export function TagBadge({ tag, className }: { tag: string; className?: string }) {
  const color = TAG_COLOR[tag] ?? "#737373";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold", className)} style={{ color, borderColor: color + "55", backgroundColor: color + "12" }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {tag}
    </span>
  );
}

export function MasteryBar({ label, value, delta, color = "#359462" }: { label: string; value: number; delta?: number; color?: string }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-neutral-800">{label}</span>
        <span className="flex items-baseline gap-1.5 text-[12px] tabular-nums">
          {delta !== undefined && Math.abs(delta) >= 0.01 && (
            <span className={delta > 0 ? "font-semibold text-[#2f7c53]" : "font-semibold text-[#a8401f]"}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100))}
            </span>
          )}
          <span className="font-semibold text-neutral-900">
            <NumberFlow value={pct} />%
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  );
}

export function Card({ children, className, tint }: { children: React.ReactNode; className?: string; tint?: "green" | "purple" | "orange" | "sky" | "amber" }) {
  const tints = {
    green: "lf-tint-green border-[#cfe9c8]/80 bg-[#eeffe8]",
    purple: "lf-tint-purple border-[#ddd0ff]/70 bg-[#f2eeff]",
    orange: "lf-tint-orange border-[#f0d9b8]/70 bg-[#fff2df]",
    sky: "lf-tint-sky border-sky-200/60 bg-sky-50",
    amber: "lf-tint-amber border-[#fde1a8]/80 bg-[#fff6e3]",
  };
  return <div className={cn("rounded-3xl border p-5 sm:p-6", tint ? tints[tint] : "border-neutral-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)]", className)}>{children}</div>;
}

export function PageHeading({ eyebrow, title, accent, body }: { eyebrow?: string; title: string; accent?: string; body?: string }) {
  return (
    <div className="mb-7">
      {eyebrow && <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{eyebrow}</p>}
      <h1 className="text-[2rem] font-medium leading-[1.05] tracking-[-0.04em] sm:text-[2.6rem] sm:tracking-[-0.045em]">
        <span className="text-[#17152A] dark:text-neutral-50">{title}</span>
        {accent && <span className="text-[#359462]"> {accent}</span>}
      </h1>
      {body && <p className="mt-3 max-w-2xl text-[14px] font-medium leading-[1.55] tracking-[-0.02em] text-[#6D6878] dark:text-neutral-400 sm:text-[15px]">{body}</p>}
    </div>
  );
}

/** Hint/explanation text: `backticked` names render as small code chips (the text itself is prose-only). */
export function Prose({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code key={i} className="rounded-md bg-neutral-100 px-1.5 py-px font-mono text-[0.9em] text-[#0570b0]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}
