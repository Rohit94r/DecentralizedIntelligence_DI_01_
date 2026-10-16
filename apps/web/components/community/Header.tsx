"use client";

/** The top of the Community page: heading, a one-line summary, who's around, and the student/teacher switch. */
import React from "react";
import { motion } from "motion/react";
import { GraduationCap, Users } from "lucide-react";
import type { CommunityStats, Profile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar } from "./bits";
import { FOCUS, type Person } from "./meta";

type View = "student" | "teacher";

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
          <h1 className="text-[1.85rem] font-medium leading-[1.1] tracking-[-0.03em] text-[#17152A] dark:text-neutral-50 sm:text-[2.2rem]">Community</h1>
          <p className="mt-1.5 max-w-2xl text-pretty text-[14px] leading-[1.55] text-[#6D6878] dark:text-neutral-400">Ask questions, share what worked and help your classmates. Teachers and Priya, the AI mentor, answer too.</p>
          {stats && (
            <p className="mt-2 text-[12.5px] text-neutral-500">
              <b className="font-semibold text-neutral-800">{stats.posts}</b> posts · <b className="font-semibold text-neutral-800">{stats.replies}</b> replies · <b className="font-semibold text-neutral-800">{pct}%</b> answered
              {weekPosts ? ` · ${weekPosts} this week` : ""}
            </p>
          )}
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

    </header>
  );
}
