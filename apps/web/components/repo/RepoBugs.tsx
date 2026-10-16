"use client";

/**
 * Repo Analyse · Bugs to fix — code-level bugs found by readable, line-based
 * rules: the exact line (linked to GitHub), a snippet with the bug line lit
 * up, why it's a bug, how to fix it, and a place to practise the same bug.
 * Snippets never contain a line that looks like a secret (the server hides it).
 */
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen, Bug, ChevronDown, CircleCheck, ExternalLink, FileCode, Filter, Sparkles } from "lucide-react";
import { Card } from "@/components/app/bits";
import type { BugCategory, RepoBug, RepoReport, Severity } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Label, SEV, githubUrl } from "./bits";

const CATEGORY: Record<BugCategory, string> = {
  logic: "Logic",
  security: "Security",
  crash: "Crash",
  async: "Async",
  performance: "Performance",
  data: "Data",
};

function Snippet({ b }: { b: RepoBug }) {
  return (
    <div className="no-scrollbar overflow-x-auto rounded-xl bg-[#111318] py-2 font-mono text-[12px] leading-[20px]">
      <div className="min-w-max">
        {b.snippet.lines.map((l, i) => {
          const n = b.snippet.start + i;
          const hit = n === b.line;
          return (
            <div key={n} className={cn("flex pr-4", hit && "culprit-line")}>
              <span className={cn("w-12 shrink-0 select-none pr-3 text-right tabular-nums", hit ? "font-semibold text-[#fdba74]" : "text-[#5b616b]")}>{n}</span>
              <span className={cn("whitespace-pre", hit ? "text-[#f5f5f5]" : "text-[#c3c7cd]", /^… \(line hidden/.test(l) && "italic text-[#90959e]")}>{l || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BugCard({ b, report, open, onToggle, onAsk }: { b: RepoBug; report: RepoReport; open: boolean; onToggle: () => void; onAsk: (q: string) => void }) {
  const s = SEV[b.severity];
  const href = githubUrl(report, b.file, b.line);
  const where = `${b.file}:${b.line}`;
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <s.Icon className="mt-0.5 size-4 shrink-0" style={{ color: s.dot }} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-[1.35] tracking-[-0.01em] text-neutral-950">{b.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-bold", s.chip)}>{s.bug}</span>
            {b.confidence === "likely" ? (
              <span className="rounded-full bg-neutral-950 px-2 py-px text-[10.5px] font-bold text-white">Likely bug</span>
            ) : (
              <span className="rounded-full border border-dashed border-neutral-300 px-2 py-px text-[10.5px] font-semibold text-neutral-600">Possible — check it</span>
            )}
            <span className="rounded-full bg-neutral-100 px-2 py-px text-[10.5px] font-semibold text-neutral-600">{CATEGORY[b.category]}</span>
            <code className="min-w-0 max-w-full truncate rounded-md bg-neutral-100 px-1.5 py-px font-mono text-[11px] text-neutral-600">{where}</code>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-neutral-100 px-4 py-3.5 text-[13px] leading-[1.55]">
              <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
                <FileCode className="size-3.5 shrink-0 text-neutral-400" />
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 font-mono font-semibold text-neutral-800 hover:underline">
                    <span className="truncate">{where}</span>
                    <ExternalLink className="size-3 shrink-0 text-neutral-400" />
                  </a>
                ) : (
                  <code className="truncate font-mono font-semibold text-neutral-800">{where}</code>
                )}
              </div>
              <Snippet b={b} />
              <div>
                <Label>Why it's a bug</Label>
                <p className="mt-0.5 text-neutral-700">{b.why}</p>
              </div>
              <div>
                <Label>How to fix it</Label>
                <p className="mt-0.5 text-neutral-800">{b.fix}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => onAsk(`Explain the bug "${b.title}" in ${where} — why is it a problem and how do I fix it?`)}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3 py-1 text-[11.5px] font-semibold text-white"
                >
                  <Sparkles className="size-3" /> Ask Priya about this bug
                </button>
                {b.practice && (
                  <Link href={b.practice.href} className="inline-flex items-center gap-1 rounded-full border border-[#cfe9c8] bg-[#eeffe8] px-3 py-1 text-[11.5px] font-semibold text-[#2f7c53] hover:border-[#359462]">
                    {b.practice.label} <ArrowRight className="size-3" />
                  </Link>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f2eeff] px-2.5 py-0.5 text-[11px] font-semibold text-[#5e2ac4]">
                  <BookOpen className="size-3" /> Learn: {b.learn}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn("shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold", active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400")}
    >
      {children}
    </button>
  );
}

export function RepoBugs({ report, onAsk }: { report: RepoReport; onAsk: (q: string) => void }) {
  const bugs = useMemo(() => report.bugs ?? [], [report.bugs]);
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [likelyOnly, setLikelyOnly] = useState(false);
  const [cat, setCat] = useState<"all" | BugCategory>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(bugs.slice(0, 2).map((b) => b.id)));

  const count = (f: (b: RepoBug) => boolean) => bugs.filter(f).length;
  const cats = useMemo(() => [...new Set(bugs.map((b) => b.category))], [bugs]);
  const shown = bugs.filter((b) => (sev === "all" || b.severity === sev) && (!likelyOnly || b.confidence === "likely") && (cat === "all" || b.category === cat));

  if (!bugs.length)
    return (
      <Card tint="green" className="text-center">
        <CircleCheck className="mx-auto size-8 text-[#359462]" />
        <p className="mt-3 text-[17px] font-semibold tracking-[-0.01em] text-neutral-950">No likely bugs in the code we read</p>
        <p className="mx-auto mt-1.5 max-w-lg text-[13px] leading-[1.55] text-neutral-600">
          We checked {report.metrics.sampled_files} files line by line for common beginner bugs — off-by-one loops, async mistakes, unsafe HTML, plain-text passwords, crashes on empty input and more — and nothing stood out. Nice work.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/bug-factory" className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3.5 py-1.5 text-[12px] font-semibold text-white">
            Practise spotting bugs <ArrowRight className="size-3.5" />
          </Link>
          <button onClick={() => onAsk("What kinds of bugs should I watch out for in a project like this?")} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-neutral-700 hover:border-neutral-950">
            <Sparkles className="size-3.5" /> Ask Priya what to watch for
          </button>
        </div>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#fdeee8] text-[#c64e27]">
              <Bug className="size-6" />
            </span>
            <div>
              <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-neutral-950">{bugs.length}</p>
              <p className="mt-1 text-[12px] text-neutral-500">bug{bugs.length === 1 ? "" : "s"} to look at</p>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2 sm:max-w-md">
            {(["high", "medium", "low"] as Severity[]).map((k) => (
              <div key={k} className="rounded-2xl bg-neutral-50 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[17px] font-semibold tabular-nums text-neutral-950">
                  <span className="size-2 rounded-full" style={{ backgroundColor: SEV[k].dot }} />
                  {count((b) => b.severity === k)}
                </p>
                <p className="text-[10.5px] text-neutral-500">{SEV[k].bug.toLowerCase()}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-[12px] leading-[1.55] text-neutral-500">
          Found by reading {report.metrics.sampled_files} files line by line with simple rules — no guessing. <b className="font-semibold text-neutral-700">Likely</b> ({count((b) => b.confidence === "likely")}) means the pattern is almost always a bug;{" "}
          <b className="font-semibold text-neutral-700">possible</b> ({count((b) => b.confidence === "possible")}) means check whether it can really happen in your app. Each item is one rule in one file — other lines with the same problem are listed inside.
        </p>
      </Card>

      <div className="space-y-2">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Filter className="size-3.5 shrink-0 text-neutral-400" />
          <Chip active={sev === "all"} onClick={() => setSev("all")}>
            All · {bugs.length}
          </Chip>
          {(["high", "medium", "low"] as Severity[])
            .filter((k) => count((b) => b.severity === k))
            .map((k) => (
              <Chip key={k} active={sev === k} onClick={() => setSev(k)}>
                {SEV[k].bug} · {count((b) => b.severity === k)}
              </Chip>
            ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-neutral-200" />
          <Chip active={likelyOnly} onClick={() => setLikelyOnly((v) => !v)}>
            Likely only
          </Chip>
        </div>
        {cats.length > 1 && (
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 pl-5">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>
              Every kind
            </Chip>
            {cats.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                {CATEGORY[c]} · {count((b) => b.category === c)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {shown.map((b) => (
          <BugCard
            key={b.id}
            b={b}
            report={report}
            open={openIds.has(b.id)}
            onToggle={() =>
              setOpenIds((s) => {
                const n = new Set(s);
                if (n.has(b.id)) n.delete(b.id);
                else n.add(b.id);
                return n;
              })
            }
            onAsk={onAsk}
          />
        ))}
        {shown.length === 0 && <Card className="text-[13px] text-neutral-500">No bugs match these filters.</Card>}
      </div>
    </div>
  );
}
