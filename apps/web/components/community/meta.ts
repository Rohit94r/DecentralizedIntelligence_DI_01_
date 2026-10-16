/**
 * Community — the shared vocabulary: post kinds (with their colours), the
 * statuses a post can be in, sorting/filtering, and the small client-side
 * "people" maths (top helpers, who's active) computed from data the page
 * already has. Nothing here talks to the API.
 */
import { CircleHelp, Lightbulb, MessagesSquare, Rocket, type LucideIcon } from "lucide-react";
import type { Post, PostKind, Reply, Role } from "@/lib/api";

export interface KindMeta {
  kind: PostKind;
  label: string;
  plural: string;
  /** what the composer's quick button and empty states say */
  verb: string;
  /** a shorter one for tight rows */
  short: string;
  help: string;
  Icon: LucideIcon;
  /** the accent bar / icon colour */
  accent: string;
  /** small chip: background + text, light and dark */
  chip: string;
  /** the composer's selected state */
  picked: string;
}

export const KINDS: KindMeta[] = [
  {
    kind: "question",
    label: "Question",
    plural: "Questions",
    verb: "Ask a question",
    short: "Ask a question",
    help: "Stuck on something? Ask and someone will help.",
    Icon: CircleHelp,
    accent: "#e0603a",
    chip: "bg-[#fdeee8] text-[#a8401f] dark:bg-[#c64e27]/20 dark:text-[#ff9b77]",
    picked: "border-[#e0603a] bg-[#fff8f5] dark:bg-[#c64e27]/10",
  },
  {
    kind: "tip",
    label: "Tip",
    plural: "Tips",
    verb: "Share a tip",
    short: "Share a tip",
    help: "A trick or lesson that helped you.",
    Icon: Lightbulb,
    accent: "#e5a50a",
    chip: "bg-[#fef6d8] text-[#8a6100] dark:bg-[#eab308]/15 dark:text-[#f6d365]",
    picked: "border-[#e5a50a] bg-[#fffbeb] dark:bg-[#eab308]/10",
  },
  {
    kind: "discussion",
    label: "Discussion",
    plural: "Discussions",
    verb: "Start a discussion",
    short: "Discuss",
    help: "Talk through an idea or a concept.",
    Icon: MessagesSquare,
    accent: "#7b35f0",
    chip: "bg-[#f2eeff] text-[#5e2ac4] dark:bg-[#7b35f0]/20 dark:text-[#c4a7ff]",
    picked: "border-[#7b35f0] bg-[#faf8ff] dark:bg-[#7b35f0]/10",
  },
  {
    kind: "showcase",
    label: "Showcase",
    plural: "Showcase",
    verb: "Show a win",
    short: "Show a win",
    help: "Share a win or something you built.",
    Icon: Rocket,
    accent: "#db2777",
    chip: "bg-[#fdeef6] text-[#be185d] dark:bg-[#db2777]/20 dark:text-[#f9a8d4]",
    picked: "border-[#db2777] bg-[#fff7fb] dark:bg-[#db2777]/10",
  },
];
export const KIND = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<PostKind, KindMeta>;

export type Sort = "latest" | "top" | "unanswered";
export type Smart = "" | "unanswered" | "solved" | "mine";

