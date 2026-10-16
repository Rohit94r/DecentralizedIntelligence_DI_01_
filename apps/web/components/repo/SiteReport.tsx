"use client";

/**
 * Website Analyse — the report for a live URL: what the page is, how it
 * scores on security, speed, search, accessibility and good practice, what
 * it's built with (with the real logos), and every problem with the exact
 * evidence we saw, why it matters and how to fix it.
 */
import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { Accessibility, ChevronDown, CircleCheck, ExternalLink, Gauge, Globe, Layers, Lock, LockOpen, Search, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Card } from "@/components/app/bits";
import { TechLogo } from "@/components/app/Logo";
import type { SiteCategory, SiteIssue, SiteReport as Report } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Label, SEV } from "./bits";

const CAT: Record<SiteCategory, { Icon: typeof ShieldCheck }> = {
  security: { Icon: ShieldCheck },
  performance: { Icon: Gauge },
  seo: { Icon: Search },
  accessibility: { Icon: Accessibility },
  best: { Icon: Wrench },
};

const scoreColor = (n: number) => (n >= 90 ? "#359462" : n >= 70 ? "#5aa832" : n >= 50 ? "#f59e0b" : "#c64e27");

function Favicon({ src, host }: { src: string | null; host: string }) {
  const [ok, setOk] = useState(!!src);
  return ok && src ? (
    <img src={src} alt="" onError={() => setOk(false)} className="size-10 shrink-0 rounded-xl border border-neutral-200/80 bg-white object-contain p-1.5" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-[15px] font-semibold uppercase text-white">{host.replace(/^www\./, "").charAt(0)}</span>
  );
}

function Preview({ src }: { src: string | null }) {
  const [ok, setOk] = useState(!!src);
  if (!ok || !src) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-100 lg:w-[260px]">
      <img src={src} alt="The site's social preview image" onError={() => setOk(false)} className="aspect-[1.91/1] w-full object-cover" />
      <p className="border-t border-neutral-200/80 bg-white px-3 py-1.5 text-[11px] text-neutral-500">Preview image the site shares on WhatsApp / LinkedIn</p>
    </div>
  );
}

