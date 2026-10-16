"use client";

/** The right rail: Teacher desk (teachers only), mentors, top helpers, guidelines, and the teacher-account switch. */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, CircleCheck, Compass, EyeOff, GraduationCap, HeartHandshake, Inbox, MessageCircle, Trophy } from "lucide-react";
import { TagBadge } from "@/components/app/bits";
import { timeAgo, type Profile, type TeacherDesk } from "@/lib/api";
import { openChat } from "@/lib/chat-context";
import { cn } from "@/lib/utils";
import { Avatar, RailLabel, RoleBadge } from "./bits";
import { FOCUS, POINTS, type Helper } from "./meta";

const CARD = "rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)]";

export function TeacherDeskCard({ desk, onOpen }: { desk: TeacherDesk | null; onOpen: (id: number) => void }) {
  const [all, setAll] = useState(false);
  const students = desk ? (all ? desk.students : desk.students.slice(0, 3)) : [];
  return (
    <section aria-label="Teacher desk" className="lf-tint-sky rounded-3xl border border-sky-200/60 bg-sky-50 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-white text-[#1967d2] shadow-sm dark:text-[#8ab4f8]">
          <GraduationCap className="size-4" />
        </span>
        <div>
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">Teacher desk</p>
          <p className="text-[11.5px] text-neutral-500">Who needs you right now</p>
        </div>
      </div>

      {!desk ? (
        <div className="mt-4 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {students.map((s) => (
              <div key={s.learner_id} className="rounded-2xl bg-white/80 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2">
                  <Avatar name={s.name} src={null} size={26} />
                  <span className="min-w-0 truncate text-[13px] font-semibold text-neutral-900">{s.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-neutral-500">
                    {s.pass_rate}% pass · {s.submissions} tries
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-[#359462]" style={{ width: `${Math.max(4, s.pass_rate)}%` }} />
                </div>
                {s.recurring.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.recurring.map((r) => (
                      <TagBadge key={r.tag} tag={r.tag} className="px-2 text-[10px]" />
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[12px] leading-[1.45] text-neutral-600">{s.suggestion}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold">
                  <Link href={`/dashboard?learner=${s.learner_id}`} className={cn("inline-flex items-center gap-1 rounded text-[#1967d2] hover:underline dark:text-[#8ab4f8]", FOCUS)}>
                    Open their dashboard <ArrowRight className="size-3" />
                  </Link>
                  {s.open_questions > 0 && (
                    <span className="text-[#a8401f] dark:text-[#ff9b77]">
                      {s.open_questions} open question{s.open_questions === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {desk.students.length === 0 && <p className="rounded-2xl bg-white/80 p-3 text-[12.5px] text-neutral-500">No learners have submitted anything yet.</p>}
          </div>
          {desk.students.length > 3 && (
            <button type="button" onClick={() => setAll((v) => !v)} className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-[#1967d2] dark:text-[#8ab4f8]", FOCUS)}>
              {all ? "Show fewer" : `Show ${desk.students.length - 3} more`} <ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} />
            </button>
          )}

          <RailLabel className="mb-2 mt-4 text-[#1967d2] dark:text-[#8ab4f8]">Waiting for a teacher</RailLabel>
          {desk.open_questions.length > 0 ? (
            <div className="space-y-1.5">
              {desk.open_questions.slice(0, 5).map((oq) => (
                <button key={oq.id} type="button" onClick={() => onOpen(oq.id)} className={cn("block w-full rounded-xl bg-white/80 px-3 py-2 text-left transition-colors hover:bg-white", FOCUS)}>
                  <span className="line-clamp-2 text-[12.5px] font-semibold text-neutral-900">{oq.title}</span>
                  <span className="mt-0.5 block text-[11px] text-neutral-500">
                    {oq.author_name} · {timeAgo(oq.created_at)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2.5 text-[12px] text-neutral-600">
              <Inbox className="size-3.5 shrink-0 text-neutral-400" /> Every question has a teacher reply. Nice.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function MentorsCard({ teachers }: { teachers: Profile[] }) {
  return (
    <section aria-label="Mentors" className={CARD}>
      <RailLabel className="mb-3.5">Mentors here</RailLabel>
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          <Avatar name="Priya" src="/people/priya.jpg" size={40} />
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[#359462] dark:border-[#0a0a0a]" title="Always on" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-neutral-900">Priya</span>
            <RoleBadge role="mentor_ai" />
          </div>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-neutral-500">Gives every question a first nudge within seconds. Never writes the code.</p>
          <button
            type="button"
            onClick={() => openChat()}
            className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-[11.5px] font-semibold text-neutral-700 transition-colors hover:border-neutral-950 hover:text-neutral-950", FOCUS)}
          >
            <MessageCircle className="size-3.5" /> Ask Priya now
          </button>
        </div>
      </div>
      {teachers.length > 0 && <div className="my-4 border-t border-neutral-100" />}
      <ul className="space-y-3.5">
        {teachers.map((tc) => (
          <li key={tc.id} className="flex items-start gap-3">
            <Avatar name={tc.display_name} src={tc.avatar} size={40} className="ring-2 ring-[#c6dafc] dark:ring-[#1967d2]/50" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13.5px] font-semibold text-neutral-900">{tc.display_name}</span>
                <RoleBadge role="teacher" />
              </div>
              {tc.bio && <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-neutral-500">{tc.bio}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TopHelpersCard({ helpers, loading, me, onFindUnanswered }: { helpers: Helper[]; loading: boolean; me: string; onFindUnanswered: () => void }) {
  return (
    <section aria-label="Top helpers" className={CARD}>
      <RailLabel className="mb-3" icon={<Trophy className="size-3 text-[#d99a00]" />}>
        Top helpers
      </RailLabel>
      {loading && helpers.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-6 animate-pulse rounded-full bg-neutral-100" />
              <div className="size-8 animate-pulse rounded-full bg-neutral-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-2.5 w-32 animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : helpers.length === 0 ? (
        <p className="text-[12.5px] leading-[1.5] text-neutral-500">Nobody yet — answer a question and you&apos;ll be the first name here.</p>
      ) : (
        <ol className="-mx-2 space-y-0.5">
          {helpers.map((h, i) => (
            <li key={h.id} className={cn("flex items-center gap-2.5 rounded-2xl px-2 py-1.5", h.id === me && "bg-neutral-50")}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                  i === 0 ? "bg-[#bbf451] text-[#1a2e05]" : i < 3 ? "bg-neutral-100 text-neutral-700" : "text-neutral-400",
                )}
              >
                {i + 1}
              </span>
              <Avatar name={h.name} src={h.avatar} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-neutral-900">
                    {h.name}
                    {h.id === me && <span className="font-normal text-neutral-400"> (you)</span>}
                  </span>
                  {h.role === "teacher" && <GraduationCap className="size-3.5 shrink-0 text-[#1967d2] dark:text-[#8ab4f8]" aria-label="Teacher" />}
                </div>
                <p className="truncate text-[11.5px] text-neutral-500" title={`${h.replies} replies · ${h.accepted} accepted · ${h.upvotes} upvotes`}>
                  {[h.replies && `${h.replies} ${h.replies === 1 ? "reply" : "replies"}`, h.accepted && `${h.accepted} accepted`, h.upvotes && `${h.upvotes} upvote${h.upvotes === 1 ? "" : "s"}`]
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-right text-[13px] font-semibold leading-none tabular-nums text-neutral-900">
                {h.points}
                <span className="block pt-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-neutral-400">rep</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {helpers.length > 0 && (
        <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] leading-[1.5] text-neutral-400">
          Helper reputation (not wallet points): accepted answer +{POINTS.accepted} · reply +{POINTS.reply} · upvote on a reply +{POINTS.replyVote} · upvote on a tip or showcase +{POINTS.shareVote}
        </p>
      )}
      <button type="button" onClick={onFindUnanswered} className={cn("mt-2.5 inline-flex items-center gap-1 rounded-full text-[12px] font-semibold text-[#2f7c53] hover:underline dark:text-[#8fe3a6]", FOCUS)}>
        Help someone now — see unanswered <ArrowRight className="size-3.5" />
      </button>
    </section>
  );
}

const RULES: [typeof Compass, string][] = [
  [Compass, "Point to the idea, don't paste the answer."],
  [EyeOff, "Full solutions are blurred until you've solved that problem."],
  [CircleCheck, "The person who asked (or a teacher) marks the answer that helped."],
  [HeartHandshake, "Be kind — everyone here is learning."],
];

export function GuidelinesCard() {
  return (
    <section aria-label="Community guidelines" className="lf-tint-green rounded-3xl border border-[#cfe9c8]/80 bg-[#eeffe8] p-5">
      <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">How we help each other</p>
      <ul className="mt-3 space-y-2.5">
        {RULES.map(([Icon, text]) => (
          <li key={text} className="flex items-start gap-2.5 text-[12.5px] leading-[1.5] text-neutral-700">
            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#2f7c53] dark:text-[#8fe3a6]">
              <Icon className="size-3" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeacherAccountToggle({ learner, me, onMakeTeacher, onMakeStudent }: { learner: string; me: Profile; onMakeTeacher: () => void; onMakeStudent: () => void }) {
  const teacher = me.role === "teacher";
  return (
    <button
      type="button"
      onClick={teacher ? onMakeStudent : onMakeTeacher}
      className={cn("group flex w-full items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-left transition-colors hover:border-neutral-950", FOCUS)}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors group-hover:text-neutral-900">
        <GraduationCap className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-neutral-500">
        {teacher ? (
          <>
            <b className="font-semibold text-neutral-900">{me.display_name}</b> is a teacher account. Switch back to a student account.
          </>
        ) : (
          <>
            <b className="font-semibold text-neutral-900">Are you a teacher?</b> Turn <code className="font-mono text-[11.5px]">{learner}</code> into a teacher account.
          </>
        )}
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
