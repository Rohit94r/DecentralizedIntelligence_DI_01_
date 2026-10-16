"use client";

/**
 * Filing a report — the same anatomy real triage teams ask for: a clear title,
 * where it is, what kind of bug, how bad, what an attacker could do, and
 * (optionally) the steps and the fix. On Layerflow's programs the location
 * comes from the line you clicked in the code.
 */
import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, LoaderCircle, MousePointerClick, Send } from "lucide-react";
import { api, refreshPoints, type BountyCategory, type BountySeverity, type BountySeverityInfo, type FileReportResult } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ReportForm({
  programId,
  learner,
  categories,
  severities,
  location,
  onFiled,
  left,
}: {
  programId: string;
  learner: string | null;
  categories: BountyCategory[];
  severities: BountySeverityInfo[];
  /** platform programs: the clicked line; null = free-text location */
  location: { file: string; line: number | null } | null;
  onFiled: (r: FileReportResult) => void;
  left: number;
}) {
  const fixed = location !== null;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<BountySeverity>("medium");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [fix, setFix] = useState("");
  const [where, setWhere] = useState("");
  const [line, setLine] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cat = categories.find((c) => c.id === category);
  const ready = title.trim().length >= 8 && !!category && description.trim().length >= 40 && (!fixed || !!location?.line);

  const submit = async () => {
    if (!learner) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.fileReport({
        program_id: programId,
        learner_id: learner,
        title,
        category,
        severity,
        file: fixed ? location!.file : where.trim() || null,
        line: fixed ? location!.line : line ? Number(line) : null,
        description,
        steps: steps.trim() || null,
        fix: fix.trim() || null,
      });
      onFiled(r);
      if (r.outcome === "valid") {
        refreshPoints();
        (await import("canvas-confetti")).default({ particleCount: 140, spread: 85, origin: { y: 0.45 } });
      }
      if (r.outcome === "valid" || r.outcome === "triage" || r.outcome === "duplicate") {
        setTitle("");
        setDescription("");
        setSteps("");
        setFix("");
        setCategory("");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-neutral-400 focus:border-neutral-950";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) submit();
      }}
      className="space-y-3"
    >
      {fixed ? (
        <div className={cn("flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[12.5px]", location?.line ? "bg-neutral-950 text-white" : "border border-dashed border-neutral-300 text-neutral-500")}>
          {location?.line ? <Crosshair className="size-4 shrink-0 text-[#bbf451]" /> : <MousePointerClick className="size-4 shrink-0" />}
          {location?.line ? (
            <span className="min-w-0 truncate font-mono">
              {location.file} · line {location.line}
            </span>
          ) : (
            <span>Click the line in the code where the bug is.</span>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Where — file path or URL" className={field} />
          <input value={line} onChange={(e) => setLine(e.target.value.replace(/\D/g, ""))} placeholder="line" inputMode="numeric" className={field} />
        </div>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Title — e.g. SQL injection in product search" className={cn(field, "font-medium")} />
      <div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={cn(field, "h-11 py-0", !category && "text-neutral-400")} aria-label="Kind of bug">
          <option value="">What kind of bug is it?</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <AnimatePresence>
          {cat && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-1 pt-1 text-[11.5px] text-neutral-500">
              {cat.simple}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Severity">
        {severities.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={severity === s.id}
            title={s.simple}
            onClick={() => setSeverity(s.id)}
            className={cn("rounded-xl border-2 px-1 py-1.5 text-[11.5px] font-bold transition-colors", severity === s.id ? "text-white" : "border-neutral-200 bg-white text-neutral-600")}
            style={severity === s.id ? { backgroundColor: s.color, borderColor: s.color } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What's wrong, and what could an attacker actually do with it? Be specific." className={cn(field, "resize-none leading-[1.5]")} />
      <div className="flex justify-between px-1 text-[11px] text-neutral-400">
        <span>{description.trim().length < 40 ? `${40 - description.trim().length} more characters` : "✓ detailed enough"}</span>
        <button type="button" onClick={() => setMore((m) => !m)} className="font-semibold text-neutral-600 hover:text-neutral-950">
          {more ? "− fewer fields" : "+ steps & fix"}
        </button>
      </div>
      <AnimatePresence>
        {more && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
            <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder={"Steps to reproduce\n1. …\n2. …"} className={cn(field, "resize-none")} />
            <textarea value={fix} onChange={(e) => setFix(e.target.value)} rows={2} placeholder="Suggested fix (optional)" className={cn(field, "resize-none")} />
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="rounded-xl bg-[#c64e27]/10 px-3 py-2 text-[12.5px] font-medium text-[#a8401f]">{error}</p>}
      <button disabled={!ready || busy || !learner || left <= 0} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[14px] font-semibold text-white transition-opacity disabled:opacity-35">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Submit report
      </button>
      <p className="text-center text-[11px] text-neutral-400">{left > 0 ? `${left} report${left === 1 ? "" : "s"} left on this program today` : "No reports left today — come back tomorrow."}</p>
    </form>
  );
}
