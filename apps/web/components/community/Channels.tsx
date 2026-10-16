"use client";

/**
 * Where to look: channels (post kinds), smart filters and the problem filter.
 * A sticky left rail on wide screens; a horizontally scrolling chip row on
 * everything smaller.
 */
import React from "react";
import { BookOpen, ChevronDown, CircleCheck, CircleDashed, LayoutGrid, UserRound, X } from "lucide-react";
import type { PostKind } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RailLabel } from "./bits";
import { FOCUS, KINDS, type Smart } from "./meta";

export interface Counts {
  all: number;
  kinds: Record<PostKind, number>;
  smart: Record<Exclude<Smart, "">, number>;
}

export interface ChannelProps {
  kind: "" | PostKind;
  setKind: (k: "" | PostKind) => void;
  smart: Smart;
  setSmart: (s: Smart) => void;
  problem: string;
  setProblem: (id: string) => void;
  counts: Counts | null;
  challenges: { id: string; title: string }[];
  hotProblems: { id: string; title: string; count: number }[];
}

const SMART: { id: Exclude<Smart, "">; label: string; Icon: typeof CircleCheck; tone: string }[] = [
  { id: "unanswered", label: "Unanswered", Icon: CircleDashed, tone: "text-[#c64e27] dark:text-[#ff9b77]" },
  { id: "solved", label: "Solved", Icon: CircleCheck, tone: "text-[#2f7c53] dark:text-[#8fe3a6]" },
  { id: "mine", label: "My posts", Icon: UserRound, tone: "text-neutral-500" },
];

function Count({ n }: { n: number | undefined }) {
  return <span className="ml-auto pl-2 text-[11.5px] font-medium tabular-nums text-neutral-400">{n ?? ""}</span>;
}

function RailItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-[7px] text-left text-[13px] font-semibold tracking-[-0.01em] transition-colors",
        FOCUS,
        active ? "border-neutral-200/80 bg-white text-neutral-950 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" : "border-transparent text-neutral-600 hover:bg-white hover:text-neutral-950",
      )}
    >
      {children}
    </button>
  );
}

function ProblemSelect({ problem, setProblem, challenges, className }: { problem: string; setProblem: (id: string) => void; challenges: { id: string; title: string }[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <BookOpen className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
      <select
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        aria-label="Filter by problem"
        className={cn(
          "h-9 w-full appearance-none rounded-full border bg-white pl-8 pr-8 text-[12.5px] font-semibold outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[#359462]/50",
          problem ? "border-neutral-950 text-neutral-950" : "border-neutral-200 text-neutral-600",
        )}
      >
        <option value="">Every problem</option>
        {challenges.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

export function ChannelRail({ kind, setKind, smart, setSmart, problem, setProblem, counts, challenges, hotProblems }: ChannelProps) {
  return (
    <nav aria-label="Community channels" className="space-y-6">
      <div>
        <RailLabel className="mb-2 px-2.5">Channels</RailLabel>
        <div className="space-y-0.5">
          <RailItem active={!kind} onClick={() => setKind("")}>
            <span className="flex size-6 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
              <LayoutGrid className="size-3.5" />
            </span>
            All posts
            <Count n={counts?.all} />
          </RailItem>
          {KINDS.map((k) => (
            <RailItem key={k.kind} active={kind === k.kind} onClick={() => setKind(k.kind)}>
              <span className={cn("flex size-6 items-center justify-center rounded-lg", k.chip)}>
                <k.Icon className="size-3.5" strokeWidth={2.3} />
              </span>
              {k.plural}
              <Count n={counts?.kinds[k.kind]} />
            </RailItem>
          ))}
        </div>
      </div>

      <div>
        <RailLabel className="mb-2 px-2.5">Filters</RailLabel>
        <div className="space-y-0.5">
          {SMART.map((s) => (
            <RailItem key={s.id} active={smart === s.id} onClick={() => setSmart(smart === s.id ? "" : s.id)}>
              <span className="flex size-6 items-center justify-center">
                <s.Icon className={cn("size-4", s.tone)} />
              </span>
              {s.label}
              <Count n={counts?.smart[s.id]} />
            </RailItem>
          ))}
        </div>
      </div>

      <div>
        <RailLabel className="mb-2 px-2.5">Problem</RailLabel>
        <ProblemSelect problem={problem} setProblem={setProblem} challenges={challenges} />
        {hotProblems.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {hotProblems.map((h) => (
              <RailItem key={h.id} active={problem === h.id} onClick={() => setProblem(problem === h.id ? "" : h.id)}>
                <span className="min-w-0 truncate pl-1 text-[12.5px] font-medium">{h.title}</span>
                <Count n={h.count} />
              </RailItem>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors",
        FOCUS,
        active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}

export function ChannelChips({ kind, setKind, smart, setSmart, problem, setProblem, counts, challenges }: ChannelProps) {
  const n = (x: number | undefined) => (x === undefined ? null : <span className="tabular-nums opacity-60">{x}</span>);
  return (
    <nav aria-label="Community channels" className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] sm:-mx-6 sm:px-6 @min-[50rem]/board:mx-0 @min-[50rem]/board:px-0">
      <Chip active={!kind} onClick={() => setKind("")}>
        All {n(counts?.all)}
      </Chip>
      {KINDS.map((k) => (
        <Chip key={k.kind} active={kind === k.kind} onClick={() => setKind(k.kind)}>
          <k.Icon className="size-3.5" style={kind === k.kind ? undefined : { color: k.accent }} strokeWidth={2.3} />
          {k.plural} {n(counts?.kinds[k.kind])}
        </Chip>
      ))}
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-neutral-200" />
      {SMART.map((s) => (
        <Chip key={s.id} active={smart === s.id} onClick={() => setSmart(smart === s.id ? "" : s.id)}>
          <s.Icon className={cn("size-3.5", smart === s.id ? "" : s.tone)} />
          {s.label} {n(counts?.smart[s.id])}
        </Chip>
      ))}
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-neutral-200" />
      <ProblemSelect problem={problem} setProblem={setProblem} challenges={challenges} className="w-44 shrink-0" />
      {problem && (
        <Chip active={false} onClick={() => setProblem("")} label="Clear the problem filter">
          <X className="size-3.5" />
        </Chip>
      )}
    </nav>
  );
}
