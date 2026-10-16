"use client";

/** The top of the Community page: heading, who's around, the student/teacher switch, and four stat tiles. */
import React from "react";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { CircleCheck, GraduationCap, MessageSquare, MessagesSquare, Users } from "lucide-react";
import type { CommunityStats, Profile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar } from "./bits";
import { FOCUS, type Person } from "./meta";

type View = "student" | "teacher";

function Tile({ icon, tint, label, value, suffix, hint, bar }: { icon: React.ReactNode; tint: string; label: string; value: number | null; suffix?: string; hint?: string | null; bar?: number }) {
  return (
    <div className="relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white px-3.5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)] sm:px-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tint)}>{icon}</span>
      <div className="min-w-0 flex-1">
        {value === null ? (
          <div className="h-[22px] w-10 animate-pulse rounded-lg bg-neutral-100" />
        ) : (
          <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.03em] text-neutral-950 tabular-nums">
            <NumberFlow value={value} suffix={suffix} />
          </p>
        )}
        <p className="mt-0.5 truncate text-[12px] font-semibold text-neutral-700">{label}</p>
        {hint ? <p className="truncate text-[11px] text-neutral-400">{hint}</p> : null}
      </div>
      {bar !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-0.75 bg-neutral-100">
          <motion.div className="h-full bg-[#359462]" initial={{ width: 0 }} animate={{ width: `${bar}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </div>
      )}
    </div>
  );
}

export function CommunityHeader({
  stats,
  weekPosts,
  view,
  setView,
  studentName,
  teachers,
  teacherId,
  setTeacherId,
  active,
}: {
  stats: CommunityStats | null;
  weekPosts: number | null;
  view: View;
  setView: (v: View) => void;
  studentName: string;
  teachers: Profile[];
  teacherId: string;
  setTeacherId: (id: string) => void;
  active: (Person & { last: string })[];
}) {
  const pct = stats && stats.posts ? Math.round((stats.answered / stats.posts) * 100) : 0;
  const recent = active.filter((p) => Date.now() - new Date(p.last).getTime() < 7 * 24 * 3600 * 1000);
  const shown = (recent.length ? recent : active).slice(0, 5);
  const names = shown.slice(0, 2).map((p) => p.name);
  const others = (recent.length ? recent : active).length - names.length;
  const teacher = teachers.find((t) => t.id === teacherId);

  return (
    <header className="mb-6 sm:mb-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Community</p>
          <h1 className="text-balance text-[1.85rem] font-medium leading-[1.08] tracking-[-0.04em] sm:text-[2.3rem]">
            <span className="text-[#17152A] dark:text-neutral-50">Learn together.</span> <span className="text-[#359462]">Nobody gets stuck alone.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-[14px] font-medium leading-[1.55] tracking-[-0.01em] text-[#6D6878] dark:text-neutral-400">
            Ask, share what worked, and help a classmate — teachers and Priya, your AI mentor, are here too.
          </p>
          {shown.length > 0 && (
            <div className="mt-3 flex items-center gap-2.5">
              <span className="flex -space-x-2">
                {shown.map((p) => (
                  <span key={p.id} title={p.name} className="rounded-full ring-2 ring-neutral-50 dark:ring-[#101113]">
                    <Avatar name={p.name} src={p.avatar} size={26} />
                  </span>
                ))}
              </span>
              <p className="text-[12.5px] text-neutral-500">
                <b className="font-semibold text-neutral-800">{names.join(", ")}</b>
                {others > 0 ? ` and ${others} other${others === 1 ? "" : "s"}` : ""} {recent.length ? "active this week" : "in the community"}
              </p>
            </div>
          )}
        </div>

        {/* who you're acting as */}
        <div className="flex shrink-0 flex-col gap-2.5 lg:items-end">
          <div role="group" aria-label="View the community as" className="grid grid-cols-2 rounded-full border border-neutral-200 bg-white p-1 sm:inline-grid">
            {(
              [
                ["student", `Student${studentName ? ` · ${studentName}` : ""}`, Users],
                ["teacher", "Teacher view", GraduationCap],
              ] as [View, string, typeof Users][]
            ).map(([k, label, Icon]) => {
              const on = view === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setView(k)}
                  className={cn(
                    "relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                    FOCUS,
                    on ? "text-white dark:text-[#0a0a0a]" : "text-neutral-600 hover:text-neutral-950",
                  )}
                >
                  {on && <motion.span layoutId="lf-community-view" className="absolute inset-0 rounded-full bg-[#0a0a0a] dark:bg-[#f5f5f5]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <Icon className="relative size-3.5 shrink-0" />
                  <span className="relative truncate">{label}</span>
                </button>
              );
            })}
          </div>
          {view === "teacher" && teachers.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 lg:justify-end">
              <span className="text-[11.5px] text-neutral-500">Acting as</span>
              <div className="flex items-center gap-1">
                {teachers.map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setTeacherId(tc.id)}
                    title={tc.display_name}
                    aria-label={`Act as ${tc.display_name}`}
                    aria-pressed={teacherId === tc.id}
                    className={cn("rounded-full p-0.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#359462]/70", teacherId === tc.id ? "ring-2 ring-[#1a73e8]" : "opacity-55 hover:opacity-100")}
                  >
                    <Avatar name={tc.display_name} src={tc.avatar} size={28} />
                  </button>
                ))}
              </div>
              <span className="text-[12px] font-semibold text-neutral-800">{teacher?.display_name}</span>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Tile
          icon={<MessagesSquare className="size-4" />}
          tint="bg-[#f2eeff] text-[#5e2ac4] dark:bg-[#7b35f0]/20 dark:text-[#c4a7ff]"
          label="Posts"
          value={stats?.posts ?? null}
          hint={weekPosts !== null ? (weekPosts > 0 ? `${weekPosts} this week` : "none yet this week") : null}
        />
        <Tile
          icon={<MessageSquare className="size-4" />}
          tint="bg-[#fef6d8] text-[#8a6100] dark:bg-[#eab308]/15 dark:text-[#f6d365]"
          label="Replies"
          value={stats?.replies ?? null}
          hint={stats && stats.posts ? `${(stats.replies / stats.posts).toFixed(1)} per post` : null}
        />
        <Tile
          icon={<CircleCheck className="size-4" />}
          tint="bg-[#eeffe8] text-[#2f7c53] dark:bg-[#359462]/15 dark:text-[#8fe3a6]"
          label="Answered"
          value={stats ? pct : null}
          suffix="%"
          bar={stats ? pct : undefined}
          hint={stats ? `${stats.answered} of ${stats.posts} posts` : null}
        />
        <Tile
          icon={<GraduationCap className="size-4" />}
          tint="bg-[#e8f0fe] text-[#1967d2] dark:bg-[#1967d2]/20 dark:text-[#8ab4f8]"
          label="Teachers"
          value={stats?.teachers ?? null}
          hint="+ Priya, AI mentor"
        />
      </div>
    </header>
  );
}
