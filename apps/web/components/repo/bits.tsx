"use client";

/** Small shared pieces for the Repo Analyse tabs: part colours/icons, tech chips with a glossary, copy buttons, GitHub links. */
import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BrainCircuit, Check, Copy, Database, FlaskConical, Monitor, Rocket, Server, ShieldAlert, Smartphone, TriangleAlert, User, Wrench, type LucideIcon } from "lucide-react";
import type { RepoPartId, RepoReport, Severity } from "@/lib/api";
import { cn } from "@/lib/utils";

export const SEV: Record<Severity, { label: string; bug: string; dot: string; chip: string; Icon: LucideIcon }> = {
  high: { label: "Fix first", bug: "High risk", dot: "#c64e27", chip: "border-[#f3c8b8] bg-[#fdeee8] text-[#a8401f]", Icon: ShieldAlert },
  medium: { label: "Fix soon", bug: "Medium", dot: "#f59e0b", chip: "border-[#fde1a8] bg-[#fff6e3] text-[#96681c]", Icon: TriangleAlert },
  low: { label: "Polish", bug: "Low", dot: "#0586d2", chip: "border-sky-200 bg-sky-50 text-sky-700", Icon: Wrench },
};

export const PART_META: Record<RepoPartId | "user", { label: string; Icon: LucideIcon; color: string }> = {
  user: { label: "You", Icon: User, color: "#6b6578" },
  frontend: { label: "Frontend", Icon: Monitor, color: "#0586d2" },
  backend: { label: "Backend", Icon: Server, color: "#359462" },
  database: { label: "Database", Icon: Database, color: "#d98a06" },
  mobile: { label: "Mobile app", Icon: Smartphone, color: "#db2777" },
  ml: { label: "Machine learning", Icon: BrainCircuit, color: "#7B35F0" },
  tests: { label: "Tests", Icon: FlaskConical, color: "#5aa832" },
  devops: { label: "Ship & run", Icon: Rocket, color: "#c64e27" },
  tooling: { label: "Tooling & config", Icon: Wrench, color: "#737373" },
};

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400", className)}>{children}</p>;
}

export function SectionTitle({ Icon, children, aside }: { Icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Icon className="size-4 text-neutral-500" />
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">{children}</p>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

export function PartBadge({ part, size = "md" }: { part: RepoPartId | "user"; size?: "sm" | "md" }) {
  const m = PART_META[part];
  return (
    <span className={cn("flex shrink-0 items-center justify-center text-white", size === "sm" ? "size-6 rounded-lg" : "size-9 rounded-xl")} style={{ backgroundColor: m.color }}>
      <m.Icon className={size === "sm" ? "size-3.5" : "size-[18px]"} />
    </span>
  );
}

/** Text where `backticked` folder and file names render as small code chips. */
export function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded-md bg-neutral-100 px-1.5 py-px font-mono text-[0.88em] text-neutral-800">
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Tech chips with a glossary: hovering, focusing or tapping a chip shows what it is in plain words.
 * The sentence appears under the chips (not in a floating popup), so it never runs off a phone screen.
 */
export function TechChips({ names, glossary, color = "#525252" }: { names: string[]; glossary: Map<string, { kind: string; what: string }>; color?: string }) {
  const [active, setActive] = useState<string | null>(null);
  if (!names.length) return null;
  const info = active ? glossary.get(active) : null;
  return (
    <div onMouseLeave={() => setActive(null)}>
      <div className="flex flex-wrap gap-1.5">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setActive(n)}
            onFocus={() => setActive(n)}
            onClick={() => setActive((a) => (a === n ? null : n))}
            aria-pressed={active === n}
            className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-shadow", active === n && "ring-2 ring-offset-1 ring-offset-transparent")}
            style={{ color, borderColor: color + "45", backgroundColor: color + "14", ...(active === n ? ({ "--tw-ring-color": color + "55" } as React.CSSProperties) : {}) }}
          >
            {n}
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {info && (
          <motion.p
            key={active}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden text-[12px] leading-[1.45] text-neutral-600"
          >
            <span className="mt-2 block rounded-xl bg-neutral-50 px-2.5 py-1.5">
              <span className="font-semibold text-neutral-900">{active}</span>
              <span className="text-neutral-400"> · {info.kind} — </span>
              {info.what}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        } catch {
          /* clipboard blocked — nothing to do */
        }
      }}
      aria-label={ok ? "Copied" : `Copy: ${text}`}
      className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-[#9aa3ad] transition-colors hover:bg-white/10 hover:text-white", className)}
    >
      {ok ? <Check className="size-3.5 text-[#bbf451]" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** A link to the file (or folder) on GitHub — only for GitHub reports. */
export function githubUrl(r: RepoReport, path: string, line?: number): string | null {
  if (r.repo.source !== "github" || !r.repo.url || !r.repo.branch || path === "(root)") return null;
  const enc = (s: string) => s.split("/").map(encodeURIComponent).join("/");
  const folder = path.endsWith("/");
  return `${r.repo.url}/${folder ? "tree" : "blob"}/${enc(r.repo.branch)}/${enc(path.replace(/\/$/, ""))}${line ? `#L${line}` : ""}`;
}
