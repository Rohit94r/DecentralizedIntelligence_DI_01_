"use client";

/** Small building blocks shared by the Community feed, thread drawer and rails. */
import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronUp, CircleCheck, CircleDashed, EyeOff, GraduationCap, MessageSquare, Sparkles } from "lucide-react";
import type { PostKind, Role } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FOCUS, KIND, type Status } from "./meta";

const AVATAR_COLORS = ["#7b5ea7", "#0586d2", "#359462", "#c64e27", "#d97706", "#db2777"];

export function Avatar({ name, src, size = 36, className }: { name: string; src: string | null; size?: number; className?: string }) {
  const c = AVATAR_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local avatars
    <img src={src} alt="" className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn("flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase text-white", className)} style={{ width: size, height: size, backgroundColor: c, fontSize: Math.round(size * 0.42) }}>
      {name.slice(0, 1)}
    </span>
  );
}

/** overlapping faces; a teacher's face gets a blue ring, Priya a green one */
export function AvatarStack({ people, size = 22, max = 3 }: { people: { author_id: string; author_name: string; author_avatar: string | null; author_role: Role }[]; size?: number; max?: number }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  return (
    <span className="flex items-center -space-x-1.5" aria-label={`Replies from ${people.map((p) => p.author_name).join(", ")}`}>
      {shown.map((p) => (
        <span
          key={p.author_id}
          title={p.author_name}
          className={cn(
            "rounded-full ring-2",
            p.author_role === "teacher" ? "ring-[#8ab4f8] dark:ring-[#1967d2]" : p.author_role === "mentor_ai" ? "ring-[#a7e08f] dark:ring-[#359462]" : "ring-white dark:ring-[#0a0a0a]",
          )}
        >
          <Avatar name={p.author_name} src={p.author_avatar} size={size} />
        </span>
      ))}
      {people.length > max && (
        <span className="flex items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600 ring-2 ring-white dark:ring-[#0a0a0a]" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  if (role === "teacher")
    return (
      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8f0fe] px-1.5 py-px text-[10.5px] font-bold text-[#1967d2] dark:bg-[#1967d2]/20 dark:text-[#8ab4f8]", className)}>
        <BadgeCheck className="size-3" /> Teacher
      </span>
    );
  if (role === "mentor_ai")
    return (
      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eeffe8] px-1.5 py-px text-[10.5px] font-bold text-[#2f7c53] dark:bg-[#359462]/15 dark:text-[#8fe3a6]", className)}>
        <Sparkles className="size-3" /> AI mentor
      </span>
    );
  return null;
}

export function KindChip({ kind, className }: { kind: PostKind; className?: string }) {
  const k = KIND[kind];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", k.chip, className)}>
      <k.Icon className="size-3" strokeWidth={2.4} /> {k.label}
    </span>
  );
}

const STATUS: Record<Exclude<Status, null>, { label: string; cls: string; Icon: typeof CircleCheck }> = {
  solved: { label: "Solved", cls: "bg-[#eeffe8] text-[#2f7c53] dark:bg-[#359462]/15 dark:text-[#8fe3a6]", Icon: CircleCheck },
  best: { label: "Best answer picked", cls: "bg-[#eeffe8] text-[#2f7c53] dark:bg-[#359462]/15 dark:text-[#8fe3a6]", Icon: CircleCheck },
  teacher: { label: "Teacher answered", cls: "bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1967d2]/20 dark:text-[#8ab4f8]", Icon: GraduationCap },
  answered: { label: "Answered", cls: "bg-neutral-100 text-neutral-600", Icon: MessageSquare },
  open: { label: "Needs an answer", cls: "border border-dashed border-[#eab39e] text-[#a8401f] dark:border-[#c64e27]/60 dark:text-[#ff9b77]", Icon: CircleDashed },
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  if (!status) return null;
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.cls, className)}>
      <s.Icon className="size-3" strokeWidth={2.4} /> {s.label}
    </span>
  );
}

/** upvote toggle — a column on feed cards, a pill in threads */
export function VoteButton({ score, on, onClick, layout = "column", className }: { score: number; on: boolean; onClick: () => void; layout?: "column" | "pill"; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={on}
      aria-label={on ? `Remove your upvote (${score})` : `Upvote (${score})`}
      title={on ? "You found this helpful" : "Helpful? Upvote it"}
      className={cn(
        "shrink-0 border font-semibold tabular-nums transition-colors",
        FOCUS,
        layout === "column" ? "flex w-11 flex-col items-center gap-px rounded-2xl py-1.5 text-[13px]" : "inline-flex h-7 items-center gap-1 rounded-full pl-1.5 pr-2.5 text-[12px]",
        on ? "border-[#359462]/40 bg-[#eeffe8] text-[#2f7c53] dark:bg-[#359462]/15 dark:text-[#8fe3a6]" : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900",
        className,
      )}
    >
      <ChevronUp className={layout === "column" ? "size-4.5" : "size-4"} strokeWidth={2.6} />
      {score}
    </button>
  );
}

/** a post or reply that contains a full solution — blurred until you've solved that problem */
export function Spoiler({ locked, title, href, children, compact = false }: { locked: boolean; title?: string | null; href?: string | null; children: React.ReactNode; compact?: boolean }) {
  const [shown, setShown] = useState(false);
  if (!locked || shown) return <>{children}</>;
  const reveal = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setShown(true);
      }}
      className={cn("relative z-10 shrink-0 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11.5px] font-semibold text-neutral-700 transition-colors hover:border-neutral-950 hover:text-neutral-950", FOCUS)}
    >
      Reveal anyway
    </button>
  );
  if (compact)
    return (
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-3.5 py-2.5">
        <div className="flex min-w-[min(100%,15rem)] flex-1 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-neutral-500 shadow-sm">
            <EyeOff className="size-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-neutral-600">
            <b className="font-semibold text-neutral-800">Contains a solution{title ? ` for ${title}` : ""}.</b> It unlocks when you solve it yourself.
          </p>
        </div>
        {reveal}
      </div>
    );
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80">
      <div aria-hidden className="pointer-events-none max-h-56 select-none overflow-hidden p-4 blur-[7px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 p-4 text-center backdrop-blur-[1px]">
        <span className="flex size-9 items-center justify-center rounded-full bg-white text-neutral-500 shadow-sm">
          <EyeOff className="size-4" />
        </span>
        <p className="text-[13.5px] font-semibold text-neutral-900">Contains a solution{title ? ` for ${title}` : ""}</p>
        <p className="max-w-xs text-[12px] leading-[1.5] text-neutral-500">Solve it yourself first and it unlocks automatically. Struggling a little is where the learning happens.</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {href && (
            <Link href={href} className={cn("relative z-10 inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3 py-1 text-[11.5px] font-semibold text-white", FOCUS)}>
              Try it first <ArrowRight className="size-3" />
            </Link>
          )}
          {reveal}
        </div>
      </div>
    </div>
  );
}

export function RailLabel({ children, className, icon }: { children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400", className)}>
      {icon}
      {children}
    </p>
  );
}
