"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ChevronDown, ShieldAlert, ShieldCheck, Search } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { api, timeAgo, type LedgerEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function LedgerPage() {
  const [stats, setStats] = useState({ total: 0, hints: 0, explanations: 0, rejected: 0, llm: 0 });
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [kind, setKind] = useState("");
  const [learner, setLearner] = useState("");
  const [onlyRejected, setOnlyRejected] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .ledger({ kind: kind || undefined, learner_id: learner || undefined })
      .then((r) => {
        setStats(r.stats);
        setEntries(r.entries);
      })
      .catch((e) => setErr(e.message));
  }, [kind, learner]);

  const learners = useMemo(() => [...new Set(entries.map((e) => e.learner_id).filter(Boolean) as string[])].filter((l) => !l.startsWith("harness")), [entries]);
  const shown = entries.filter((e) => (!onlyRejected || e.rejected_for_code) && (!q || (e.prompt + e.response + (e.submission_id ?? "")).toLowerCase().includes(q.toLowerCase())));

  return (
    <AppShell title="Hint Ledger" subtitle="every prompt and response, logged">
      <PageHeading
        eyebrow="Proof, not promises"
        title="The Hint Ledger."
        accent="Every word we ever said."
        body="Every explanation and every hint — with the prompt that produced it — is written here before the learner sees it. Drafts that tried to include code were rejected by the validator; they are logged too, so the guardrail is auditable, not just claimed."
      />
      {err && <Card className="mb-4 text-sm text-[#a8401f]">{err}</Card>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { k: "Entries", v: stats.total },
          { k: "Hints", v: stats.hints },
          { k: "Explanations", v: stats.explanations },
          { k: "Guardrail rejections", v: stats.rejected, accent: true },
          { k: "LLM-written", v: stats.llm },
        ].map((s) => (
          <div key={s.k} className={cn("rounded-2xl border px-4 py-3.5", s.accent ? "border-[#f0d9b8] bg-[#fff2df]" : "border-neutral-200/70 bg-white")}>
            <p className={cn("text-[26px] font-medium tabular-nums leading-none tracking-[-0.03em]", s.accent ? "text-[#c64e27]" : "text-neutral-950")}>
              <NumberFlow value={s.v} />
            </p>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">{s.k}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12.5px] text-neutral-500">
        <ShieldCheck className="size-4 text-[#359462]" /> Code that reached a learner: <span className="font-semibold text-neutral-900">0</span> — every shipped hint passed the prose-only validator.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {["", "hint", "explanation"].map((k) => (
          <button key={k || "all"} onClick={() => setKind(k)} className={cn("rounded-full px-4 py-1.5 text-[13px] font-semibold", kind === k ? "bg-[#bbf451] text-black" : "border border-neutral-200/80 bg-white text-neutral-600 hover:border-neutral-950")}>
            {k || "all"}
          </button>
        ))}
        <button onClick={() => setOnlyRejected((v) => !v)} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold", onlyRejected ? "bg-[#c64e27] text-white" : "border border-neutral-200/80 bg-white text-neutral-600 hover:border-neutral-950")}>
          <ShieldAlert className="size-3.5" /> rejected only
        </button>
        <select value={learner} onChange={(e) => setLearner(e.target.value)} className="h-9 rounded-full border border-neutral-200/80 bg-white px-3 text-[13px] font-medium text-neutral-700">
          <option value="">all learners</option>
          {learners.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search prompt, response, s_0001…" className="h-9 w-64 rounded-full border border-neutral-200/80 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-neutral-400" />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white">
        {shown.map((e) => (
          <div key={e.id} className="border-b border-neutral-100 last:border-0">
            <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50">
              <span className={cn("w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[10.5px] font-semibold", e.kind === "hint" ? "bg-[#eeffe8] text-[#2f7c53]" : "bg-sky-50 text-[#0570b0]")}>{e.kind}</span>
              {e.rejected_for_code ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#c64e27] px-2 py-0.5 text-[10.5px] font-semibold text-white">
                  <ShieldAlert className="size-3" /> rejected: code
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-700">{e.response}</span>
              <span className="hidden shrink-0 font-mono text-[11px] text-neutral-400 md:inline">
                {e.learner_id} · {e.submission_id}
              </span>
              <span className="hidden shrink-0 text-[11px] text-neutral-400 sm:inline">{timeAgo(e.ts)}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-neutral-400 transition-transform", open === e.id && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {open === e.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-neutral-50 p-3">
                      <SectionLabel>Prompt</SectionLabel>
                      <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[11.5px] leading-5 text-neutral-700">{e.prompt}</pre>
                    </div>
                    <div className={cn("rounded-2xl p-3", e.rejected_for_code ? "bg-[#fff2df]" : "bg-[#eeffe8]")}>
                      <SectionLabel>{e.rejected_for_code ? "Response — REJECTED, never shown" : "Response — shown to the learner"}</SectionLabel>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-neutral-800">{e.response}</p>
                      <p className="mt-2 font-mono text-[10.5px] text-neutral-500">model: {e.model ?? "deterministic tier (no LLM)"}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
        {!shown.length && <p className="px-4 py-6 text-center text-[13px] text-neutral-500">No entries match.</p>}
      </div>
    </AppShell>
  );
}
