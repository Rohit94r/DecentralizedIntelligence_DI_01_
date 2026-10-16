"use client";

/** One post in the feed: vote column, kind accent, title, a 2-line preview, one status pill, and who replied. */
import { motion } from "motion/react";
import { BookOpen, EyeOff, MessageSquare } from "lucide-react";
import { timeAgo, type Post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack, KindChip, RoleBadge, Spoiler, StatusPill, VoteButton } from "./bits";
import { FOCUS, KIND, preview, repliers, statusOf, type ThreadInfo } from "./meta";

export function PostCard({ p, info, index = 0, onOpen, onVote, onProblem }: { p: Post; info?: ThreadInfo; index?: number; onOpen: () => void; onVote: () => void; onProblem?: (id: string) => void }) {
  const k = KIND[p.kind];
  const status = statusOf(p, info);
  const faces = repliers(info);
  const when = new Date(p.created_at);
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex gap-3 rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-[border-color,box-shadow] duration-200 hover:border-neutral-400 hover:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.18)] sm:gap-4 sm:p-5"
    >
      {/* kind accent */}
      <span aria-hidden className="absolute inset-y-6 left-0 w-[3px] rounded-r-full opacity-80 transition-opacity group-hover:opacity-100" style={{ backgroundColor: k.accent }} />

      <VoteButton score={p.score} on={p.my_vote > 0} onClick={onVote} className="relative z-10 self-start" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindChip kind={p.kind} />
          {p.challenge_id && p.challenge_title && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onProblem?.(p.challenge_id!);
              }}
              title={`Show every post about ${p.challenge_title}`}
              className={cn("relative z-10 inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-px text-[11px] font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900", FOCUS)}
            >
              <BookOpen className="size-3 shrink-0" />
              <span className="truncate">{p.challenge_title}</span>
            </button>
          )}
          <time dateTime={p.created_at} title={when.toLocaleString()} className="ml-auto shrink-0 pl-2 text-[11.5px] text-neutral-400">
            {timeAgo(p.created_at)}
          </time>
        </div>

        <h3 className="mt-2 text-[15.5px] font-semibold leading-[1.35] tracking-[-0.02em] text-neutral-950 sm:text-[16px]">
          {/* the title is the card's link: its ::after stretches over the whole card */}
          <button type="button" onClick={onOpen} className="text-left outline-none after:absolute after:inset-0 after:rounded-3xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[#359462]/70">
            {p.title}
          </button>
        </h3>

        <div className="mt-1.5">
          <Spoiler locked={p.locked} title={p.challenge_title} compact>
            <p className="line-clamp-2 text-[13.5px] leading-[1.55] text-neutral-600">{preview(p.body)}</p>
          </Spoiler>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={p.author_name} src={p.author_avatar} size={20} />
            <span className="truncate text-[12.5px] font-semibold text-neutral-800">{p.author_name}</span>
            <RoleBadge role={p.author_role} />
          </span>
          <StatusPill status={status} />
          {p.spoiler && !p.locked && (
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400" title="Blurred for anyone who hasn't solved this problem yet">
              <EyeOff className="size-3" /> has a solution
            </span>
          )}
          <span className="ml-auto flex items-center gap-2 text-[12px] text-neutral-500">
            <AvatarStack people={faces} size={20} />
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MessageSquare className="size-3.5" />
              {p.reply_count}
              <span className="sr-only"> {p.reply_count === 1 ? "reply" : "replies"}</span>
            </span>
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export function PostCardSkeleton({ i = 0 }: { i?: number }) {
  return (
    <div aria-hidden className="flex gap-3 rounded-3xl border border-neutral-200/80 bg-white p-4 sm:gap-4 sm:p-5" style={{ animationDelay: `${i * 120}ms` }}>
      <div className="h-[52px] w-11 shrink-0 animate-pulse rounded-2xl bg-neutral-100" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-4 w-24 animate-pulse rounded-full bg-neutral-100" />
          <div className="ml-auto h-3 w-12 animate-pulse rounded-full bg-neutral-100" />
        </div>
        <div className={cn("h-4 animate-pulse rounded-full bg-neutral-200", i % 2 ? "w-3/5" : "w-4/5")} />
        <div className="h-3 w-full animate-pulse rounded-full bg-neutral-100" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-neutral-100" />
        <div className="flex items-center gap-2 pt-1.5">
          <div className="size-5 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-3 w-16 animate-pulse rounded-full bg-neutral-100" />
          <div className="ml-auto h-3 w-10 animate-pulse rounded-full bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}