/** one shared focus ring for everything clickable on the page */
export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[#359462]/70";

/* ── the thread cache: who replied, kept per post so cards can show faces ── */

export type ReplyLite = Pick<Reply, "id" | "author_id" | "author_name" | "author_role" | "author_avatar" | "ai" | "score" | "created_at">;
export interface ThreadInfo {
  sig: string;
  replies: ReplyLite[];
}
export type ThreadCache = Record<number, ThreadInfo>;

/** changes only when a reply is added or the accepted answer changes — that's when a cached thread is stale */
export const threadSig = (p: { reply_count: number; accepted_reply_id: number | null }) => `${p.reply_count}:${p.accepted_reply_id ?? "-"}`;

export function toThreadInfo(t: Post & { replies: Reply[] }): ThreadInfo {
  return {
    sig: threadSig({ reply_count: t.replies.length, accepted_reply_id: t.accepted_reply_id }),
    replies: t.replies.map((r) => ({
      id: r.id,
      author_id: r.author_id,
      author_name: r.author_name,
      author_role: r.author_role,
      author_avatar: r.author_avatar,
      ai: r.ai,
      score: r.score,
      created_at: r.created_at,
    })),
  };
}

const isAI = (r: { ai?: boolean; author_role: Role }) => !!r.ai || r.author_role === "mentor_ai";

/** replies written by people (not Priya). Without the thread cached: Priya nudges every question once. */
export function humanReplies(p: Post, info?: ThreadInfo): number {
  if (info) return info.replies.filter((r) => !isAI(r)).length;
  return Math.max(0, p.reply_count - (p.kind === "question" ? 1 : 0));
}

/** the distinct people who replied, most recent first, Priya last */
export function repliers(info?: ThreadInfo): ReplyLite[] {
  if (!info) return [];
  const seen = new Set<string>();
  const out: ReplyLite[] = [];
  for (const r of [...info.replies].reverse()) {
    if (seen.has(r.author_id)) continue;
    seen.add(r.author_id);
    out.push(r);
  }
  return out.sort((a, b) => Number(isAI(a)) - Number(isAI(b)));
}

/* ── status: ONE pill per card, and only when it says something ── */

export type Status = "solved" | "best" | "teacher" | "answered" | "open" | null;

export function statusOf(p: Post, info?: ThreadInfo): Status {
  if (p.accepted_reply_id) return p.kind === "question" ? "solved" : "best";
  if (p.kind !== "question") return null;
  if (p.teacher_replies > 0) return "teacher";
  return humanReplies(p, info) === 0 ? "open" : "answered";
}

export const isUnanswered = (p: Post, info?: ThreadInfo) => statusOf(p, info) === "open";

export function applySmart(posts: Post[], smart: Smart, viewer: string, cache: ThreadCache): Post[] {
  if (smart === "unanswered") return posts.filter((p) => isUnanswered(p, cache[p.id]));
  if (smart === "solved") return posts.filter((p) => p.accepted_reply_id !== null);
  if (smart === "mine") return posts.filter((p) => p.author_id === viewer);
  return posts;
}

const ts = (iso: string) => new Date(iso).getTime();

export function applySort(posts: Post[], sort: Sort, cache: ThreadCache): Post[] {
  const out = [...posts];
  if (sort === "latest") return out.sort((a, b) => ts(b.created_at) - ts(a.created_at));
  if (sort === "top") return out.sort((a, b) => b.score - a.score || b.reply_count - a.reply_count || ts(b.created_at) - ts(a.created_at));
  // unanswered first: open questions, then questions still without an accepted answer, then everything else
  const rank = (p: Post) => {
    const s = statusOf(p, cache[p.id]);
    return s === "open" ? 0 : p.kind === "question" && !p.accepted_reply_id ? 1 : 2;
  };
  return out.sort((a, b) => rank(a) - rank(b) || ts(b.created_at) - ts(a.created_at));
}

export function preview(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/\*\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── people: top helpers and who's been around ── */

export interface Person {
  id: string;
  name: string;
  avatar: string | null;
  role: Role;
}

export interface Helper extends Person {
  replies: number;
  accepted: number;
  upvotes: number;
  points: number;
}

/** accepted answer +10 · a reply on someone else's post +3 · each upvote on a reply +2 · each upvote on a tip/discussion/showcase +1 */
export const POINTS = { accepted: 10, reply: 3, replyVote: 2, shareVote: 1 };

export function topHelpers(posts: Post[], cache: ThreadCache, limit = 5): Helper[] {
  const m = new Map<string, Helper & { shareVotes: number; replyVotes: number }>();
  const get = (id: string, name: string, avatar: string | null, role: Role) => {
    let h = m.get(id);
    if (!h) m.set(id, (h = { id, name, avatar, role, replies: 0, accepted: 0, upvotes: 0, points: 0, shareVotes: 0, replyVotes: 0 }));
    return h;
  };
  for (const p of posts) {
    if (p.author_role !== "mentor_ai" && p.kind !== "question") get(p.author_id, p.author_name, p.author_avatar, p.author_role).shareVotes += Math.max(0, p.score);
    for (const r of cache[p.id]?.replies ?? []) {
      if (isAI(r)) continue;
      const h = get(r.author_id, r.author_name, r.author_avatar, r.author_role);
      if (r.author_id !== p.author_id) h.replies += 1;
      h.replyVotes += Math.max(0, r.score);
      if (r.id === p.accepted_reply_id) h.accepted += 1;
    }
  }
  return [...m.values()]
    .map((h) => ({
      id: h.id,
      name: h.name,
      avatar: h.avatar,
      role: h.role,
      replies: h.replies,
      accepted: h.accepted,
      upvotes: h.replyVotes + h.shareVotes,
      points: h.accepted * POINTS.accepted + h.replies * POINTS.reply + h.replyVotes * POINTS.replyVote + h.shareVotes * POINTS.shareVote,
    }))
    .filter((h) => h.points > 0)
    .sort((a, b) => b.points - a.points || b.accepted - a.accepted || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** everyone who posted or replied, most recently active first (Priya excluded — she's always around) */
export function activePeople(posts: Post[], cache: ThreadCache): (Person & { last: string })[] {
  const m = new Map<string, Person & { last: string }>();
  const touch = (id: string, name: string, avatar: string | null, role: Role, at: string) => {
    if (role === "mentor_ai") return;
    const cur = m.get(id);
    if (!cur || ts(at) > ts(cur.last)) m.set(id, { id, name, avatar, role, last: at });
  };
  for (const p of posts) {
    touch(p.author_id, p.author_name, p.author_avatar, p.author_role, p.created_at);
    for (const r of cache[p.id]?.replies ?? []) touch(r.author_id, r.author_name, r.author_avatar, r.author_role, r.created_at);
  }
  return [...m.values()].sort((a, b) => ts(b.last) - ts(a.last));
}

export const WEEK_MS = 7 * 24 * 3600 * 1000;
