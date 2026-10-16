"use client";

/**
 * A thread, in a drawer from the right: the question, the accepted answer
 * pinned on top, teacher replies marked out, Priya's replies labelled as the
 * AI mentor's, and a reply box that stays put at the bottom. Esc or a click
 * on the backdrop closes it; focus stays inside while it's open and returns
 * to where you were when it closes.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, BookOpen, Check, CircleCheck, LoaderCircle, MessageSquare, Pin, SendHorizontal, Sparkles, X } from "lucide-react";
import { api, timeAgo, type Post, type Reply, type Role } from "@/lib/api";
import { Markdown } from "@/components/app/Markdown";
import { cn } from "@/lib/utils";
import { Avatar, KindChip, RoleBadge, Spoiler, StatusPill, VoteButton } from "./bits";
import { FOCUS, statusOf, toThreadInfo, type ThreadInfo } from "./meta";

type Thread = Post & { replies: Reply[] };

/** code blocks in posts are dark in both themes, like the editor */
const PROSE = "[&_pre]:border-white/10! [&_pre]:bg-[#16181b]! [&_pre]:text-[#e5e5e5]!";

function ReplyCard({
  r,
  thread,
  accepted,
  canAccept,
  onVote,
  onAccept,
}: {
  r: Reply;
  thread: Thread;
  accepted: boolean;
  canAccept: boolean;
  onVote: () => void;
  onAccept: () => void;
}) {
  const teacher = r.author_role === "teacher";
  const ai = r.ai || r.author_role === "mentor_ai";
  return (
    <div
      className={cn(
        "relative rounded-2xl border p-4",
        accepted
          ? "border-[#359462]/60 bg-[#f3fff0] shadow-[0_8px_24px_-16px_rgba(53,148,98,0.6)] dark:bg-[#359462]/10"
          : teacher
            ? "border-[#c6dafc] bg-[#f6f9ff] dark:border-[#1967d2]/35 dark:bg-[#1967d2]/10"
            : ai
              ? "border-[#dcefd0] bg-[#fbfff8] dark:border-[#359462]/25 dark:bg-[#359462]/[0.06]"
              : "border-neutral-200/80 bg-white",
      )}
    >
      {teacher && !accepted && <span aria-hidden className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-[#1967d2]/70" />}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Avatar name={r.author_name} src={r.author_avatar} size={28} />
        <span className="text-[13px] font-semibold text-neutral-900">{r.author_name}</span>
        <RoleBadge role={r.author_role} />
        {r.author_id === thread.author_id && <span className="rounded-full bg-neutral-100 px-1.5 py-px text-[10.5px] font-semibold text-neutral-500">asker</span>}
        <time dateTime={r.created_at} title={new Date(r.created_at).toLocaleString()} className="text-[11px] text-neutral-400">
          {timeAgo(r.created_at)}
        </time>
      </div>
      <div className={cn("mt-2.5", PROSE)}>
        <Spoiler locked={r.locked} title={thread.challenge_title} href={thread.challenge_id ? `/challenge/${thread.challenge_id}` : null}>
          <Markdown text={r.body} className="text-[13.5px] text-neutral-800" />
        </Spoiler>
      </div>
      {ai && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-[1.45] text-neutral-400">
          <Sparkles className="mt-px size-3 shrink-0" /> Written by Layerflow&apos;s AI mentor — prose only, checked so it never contains code or the answer.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VoteButton layout="pill" score={r.score} on={r.my_vote > 0} onClick={onVote} />
        {canAccept && !accepted && (
          <button
            type="button"
            onClick={onAccept}
            className={cn("inline-flex h-7 items-center gap-1 rounded-full border border-neutral-200 px-2.5 text-[12px] font-semibold text-neutral-500 transition-colors hover:border-[#359462] hover:text-[#2f7c53] dark:hover:text-[#8fe3a6]", FOCUS)}
          >
            <Check className="size-3.5" /> Mark as the answer
          </button>
        )}
      </div>
    </div>
  );
}

export function ThreadDrawer({
  id,
  viewer,
  viewerRole,
  acting,
  onClose,
  onChanged,
  onLoaded,
}: {
  id: number;
  viewer: string;
  viewerRole: Role;
  acting: { name: string; avatar: string | null };
  onClose: () => void;
  onChanged: () => void;
  onLoaded?: (id: number, info: ThreadInfo) => void;
}) {
  const [t, setT] = useState<Thread | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const cb = useRef({ onClose, onLoaded });
  useEffect(() => {
    cb.current = { onClose, onLoaded };
  });

  const load = useCallback(
    () =>
      api
        .thread(id, viewer)
        .then((x) => {
          setT(x);
          setFailed(false);
          cb.current.onLoaded?.(x.id, toThreadInfo(x));
          return x;
        })
        .catch(() => {
          setFailed(true);
          return null;
        }),
    [id, viewer],
  );
  useEffect(() => {
    load();
  }, [load]);

  // Esc closes · Tab stays inside · the page behind doesn't scroll · focus returns on close
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cb.current.onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !panel.current.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);

  const canAccept = !!t && (t.author_id === viewer || viewerRole === "teacher");

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await api.reply(id, { author_id: viewer, body });
      setDraft("");
      if (r.spoiler) setNote("Your reply contains a solution, so it's blurred for anyone who hasn't solved this problem yet.");
      await load();
      onChanged();
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }));
    } catch (e) {
      setNote((e as Error).message || "Couldn't send that — try again.");
    } finally {
      setBusy(false);
    }
  };

  const votePost = async () => {
    if (!t) return;
    const next = t.my_vote > 0 ? 0 : 1;
    setT({ ...t, my_vote: next, score: t.score - t.my_vote + next });
    await api.vote(viewer, "post", t.id, next).catch(() => {});
    load();
    onChanged();
  };
  const voteReply = async (r: Reply) => {
    if (!t) return;
    const next = r.my_vote > 0 ? 0 : 1;
    setT({ ...t, replies: t.replies.map((x) => (x.id === r.id ? { ...x, my_vote: next, score: x.score - x.my_vote + next } : x)) });
    await api.vote(viewer, "reply", r.id, next).catch(() => {});
    load();
  };
  const accept = async (r: Reply) => {
    if (!t) return;
    setT({ ...t, accepted_reply_id: r.id });
    await api.accept(t.id, viewer, r.id).catch(() => {});
    load();
    onChanged();
  };

  const acceptedReply = t?.replies.find((r) => r.id === t.accepted_reply_id) ?? null;
  const rest = t ? t.replies.filter((r) => r.id !== t.accepted_reply_id) : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[70] flex justify-end">
      <div aria-hidden className="absolute inset-0 bg-neutral-950/35 backdrop-blur-[2px]" onClick={onClose} />
      <motion.aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 48, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full w-full max-w-[46rem] flex-col border-l border-neutral-200/80 bg-white shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.25)] outline-none"
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 sm:px-6">
          {t ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <KindChip kind={t.kind} />
              {t.challenge_id && (
                <Link
                  href={`/challenge/${t.challenge_id}`}
                  className={cn("inline-flex min-w-0 items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-600 transition-colors hover:border-neutral-950 hover:text-neutral-950", FOCUS)}
                >
                  <BookOpen className="size-3 shrink-0" />
                  <span className="truncate">{t.challenge_title}</span>
                  <ArrowUpRight className="size-3 shrink-0" />
                </Link>
              )}
            </div>
          ) : (
            <div className="h-5 flex-1">
              <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" />
            </div>
          )}
          <button type="button" onClick={onClose} className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900", FOCUS)} aria-label="Close thread (Esc)" title="Close (Esc)">
            <X className="size-4.5" />
          </button>
        </div>

        {!t ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-neutral-400">
            {failed ? (
              <>
                <p className="text-[13.5px] text-neutral-600">Couldn&apos;t load this thread.</p>
                <button type="button" onClick={() => load()} className={cn("rounded-full border border-neutral-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-neutral-700 hover:border-neutral-950", FOCUS)}>
                  Try again
                </button>
              </>
            ) : (
              <LoaderCircle className="size-5 animate-spin" />
            )}
          </div>
        ) : (
          <>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {/* the post */}
              <div className="px-4 pb-6 pt-5 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <Avatar name={t.author_name} src={t.author_avatar} size={38} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-neutral-900">{t.author_name}</span>
                      <RoleBadge role={t.author_role} />
                    </div>
                    <p className="text-[11.5px] text-neutral-400">
                      <time dateTime={t.created_at} title={new Date(t.created_at).toLocaleString()}>
                        {timeAgo(t.created_at)}
                      </time>
                    </p>
                  </div>
                </div>
                <h2 id={titleId} className="mt-4 text-[21px] font-medium leading-[1.25] tracking-[-0.03em] text-neutral-950 sm:text-[24px]">
                  {t.title}
                </h2>
                <div className={cn("mt-4", PROSE)}>
                  <Spoiler locked={t.locked} title={t.challenge_title} href={t.challenge_id ? `/challenge/${t.challenge_id}` : null}>
                    <Markdown text={t.body} className="text-[14px] leading-[1.65] text-neutral-800" />
                  </Spoiler>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <VoteButton layout="pill" score={t.score} on={t.my_vote > 0} onClick={votePost} />
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full px-1.5 text-[12px] text-neutral-500">
                    <MessageSquare className="size-3.5" /> {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
                  </span>
                  <StatusPill status={statusOf(t, toThreadInfo(t))} />
                </div>
              </div>

              {/* replies */}
              <div className="border-t border-neutral-100 bg-neutral-50/70 px-4 py-6 sm:px-6">
                {acceptedReply && (
                  <section className="mb-6" aria-label="Accepted answer">
                    <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2f7c53] dark:text-[#8fe3a6]">
                      <Pin className="size-3" /> Accepted answer
                    </p>
                    <ReplyCard r={acceptedReply} thread={t} accepted canAccept={false} onVote={() => voteReply(acceptedReply)} onAccept={() => {}} />
                  </section>
                )}
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                  {acceptedReply ? (rest.length ? `${rest.length} more ${rest.length === 1 ? "reply" : "replies"}` : "No other replies") : `${t.replies.length} ${t.replies.length === 1 ? "reply" : "replies"}`}
                </p>
                {t.replies.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center">
                    <MessageSquare className="mx-auto size-5 text-neutral-300" />
                    <p className="mt-2 text-[13px] font-semibold text-neutral-700">No replies yet</p>
                    <p className="mt-0.5 text-[12px] text-neutral-500">Be the first to help — point to the idea, not the answer.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rest.map((r) => (
                      <ReplyCard key={r.id} r={r} thread={t} accepted={false} canAccept={canAccept} onVote={() => voteReply(r)} onAccept={() => accept(r)} />
                    ))}
                  </div>
                )}
                {acceptedReply && canAccept && (
                  <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-neutral-400">
                    <CircleCheck className="size-3.5" /> {t.author_id === viewer ? "You" : "A teacher"} can mark a different reply as the answer at any time.
                  </p>
                )}
              </div>
            </div>

            {/* reply box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="border-t border-neutral-100 bg-white px-4 py-3 sm:px-6 sm:py-4"
            >
              {note && <p className="mb-2 rounded-xl bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600">{note}</p>}
              <div className="flex items-start gap-3">
                <Avatar name={acting.name} src={acting.avatar} size={32} className="mt-1 hidden sm:flex" />
                <div className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white transition-shadow focus-within:ring-2 focus-within:ring-[#359462]/30">
                  <label htmlFor={`${titleId}-reply`} className="sr-only">
                    Your reply
                  </label>
                  <textarea
                    id={`${titleId}-reply`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={3}
                    maxLength={6000}
                    placeholder={viewerRole === "teacher" ? "Guide them to the answer — point, don't solve…" : "Help out — explain the idea in your own words…"}
                    className="block max-h-48 min-h-[76px] w-full resize-none bg-transparent px-3.5 pt-3 text-[13.5px] leading-[1.5] text-neutral-900 outline-none placeholder:text-neutral-400"
                  />
                  <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1">
                    <p className="min-w-0 text-[11px] leading-[1.4] text-neutral-400">Pasting a full solution? It&apos;ll be blurred for anyone who hasn&apos;t solved it yet.</p>
                    <button disabled={busy || !draft.trim()} className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-35", FOCUS)}>
                      {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />} Reply
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </>
        )}
      </motion.aside>
    </motion.div>
  );
}
