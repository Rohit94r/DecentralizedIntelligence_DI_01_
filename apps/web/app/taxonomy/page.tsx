"use client";

import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, PageHeading, TagBadge } from "@/components/app/bits";
import { api, type TaxonomyEntry } from "@/lib/api";

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
      title="Mistake taxonomy"
      subtitle="hand-in #3 · one page"
      actions={
        <button onClick={() => window.print()} className="no-print hidden items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3 py-1 text-[12px] font-semibold text-neutral-700 hover:border-neutral-950 sm:inline-flex">
          <Printer className="size-3.5" /> Print
        </button>
      }
    >
      <PageHeading eyebrow="Hand-in #3" title="Mistake taxonomy" accent="& how each is detected" body="Every detector is deterministic — no LLM decides a tag. Each reads only what the learner's own code did and the declared SHAPE of the input; hidden values never leave the comparison. Each has a planted-bug unit test in packages/core/test/unit.ts." />
      <div className="overflow-x-auto rounded-3xl border border-neutral-200/80 bg-white">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Detection rule</th>
              <th className="px-4 py-3">Example bug</th>
              <th className="px-4 py-3">Unit test</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.tag} className="border-b border-neutral-100 align-top last:border-0">
                <td className="px-4 py-3.5">
                  <TagBadge tag={c.tag} />
                  <p className="mt-1.5 text-[12px] font-semibold text-neutral-700">{c.label}</p>
                </td>
                <td className="px-4 py-3.5 leading-5 text-neutral-700">
                  {c.rule}
                  <p className="mt-1 text-[11.5px] text-neutral-400">signals: {c.signals}</p>
                </td>
                <td className="px-4 py-3.5">
                  <code className="block whitespace-pre-wrap rounded-lg bg-neutral-950 px-2.5 py-1.5 font-mono text-[11.5px] text-neutral-100">{c.example}</code>
                  <p className="mt-1 font-mono text-[11px] text-neutral-400">{c.exampleChallenge}</p>
                </td>
                <td className="px-4 py-3.5 font-mono text-[12px] text-[#0570b0]">{c.unitTest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Card tint="orange">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c64e27]">Recurrence</p>
          <p className="mt-2 text-[13px] leading-5 text-[#5b4636]">{rules.recurrence}</p>
        </Card>
        <Card tint="sky">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0586d2]">One tag, kept distinct</p>
          <p className="mt-2 text-[13px] leading-5 text-[#2f4b5f]">{rules.priority}</p>
        </Card>
        <Card tint="green">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#359462]">Next challenge</p>
          <p className="mt-2 text-[13px] leading-5 text-[#33473a]">The next challenge targets the learner&apos;s top recurring tag and states the reason. Nothing recurring → the weakest concept. All strong → the next unseen challenge at their level. The reason is never empty.</p>
        </Card>
      </div>
    </AppShell>
  );
}