function IssueCard({ i, open, onToggle, onAsk }: { i: SiteIssue; open: boolean; onToggle: () => void; onAsk: (q: string) => void }) {
  const s = SEV[i.severity];
  const C = CAT[i.category];
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <s.Icon className="mt-0.5 size-4 shrink-0" style={{ color: s.dot }} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-[1.35] text-neutral-950">{i.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-bold", s.chip)}>{s.label}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-px text-[10.5px] font-semibold text-neutral-600">
              <C.Icon className="size-3" /> {labelOf(i.category)}
            </span>
            <span className="min-w-0 truncate text-[12px] text-neutral-500">{i.detail}</span>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-neutral-100 px-4 py-3.5 text-[13px] leading-[1.55]">
              <div>
                <Label>What we saw</Label>
                <p className="mt-0.5 text-neutral-800">{i.detail}</p>
                {i.evidence.length > 0 && (
                  <div className="no-scrollbar mt-2 overflow-x-auto rounded-xl bg-[#111318] px-3 py-2 font-mono text-[11.5px] leading-[19px] text-[#d4d7dc]">
                    {i.evidence.map((e, k) => (
                      <div key={k} className="whitespace-pre">
                        {e}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Why it matters</Label>
                <p className="mt-0.5 text-neutral-700">{i.why}</p>
              </div>
              <div>
                <Label>How to fix it</Label>
                <p className="mt-0.5 text-neutral-800">{i.fix}</p>
              </div>
              <button onClick={() => onAsk(`Explain "${i.title}" on this site — why does it matter and how exactly do I fix it?`)} className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3 py-1 text-[11.5px] font-semibold text-white">
                <Sparkles className="size-3" /> Ask Priya about this
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LABEL: Record<SiteCategory, string> = { security: "Security", performance: "Speed", seo: "Search (SEO)", accessibility: "Accessibility", best: "Good practice" };
const labelOf = (c: SiteCategory) => LABEL[c];

export function SiteReportView({ report, onAsk }: { report: Report; onAsk: (q: string) => void }) {
  const [cat, setCat] = useState<SiteCategory | "all">("all");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(report.issues.slice(0, 1).map((i) => i.id)));
  const [showPassed, setShowPassed] = useState(false);
  const shown = report.issues.filter((i) => cat === "all" || i.category === cat);
  const passed = report.passed.filter((p) => cat === "all" || p.category === cat);
  const tech = useMemo(() => {
    const m = new Map<string, Report["tech"]>();
    for (const t of report.tech) m.set(t.kind, [...(m.get(t.kind) ?? []), t]);
    return [...m];
  }, [report.tech]);
  const s = report.site;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-3">
              <Favicon src={s.favicon} host={s.host} />
              <div className="min-w-0">
                <p className="truncate text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{s.title ?? s.host}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[12.5px] text-neutral-500 hover:text-neutral-900 hover:underline">
                  {s.https ? <Lock className="size-3 shrink-0 text-[#2f7c53]" /> : <LockOpen className="size-3 shrink-0 text-[#c64e27]" />}
                  <span className="truncate">{s.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </div>
            </div>
            {s.description && <p className="mt-3 line-clamp-2 text-[13px] leading-[1.5] text-neutral-600">{s.description}</p>}
            <p className="mt-3 text-[13.5px] leading-[1.55] text-neutral-800">{report.summary}</p>
            {report.review && (
              <div className="mt-3 flex gap-2.5 rounded-xl bg-neutral-50 px-3.5 py-2.5">
                <img src="/people/priya.jpg" alt="" className="size-6 shrink-0 rounded-full object-cover" />
                <p className="text-[12.5px] leading-[1.55] text-neutral-700">{report.review}</p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-neutral-500">
              <span>HTTP {s.status}</span>
              <span>first byte {(report.metrics.ttfb_ms / 1000).toFixed(2)} s</span>
              <span>HTML {report.metrics.html_kb} KB</span>
              <span>{report.metrics.external_scripts} script files</span>
              <span>{report.metrics.images} images</span>
              {s.server && <span>server: {s.server}</span>}
              {s.redirects.length > 0 && <span>{s.redirects.length} redirect{s.redirects.length === 1 ? "" : "s"}</span>}
            </div>
          </div>
          <Preview src={s.image} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <button onClick={() => setCat("all")} className={cn("rounded-2xl border bg-white px-4 py-3 text-left", cat === "all" ? "border-neutral-950" : "border-neutral-200/80 hover:border-neutral-400")}>
          <p className="text-[11.5px] font-medium text-neutral-500">Overall</p>
          <p className="mt-1 flex items-baseline gap-1.5 text-[24px] font-semibold tabular-nums leading-none tracking-[-0.03em]" style={{ color: scoreColor(report.score) }}>
            <NumberFlow value={report.score} />
            <span className="text-[12px] font-semibold text-neutral-400">grade {report.grade}</span>
          </p>
          <p className="mt-1.5 text-[11px] text-neutral-500">{report.issues.length} to fix</p>
        </button>
        {report.categories.map((c) => {
          const I = CAT[c.id].Icon;
          return (
            <button key={c.id} onClick={() => setCat(cat === c.id ? "all" : c.id)} className={cn("rounded-2xl border bg-white px-4 py-3 text-left", cat === c.id ? "border-neutral-950" : "border-neutral-200/80 hover:border-neutral-400")}>
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-500">
                <I className="size-3.5" /> {c.label}
              </p>
              <p className="mt-1 text-[24px] font-semibold tabular-nums leading-none tracking-[-0.03em]" style={{ color: scoreColor(c.score) }}>
                <NumberFlow value={c.score} />
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: scoreColor(c.score) }} initial={{ width: 0 }} animate={{ width: `${c.score}%` }} transition={{ duration: 0.8 }} />
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-500">
                {c.passed}/{c.total} checks passed
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Layers className="size-4 text-neutral-500" />
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Built with</p>
          <span className="text-[12px] text-neutral-400">· spotted from the page, its files and the server's headers</span>
        </div>
        {tech.length ? (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {tech.map(([kind, ts]) => (
              <div key={kind}>
                <Label>{kind}</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ts.map((t) => (
                    <span key={t.name} title={`How we know: ${t.evidence}`} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[12.5px] font-medium text-neutral-800">
                      <TechLogo name={t.name} size={15} />
                      {t.name}
                      {t.version && <span className="font-mono text-[11px] text-neutral-400">{t.version}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-neutral-500">No framework or service we recognise — it may be hand-written HTML, or rendered on the server without tell-tale files.</p>
        )}
        {report.metrics.third_party.length > 0 && (
          <p className="mt-4 border-t border-neutral-100 pt-3 text-[12px] leading-[1.6] text-neutral-500">
            <Globe className="mr-1 inline size-3.5 -translate-y-px" />
            Loads from {report.metrics.third_party.length} other domain{report.metrics.third_party.length === 1 ? "" : "s"}: {report.metrics.third_party.slice(0, 12).join(", ")}
            {report.metrics.third_party.length > 12 ? "…" : ""}
          </p>
        )}
      </Card>

      <div>
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
            {cat === "all" ? "What to fix" : labelOf(cat)} <span className="font-normal text-neutral-400">· {shown.length}</span>
          </p>
          {cat !== "all" && (
            <button onClick={() => setCat("all")} className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-900">
              Show every category
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {shown.map((i) => (
            <IssueCard
              key={i.id}
              i={i}
              open={openIds.has(i.id)}
              onToggle={() =>
                setOpenIds((s0) => {
                  const n = new Set(s0);
                  if (n.has(i.id)) n.delete(i.id);
                  else n.add(i.id);
                  return n;
                })
              }
              onAsk={onAsk}
            />
          ))}
          {!shown.length && (
            <Card tint="green" className="flex items-center gap-2 text-[13px] text-[#2f7c53]">
              <CircleCheck className="size-4" /> Nothing to fix here in the checks we ran.
            </Card>
          )}
        </div>
      </div>

      {passed.length > 0 && (
        <Card>
          <button onClick={() => setShowPassed((v) => !v)} className="flex w-full items-center gap-2 text-left">
            <CircleCheck className="size-4 text-[#359462]" />
            <span className="text-[14px] font-semibold text-neutral-900">{passed.length} checks passed</span>
            <ChevronDown className={cn("ml-auto size-4 text-neutral-400 transition-transform", showPassed && "rotate-180")} />
          </button>
          {showPassed && (
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] text-neutral-600 sm:grid-cols-2">
              {passed.map((p) => (
                <li key={p.title} className="flex items-start gap-2">
                  <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-[#359462]" /> {p.title}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <p className="text-center text-[11.5px] leading-[1.6] text-neutral-400">
        A quick, polite check from the outside: the page, its headers, robots.txt, the sitemap, security.txt and a sample of {report.metrics.sampled} of its files ({report.metrics.sampled_kb} KB). It doesn't log in, submit forms or attack anything. Pages that build themselves with JavaScript are checked as the server sends them.
        {report.truncated ? " The page was over 3 MB, so only the first 3 MB were read." : ""}
      </p>
    </div>
  );
}
