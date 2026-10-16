"use client";

/** Small shared pieces for Bug Bounty: severity colours and report status pills. */
import React from "react";
import { CircleCheck, CircleHelp, CircleX, Clock, Copy } from "lucide-react";
import type { BountySeverity, ReportStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export const SEVERITY_STYLE: Record<BountySeverity, { color: string; label: string }> = {
  critical: { color: "#b42318", label: "Critical" },
  high: { color: "#c64e27", label: "High" },
  medium: { color: "#f59e0b", label: "Medium" },
  low: { color: "#0586d2", label: "Low" },
};

export function SeverityChip({ severity, className }: { severity: string; className?: string }) {
  const s = SEVERITY_STYLE[severity as BountySeverity];
  if (!s) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-bold", className)} style={{ color: s.color, backgroundColor: s.color + "18" }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

const STATUS: Record<ReportStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  triage: { label: "In triage", cls: "bg-neutral-100 text-neutral-700", Icon: Clock },
  valid: { label: "Confirmed", cls: "bg-[#359462]/15 text-[#2f7c53]", Icon: CircleCheck },
  duplicate: { label: "Duplicate", cls: "bg-sky-100 text-sky-800", Icon: Copy },
  needs_info: { label: "Needs info", cls: "bg-[#f59e0b]/15 text-[#96681c]", Icon: CircleHelp },
  invalid: { label: "Not reproduced", cls: "bg-[#c64e27]/12 text-[#a8401f]", Icon: CircleX },
};

export function StatusPill({ status }: { status: ReportStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", s.cls)}>
      <s.Icon className="size-3" /> {s.label}
    </span>
  );
}
