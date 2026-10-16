"use client";

/**
 * Mistake types — one flip card per mistake Layerflow can spot. The front says
 * what it means in plain words with a real example; flip it to see exactly how
 * it's detected and which unit test plants it.
 */
import React, { useEffect, useState } from "react";
import { Printer, RotateCw } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { api, type TaxonomyEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

/** What each mistake means, in one plain sentence. */
const MEANS: Record<string, string> = {
  unhandled_short_input: "The code breaks when the input is shorter than expected — an empty list, one item, or k bigger than the list.",
  print_not_return: "The function prints the answer instead of returning it, so whoever called it gets nothing back.",
  mutates_input: "The function changes the list it was given, so the caller's data is different afterwards.",
  off_by_one: "A loop or range goes one step too far, or stops one step too early.",
  boundary_comparison: "The check is right everywhere except exactly on the cut-off value — like > where it should be >=.",
  wrong_index_direction: "Counting from the wrong end of a list — the start instead of the end, or the other way round.",
};

function FlipCard({ c }: { c: TaxonomyEntry }) {
  const [flipped, setFlipped] = useState(false);
  const face = "absolute inset-0 flex flex-col rounded-3xl border bg-white p-5 [backface-visibility:hidden]";
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={`${c.label} — ${flipped ? "show the meaning" : "show how it's detected"}`}
      className="group h-[300px] w-full text-left [perspective:1200px] focus-visible:outline-none"
    >
      <div className="relative h-full w-full transition-transform duration-500 ease-out [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : undefined }}>
        {/* front */}
        <div className={cn(face, "border-neutral-200/80 group-focus-visible:ring-2 group-focus-visible:ring-[#359462]")} style={{ borderTop: `4px solid ${c.color}` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold" style={{ color: c.color }}>
              {c.tag}
            </span>
            {c.optional && <span className="rounded-full bg-neutral-100 px-2 py-px text-[10px] font-semibold text-neutral-500">optional</span>}
          </div>
          <p className="mt-2 text-[19px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">{c.label}</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-neutral-600">{MEANS[c.tag] ?? c.rule}</p>
          <div className="mt-auto">
            <p className="mb-1 text-[11px] font-medium text-neutral-400">Example</p>
            <code className="line-clamp-2 block whitespace-pre-wrap break-words rounded-lg bg-neutral-950 px-3 py-2 font-mono text-[12px] leading-[1.5] text-neutral-100">{c.example}</code>
            <p className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-neutral-400 group-hover:text-neutral-700">
              <RotateCw className="size-3" /> Tap to see how it's detected
            </p>
          </div>
        </div>
        {/* back */}
        <div className={cn(face, "border-neutral-900 bg-neutral-950 text-neutral-100 [transform:rotateY(180deg)]")}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: c.color }}>
            How it's detected
          </p>
          <p className="mt-2 text-[13px] leading-[1.55] text-neutral-200">{c.rule}</p>
          <p className="mt-3 text-[12px] leading-[1.5] text-neutral-400">
            <span className="text-neutral-300">Signals:</span> {c.signals}
          </p>
          <div className="mt-auto space-y-1 border-t border-white/10 pt-3 text-[11.5px] text-neutral-400">
            <p>
              Example problem: <span className="font-mono text-neutral-200">{c.exampleChallenge}</span>
            </p>
            <p className="truncate">
              Unit test: <span className="font-mono text-[#7dd3fc]">{c.unitTest}</span>
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function TaxonomyPage() {
  const [cats, setCats] = useState<TaxonomyEntry[]>([]);
  const [rules, setRules] = useState({ recurrence: "", priority: "" });
  useEffect(() => {
    api
      .taxonomy()
      .then((t) => {
        setCats(t.categories);
        setRules({ recurrence: t.recurrence_rule, priority: t.priority_rule });
      })
      .catch(() => {});
  }, []);
  return (
    <AppShell
      title="Mistake types"
      subtitle="the taxonomy · hand-in #3"
      actions={
        <button onClick={() => window.print()} className="no-print hidden items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3 py-1 text-[12px] font-semibold text-neutral-700 hover:border-neutral-950 sm:inline-flex">
          <Printer className="size-3.5" /> Print
        </button>
      }
    >
      <PageHeading title="Mistake types" body="Every mistake Layerflow can spot, in plain words. Tap a card to flip it and see exactly how it's detected. No AI decides a tag — each one is a simple, testable rule." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {cats.length ? cats.map((c) => <FlipCard key={c.tag} c={c} />) : [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[300px] animate-pulse rounded-3xl bg-neutral-100" />)}
      </div>
      {/* the printed hand-in shows both sides of every card */}
      <div className="hidden space-y-3 print:block">
        {cats.map((c) => (
          <div key={c.tag} className="break-inside-avoid border-b border-neutral-200 pb-3 text-[12px]">
            <p className="font-semibold">
              {c.label} <span className="font-mono text-neutral-500">({c.tag})</span>
            </p>
            <p>{MEANS[c.tag]}</p>
            <p>
              <b>Detected by:</b> {c.rule} <i>Signals: {c.signals}</i>
            </p>
            <p className="font-mono">
              {c.example} · {c.exampleChallenge} · {c.unitTest}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <SectionLabel>When is it a pattern?</SectionLabel>
          <p className="mt-2 text-[13px] leading-[1.55] text-neutral-700">{rules.recurrence}</p>
        </Card>
        <Card>
          <SectionLabel>One tag per submission</SectionLabel>
          <p className="mt-2 text-[13px] leading-[1.55] text-neutral-700">{rules.priority}</p>
        </Card>
        <Card>
          <SectionLabel>What you practise next</SectionLabel>
          <p className="mt-2 text-[13px] leading-[1.55] text-neutral-700">The next problem targets your most repeated mistake and says why. Nothing repeated → your weakest skill. All strong → the next new problem at your level.</p>
        </Card>
      </div>
    </AppShell>
  );
}
