"use client";

/**
 * Repo Analyse · Overview — the project explained for a beginner: what it is,
 * its parts (frontend, backend, database…), how a click travels through them,
 * which languages it's written in, what each folder is for, which files to read
 * first, and the commands that run it.
 */
import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { BookOpen, Compass, ExternalLink, FileCode, FolderOpen, FolderTree, Footprints, Languages, Route, Sparkles, Terminal } from "lucide-react";
import { Card } from "@/components/app/bits";
import type { RepoReport } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CopyButton, InlineCode, Label, PART_META, PartBadge, SectionTitle, TechChips, githubUrl } from "./bits";

type Overview = NonNullable<RepoReport["overview"]>;

function fmt(n: number) {
  return n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function Parts({ o, glossary, langColor }: { o: Overview; glossary: Map<string, { kind: string; what: string }>; langColor: (n: string) => string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {o.parts.map((p, i) => {
        const m = PART_META[p.id];
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06 }}
            className="min-w-0 rounded-2xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: `inset 0 3px 0 ${m.color}` }}
          >
            <div className="flex items-start gap-3">
              <PartBadge part={p.id} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">{p.label}</p>
                  <span className="text-[11.5px] font-medium text-neutral-400">{p.files ? `${p.files} file${p.files === 1 ? "" : "s"}` : "used from the backend"}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-[1.45] text-neutral-600">{p.simple}</p>
              </div>
            </div>
            {p.languages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                {p.languages.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-700">
                    <span className="size-2 rounded-full" style={{ backgroundColor: langColor(l) }} />
                    {l}
                  </span>
                ))}
              </div>
            )}
            {p.tech.length > 0 && (
              <div className="mt-3">
                <TechChips names={p.tech} glossary={glossary} color={m.color} />
              </div>
            )}
            {p.folders.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {p.folders.map((f) => (
                  <code key={f} className="max-w-full truncate rounded-md bg-neutral-100 px-1.5 py-px font-mono text-[11px] text-neutral-600">
                    {f}
                  </code>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/** How a click travels through the parts — the same visual language as the layer diagram. */
function Flow({ o }: { o: Overview }) {
  const label = (part: Overview["flow"][number]["part"]) => (part === "user" ? "You" : (o.parts.find((p) => p.id === part)?.label ?? PART_META[part].label));
  return (
    <ol className="relative">
      {o.flow.map((s, i) => {
        const m = PART_META[s.part];
        const next = o.flow[i + 1];
        return (
          <li key={i} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.14, type: "spring", stiffness: 260, damping: 18 }}>
                <PartBadge part={s.part} />
              </motion.div>
              {next && (
                <div className="relative my-1 w-px flex-1 bg-neutral-200" style={{ minHeight: 22 }}>
                  <motion.span
                    className="absolute -left-[3px] size-[7px] rounded-full"
                    style={{ backgroundColor: PART_META[next.part].color }}
                    animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.35, ease: "easeInOut" }}
                  />
                </div>
              )}
            </div>
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.14 }} className={cn("min-w-0 flex-1", next ? "pb-4" : "pb-0")}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: m.color }}>
                Step {i + 1} · {label(s.part)}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-[1.55] text-neutral-800">
                <InlineCode text={s.text} />
              </p>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}

function LanguagesCard({ o }: { o: Overview }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = o.languages.reduce((n, l) => n + l.lines, 0);
  const KIND: Record<string, string> = { code: "code", markup: "page markup", style: "styles", data: "data / settings", docs: "docs" };
  return (
    <Card>
      <SectionTitle Icon={Languages} aside={<span className="text-[11.5px] text-neutral-400">≈ {fmt(total)} lines</span>}>
        Languages in this repo
      </SectionTitle>
      <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100">
        {o.languages.map((l, i) => (
          <motion.div
            key={l.name}
            title={`${l.name} ${l.share}%`}
            onMouseEnter={() => setHover(l.name)}
            onMouseLeave={() => setHover(null)}
            className="h-full transition-opacity"
            style={{ backgroundColor: l.color, opacity: hover && hover !== l.name ? 0.35 : 1 }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(l.share, 0.6)}%` }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-neutral-100">
        {o.languages.map((l) => (
          <li key={l.name} onMouseEnter={() => setHover(l.name)} onMouseLeave={() => setHover(null)} className={cn("py-2.5 transition-opacity", hover && hover !== l.name && "opacity-60")}>
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-[13.5px] font-semibold text-neutral-950">{l.name}</span>
              <span className="hidden rounded-full bg-neutral-100 px-1.5 py-px text-[10.5px] font-medium text-neutral-500 sm:inline">{KIND[l.kind] ?? l.kind}</span>
              <span className="ml-auto shrink-0 text-right text-[11.5px] tabular-nums text-neutral-500">
                {l.files} file{l.files === 1 ? "" : "s"} · {fmt(l.lines)} lines · <span className="font-semibold text-neutral-800">{l.share}%</span>
              </span>
            </div>
            <p className="mt-0.5 pl-[18px] text-[12px] leading-[1.45] text-neutral-500">{l.what}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-neutral-400">Lines are counted for the files we read and estimated from file size for the rest. Lockfiles and generated files are left out.</p>
    </Card>
  );
}

function FolderMap({ o, report }: { o: Overview; report: RepoReport }) {
  return (
    <Card>
      <SectionTitle Icon={FolderTree}>What each folder is for</SectionTitle>
      <ul className="space-y-1">
        {o.folders.map((f, i) => {
          const nested = f.path.replace(/\/$/, "").includes("/");
          const href = githubUrl(report, f.path);
          const name = (
            <code className="truncate font-mono text-[12px] font-semibold text-neutral-900">{nested ? f.path.split("/").slice(-2).join("/") : f.path}</code>
          );
          return (
            <motion.li key={f.path} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }} className={cn("rounded-xl px-2.5 py-2 hover:bg-neutral-50", nested && "ml-5 border-l border-neutral-200 pl-3")}>
              <div className="flex min-w-0 items-center gap-2">
                <FolderOpen className="size-3.5 shrink-0 text-neutral-400" />
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline">
                    {name}
                  </a>
                ) : (
                  name
                )}
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-neutral-400">{f.files} files</span>
              </div>
              <p className="mt-0.5 pl-[22px] text-[12px] leading-[1.45] text-neutral-600">{f.role}</p>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}

function StartHere({ o, report, onAsk }: { o: Overview; report: RepoReport; onAsk: (q: string) => void }) {
  return (
    <Card>
      <SectionTitle Icon={Footprints}>Start reading here</SectionTitle>
      <ol className="space-y-2.5">
        {o.start_here.map((s, i) => {
          const href = githubUrl(report, s.path);
          return (
            <li key={s.path} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <FileCode className="size-3.5 shrink-0 text-neutral-400" />
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 hover:underline">
                      <code className="truncate font-mono text-[12.5px] font-semibold text-neutral-900">{s.path}</code>
                      <ExternalLink className="size-3 shrink-0 text-neutral-400" />
                    </a>
                  ) : (
                    <code className="truncate font-mono text-[12.5px] font-semibold text-neutral-900">{s.path}</code>
                  )}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-[1.45] text-neutral-600">{s.why}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {o.start_here.length > 1 && (
        <button onClick={() => onAsk(`Walk me through ${o.start_here[Math.min(2, o.start_here.length - 1)].path} like I'm a beginner — what does it do?`)} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1 text-[12px] font-semibold text-neutral-700 hover:border-neutral-950">
          <Sparkles className="size-3.5" /> Ask Priya to walk you through it
        </button>
      )}
    </Card>
  );
}

function RunIt({ o }: { o: Overview }) {
  return (
    <Card>
      <SectionTitle Icon={Terminal}>Run it on your computer</SectionTitle>
      {o.commands.length ? (
        <ol className="space-y-2.5">
          {o.commands.map((c, i) => (
            <li key={c.cmd}>
              <p className="mb-1 text-[12px] font-medium text-neutral-600">
                <span className="mr-1 font-semibold text-neutral-400">{i + 1}.</span>
                {c.label}
              </p>
              <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[#111318] py-1 pl-3 pr-1">
                <span className="font-mono text-[12px] text-[#bbf451]">$</span>
                <code className="no-scrollbar min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 font-mono text-[12.5px] text-[#e5e7eb]">{c.cmd}</code>
                <CopyButton text={c.cmd} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[12.5px] text-neutral-500">We couldn't find run commands — check the README for how to start it.</p>
      )}
    </Card>
  );
}

export function RepoOverview({ report, onAsk }: { report: RepoReport; onAsk: (q: string) => void }) {
  const o = report.overview!;
  const glossary = useMemo(() => new Map(o.tech.map((t) => [t.name, { kind: t.kind, what: t.what }])), [o.tech]);
  const langColor = useMemo(() => {
    const m = new Map(o.languages.map((l) => [l.name, l.color]));
    return (n: string) => m.get(n) ?? "#a3a3a3";
  }, [o.languages]);
  const otherTech = o.tech.filter((t) => !o.parts.some((p) => p.tech.includes(t.name)));
  const codeLangs = o.languages.filter((l) => l.kind !== "docs" && l.kind !== "data").length;
  const lines = o.languages.reduce((n, l) => n + l.lines, 0);

  return (
    <div className="space-y-6">
      {/* what it is */}
      <Card tint="green">
        <div className="flex items-center gap-2">
          <Compass className="size-4 text-[#2f7c53]" />
          <Label className="text-[#2f7c53]">This project in one minute</Label>
        </div>
        <p className="mt-2 text-[16px] font-medium leading-[1.55] tracking-[-0.01em] text-neutral-900 sm:text-[17px]">{o.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["files", report.metrics.files],
              ["lines (approx.)", lines],
              ["languages", codeLangs],
              ["main parts", o.parts.filter((p) => ["frontend", "backend", "database", "mobile", "ml"].includes(p.id)).length],
            ] as [string, number][]
          ).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/80 px-3 py-2">
              <p className="text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                <NumberFlow value={v} />
              </p>
              <p className="text-[10.5px] text-neutral-500">{k}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* the parts */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
          <p className="text-[18px] font-medium tracking-[-0.02em] text-neutral-950">The parts of this project</p>
          <p className="text-[12px] text-neutral-500">Tap a tool to see what it does.</p>
        </div>
        {o.parts.length ? <Parts o={o} glossary={glossary} langColor={langColor} /> : <Card className="text-[13px] text-neutral-500">We couldn't sort the files into parts.</Card>}
        {otherTech.length > 0 && (
          <div className="mt-3 rounded-2xl border border-dashed border-neutral-200 px-4 py-3">
            <Label className="mb-2">Also used</Label>
            <TechChips names={otherTech.map((t) => t.name)} glossary={glossary} />
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {o.flow.length > 0 && (
          <Card>
            <SectionTitle Icon={Route}>How it runs — follow one click</SectionTitle>
            <Flow o={o} />
          </Card>
        )}
        {o.languages.length > 0 && <LanguagesCard o={o} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          {o.start_here.length > 0 && <StartHere o={o} report={report} onAsk={onAsk} />}
          <RunIt o={o} />
        </div>
        {o.folders.length > 0 && (
          <div className="min-w-0">
            <FolderMap o={o} report={report} />
          </div>
        )}
      </div>

      <button
        onClick={() => onAsk("Explain how this project is put together, like I'm a beginner: which part does what?")}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#ddd0ff] bg-[#f2eeff] px-4 py-3 text-left transition-transform hover:-translate-y-0.5"
      >
        <BookOpen className="size-4 shrink-0 text-[#5e2ac4]" />
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#3f1d8a]">Still confused? Ask Priya to explain how the parts fit together.</span>
        <Sparkles className="size-4 shrink-0 text-[#5e2ac4]" />
      </button>
    </div>
  );
}
