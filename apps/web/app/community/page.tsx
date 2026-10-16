"use client";

/**
 * Community — students ask, share tips and help each other; teachers answer
 * (with a badge) and see who needs help on the Teacher desk; Priya, the AI
 * mentor, gives every new question a first nudge. A post that contains a
 * full solution is blurred for anyone who hasn't solved that problem yet.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, CircleCheck, EyeOff, GraduationCap, LoaderCircle, MessageSquare, Search, SendHorizontal, Sparkles, ThumbsUp, Users, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, PageHeading, TagBadge } from "@/components/app/bits";
import { Markdown } from "@/components/app/Markdown";
import { Portal } from "@/components/app/Portal";
import { api, timeAgo, type CommunityStats, type Post, type PostKind, type Profile, type Reply, type Role, type TeacherDesk } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const KINDS: { kind: PostKind; label: string; emoji: string; help: string }[] = [
  { kind: "question", label: "Question", emoji: "🙋", help: "Stuck on something? Ask — someone will help." },
  { kind: "tip", label: "Tip", emoji: "💡", help: "A trick or lesson that helped you." },
  { kind: "discussion", label: "Discussion", emoji: "💬", help: "Talk about an idea or a concept." },
  { kind: "showcase", label: "Showcase", emoji: "🚀", help: "Share a win or something you built." },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<PostKind, (typeof KINDS)[number]>;

function Avatar({ name, src, size = 36 }: { name: string; src: string | null; size?: number }) {
  const colors = ["#7b5ea7", "#0586d2", "#359462", "#c64e27", "#f59e0b", "#ec4899"];
  const c = colors[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % colors.length];
  return src ? (
    <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold uppercase text-white" style={{ width: size, height: size, backgroundColor: c, fontSize: size * 0.4 }}>
      {name.slice(0, 1)}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "teacher")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f0fe] px-2 py-px text-[10.5px] font-bold text-[#1967d2]">
        <BadgeCheck className="size-3" /> Teacher
      </span>
    );
  if (role === "mentor_ai")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#eeffe8] px-2 py-px text-[10.5px] font-bold text-[#2f7c53]">
        <Sparkles className="size-3" /> AI mentor
      </span>
    );
  return null;
}

function Spoiler({ locked, title, children, compact = false }: { locked: boolean; title?: string | null; children: React.ReactNode; compact?: boolean }) {
  const [shown, setShown] = useState(false);
  if (!locked || shown) return <>{children}</>;
  if (compact)
    return (
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-3.5 py-2.5">
        <EyeOff className="size-4 shrink-0 text-neutral-500" />
        <p className="min-w-0 flex-1 text-[12.5px] text-neutral-600">
          <b className="text-neutral-800">Contains a solution{title ? ` for ${title}` : ""}.</b> It unlocks when you solve it yourself.
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShown(true);
          }}
          className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11.5px] font-semibold text-neutral-700"
        >
          Reveal anyway
        </button>
      </div>
    );
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-[7px]">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 p-4 text-center backdrop-blur-[1px]">
        <EyeOff className="size-5 text-neutral-500" />
        <p className="text-[13px] font-semibold text-neutral-800">Contains a solution{title ? ` for ${title}` : ""}</p>
        <p className="max-w-xs text-[12px] text-neutral-500">Solve it yourself first — it'll unlock automatically. Struggling is where the learning happens.</p>
        <div className="flex gap-2">
          {title && (
            <span className="rounded-full bg-neutral-950 px-3 py-1 text-[11.5px] font-semibold text-white">Try it first</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShown(true);
            }}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11.5px] font-semibold text-neutral-700"
          >
            Reveal anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function preview(body: string) {
  return body.replace(/```[\s\S]*?```/g, " [code] ").replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();
}

function PostCard({ p, onOpen, onVote }: { p: Post; onOpen: () => void; onVote: () => void }) {
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={onOpen} className="cursor-pointer rounded-3xl border border-neutral-200/80 bg-white p-4 transition-colors hover:border-neutral-400 sm:p-5">
      <div className="flex items-center gap-2.5">
        <Avatar name={p.author_name} src={p.author_avatar} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-900">{p.author_name}</span>
            <RoleBadge role={p.author_role} />
            <span className="text-[11.5px] text-neutral-400">· {timeAgo(p.created_at)}</span>
          </div>
        </div>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600">
          {KIND[p.kind].emoji} {KIND[p.kind].label}
        </span>
      </div>
      <h3 className="mt-3 text-[15.5px] font-semibold leading-[1.35] tracking-[-0.02em] text-neutral-950">{p.title}</h3>
      {p.challenge_title && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-px text-[11px] font-medium text-neutral-600">📘 {p.challenge_title}</span>
      )}
      <div className="mt-2">
        <Spoiler locked={p.locked} title={p.challenge_title} compact>
          <p className="line-clamp-3 text-[13.5px] leading-[1.55] text-neutral-600">{preview(p.body)}</p>
        </Spoiler>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-neutral-500">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onVote();
          }}
          className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition-colors", p.my_vote > 0 ? "border-[#359462] bg-[#eeffe8] text-[#2f7c53]" : "border-neutral-200 hover:border-neutral-400")}
        >
          <ThumbsUp className="size-3.5" /> {p.score}
        </button>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" /> {p.reply_count} {p.reply_count === 1 ? "reply" : "replies"}
        </span>
        {p.teacher_replies > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-[#1967d2]">
            <GraduationCap className="size-3.5" /> teacher answered
          </span>
        )}
        {p.accepted_reply_id && (
          <span className="inline-flex items-center gap-1 font-semibold text-[#2f7c53]">
            <CircleCheck className="size-3.5" /> solved
          </span>
        )}
        {p.spoiler && !p.locked && <span className="text-[11px] text-neutral-400">contains a solution</span>}
      </div>
    </motion.article>
  );
}

function Thread({ id, viewer, viewerRole, onClose, onChanged }: { id: number; viewer: string; viewerRole: Role; onClose: () => void; onChanged: () => void }) {
  const [t, setT] = useState<(Post & { replies: Reply[] }) | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.thread(id, viewer).then(setT).catch(() => {}), [id, viewer]);
  useEffect(() => {
    load();
  }, [load]);
  const canAccept = t && (t.author_id === viewer || viewerRole === "teacher");
  const send = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    await api.reply(id, { author_id: viewer, body: draft }).catch(() => {});
    setDraft("");
    setBusy(false);
    load();
    onChanged();
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex justify-end bg-neutral-950/30 backdrop-blur-[2px]" onClick={onClose}>
      <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
          <p className="text-[13px] font-semibold text-neutral-500">{t ? `${KIND[t.kind].emoji} ${KIND[t.kind].label}` : "…"}</p>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {!t ? (
          <div className="flex flex-1 items-center justify-center text-neutral-400">
            <LoaderCircle className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="flex items-center gap-2.5">
                <Avatar name={t.author_name} src={t.author_avatar} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-neutral-900">{t.author_name}</span>
                    <RoleBadge role={t.author_role} />
                  </div>
                  <p className="text-[11.5px] text-neutral-400">{timeAgo(t.created_at)}</p>
                </div>
              </div>
              <h2 className="mt-4 text-[22px] font-medium leading-[1.25] tracking-[-0.03em] text-neutral-950">{t.title}</h2>
              {t.challenge_id && (
                <Link href={`/challenge/${t.challenge_id}`} className="mt-2 inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-600 hover:border-neutral-950">
                  📘 {t.challenge_title} <ArrowRight className="size-3" />
                </Link>
              )}
              <div className="mt-4">
                <Spoiler locked={t.locked} title={t.challenge_title}>
                  <Markdown text={t.body} className="text-[14px] text-neutral-800" />
                </Spoiler>
              </div>

              <p className="mb-3 mt-8 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
              </p>
              <div className="space-y-3">
                {[...t.replies]
                  .sort((a, b) => Number(b.id === t.accepted_reply_id) - Number(a.id === t.accepted_reply_id))
                  .map((r) => {
                    const accepted = r.id === t.accepted_reply_id;
                    return (
                      <div key={r.id} className={cn("rounded-2xl border p-4", accepted ? "border-[#359462] bg-[#eeffe8]/60" : r.author_role === "teacher" ? "border-[#c6dafc] bg-[#f5f9ff]" : "border-neutral-200/80 bg-white")}>
                        <div className="flex items-center gap-2">
                          <Avatar name={r.author_name} src={r.author_avatar} size={28} />
                          <span className="text-[13px] font-semibold text-neutral-900">{r.author_name}</span>
                          <RoleBadge role={r.author_role} />
                          <span className="text-[11px] text-neutral-400">{timeAgo(r.created_at)}</span>
                          {accepted && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-bold text-[#2f7c53]">
                              <CircleCheck className="size-3.5" /> Accepted answer
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <Spoiler locked={r.locked} title={t.challenge_title}>
                            <Markdown text={r.body} className="text-[13.5px] text-neutral-800" />
                          </Spoiler>
                        </div>
                        {r.ai && <p className="mt-2 text-[11px] text-neutral-400">Written by Layerflow's AI mentor — prose only, checked so it never contains code or the answer.</p>}
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await api.vote(viewer, "reply", r.id, r.my_vote > 0 ? 0 : 1);
                              load();
                            }}
                            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", r.my_vote > 0 ? "border-[#359462] bg-[#eeffe8] text-[#2f7c53]" : "border-neutral-200 text-neutral-500 hover:border-neutral-400")}
                          >
                            <ThumbsUp className="size-3" /> {r.score}
                          </button>
                          {canAccept && !accepted && (
                            <button
                              onClick={async () => {
                                await api.accept(t.id, viewer, r.id).catch(() => {});
                                load();
                                onChanged();
                              }}
                              className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11.5px] font-semibold text-neutral-500 hover:border-[#359462] hover:text-[#2f7c53]"
                            >
                              ✓ Mark as the answer
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="border-t border-neutral-100 p-4"
            >
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={viewerRole === "teacher" ? "Guide them to the answer — point, don't solve…" : "Help out — explain the idea in your own words…"} className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-neutral-400 focus:border-neutral-950" />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-neutral-400">Pasting a full solution? It'll be blurred for anyone who hasn't solved it yet.</p>
                <button disabled={busy || !draft.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white disabled:opacity-40">
                  {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />} Reply
                </button>
              </div>
            </form>
          </>
        )}
      </motion.aside>
    </motion.div>
  );
}

export default function CommunityPage() {
  const { t } = useI18n();
  const [learner] = useLearner();
  const [view, setView] = useState<"student" | "teacher">("student");
  const [teacherId, setTeacherId] = useState("teacher_james");
  const [me, setMe] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [challenges, setChallenges] = useState<{ id: string; title: string }[]>([]);
  const [desk, setDesk] = useState<TeacherDesk | null>(null);
  const [kind, setKind] = useState<"" | PostKind>("");
  const [problem, setProblem] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState<{ kind: PostKind; title: string; body: string; challenge_id: string }>({ kind: "question", title: "", body: "", challenge_id: "" });
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const viewer = view === "teacher" ? teacherId : (learner ?? "");
  const viewerRole: Role = view === "teacher" ? "teacher" : (me?.role ?? "student");

  useEffect(() => {
    api.people().then((p) => setTeachers(p.teachers)).catch(() => {});
    api.communityMeta().then((m) => setChallenges(m.challenges)).catch(() => {});
  }, []);
  useEffect(() => {
    if (learner) api.profile(learner).then(setMe).catch(() => {});
  }, [learner]);

  const load = useCallback(() => {
    if (!viewer) return;
    api
      .posts({ viewer, kind: kind || undefined, challenge_id: problem || undefined, q: q.trim() || undefined })
      .then((r) => {
        setPosts(r.posts);
        setStats(r.stats);
      })
      .catch(() => setPosts([]));
  }, [viewer, kind, problem, q]);
  useEffect(() => {
    const id = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [load, q]);
  useEffect(() => {
    if (viewerRole === "teacher") api.teacherDesk().then(setDesk).catch(() => {});
  }, [viewerRole, posts]);

  const submit = async () => {
    if (!viewer) return;
    setPosting(true);
    setNotice(null);
    try {
      const r = await api.createPost({ author_id: viewer, kind: form.kind, title: form.title, body: form.body, challenge_id: form.challenge_id || null });
      setComposing(false);
      setForm({ kind: "question", title: "", body: "", challenge_id: "" });
      setNotice(r.spoiler ? "Posted! It contains a solution, so it's blurred for people who haven't solved that problem yet." : form.kind === "question" ? "Posted! Priya already left a first nudge — a teacher will follow up." : "Posted!");
      load();
      setOpenId(r.id);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const vote = async (p: Post) => {
    await api.vote(viewer, "post", p.id, p.my_vote > 0 ? 0 : 1).catch(() => {});
    load();
  };

  const actingName = view === "teacher" ? (teachers.find((x) => x.id === teacherId)?.display_name ?? "Teacher") : (me?.display_name ?? learner ?? "you");
  const teacherObj = teachers.find((x) => x.id === teacherId);
  const shown = useMemo(() => posts ?? [], [posts]);

  return (
    <AppShell title={t("app.community")} subtitle="Students help each other · teachers mentor" wide>
      <PageHeading eyebrow="Community" title="Learn together." accent="Nobody gets stuck alone." body="Ask a question, share a trick that worked, or help a classmate. Teachers answer with a badge, Priya gives every question a first nudge, and full solutions stay blurred until you've solved the problem yourself." />

      {/* view switch */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
          {(
            [
              ["student", `Student view · ${me?.display_name ?? learner ?? ""}`, Users],
              ["teacher", "Teacher view", GraduationCap],
            ] as ["student" | "teacher", string, typeof Users][]
          ).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setView(k)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors", view === k ? "bg-neutral-950 text-white" : "text-neutral-600 hover:text-neutral-950")}>
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
        {view === "teacher" && (
          <div className="flex items-center gap-1.5">
            {teachers.map((tc) => (
              <button key={tc.id} onClick={() => setTeacherId(tc.id)} title={tc.display_name} className={cn("rounded-full p-0.5 transition-all", teacherId === tc.id ? "ring-2 ring-[#1a73e8]" : "opacity-60 hover:opacity-100")}>
                <Avatar name={tc.display_name} src={tc.avatar} size={30} />
              </button>
            ))}
            <span className="ml-1 text-[12px] text-neutral-500">acting as {teacherObj?.display_name}</span>
          </div>
        )}
        {stats && (
          <div className="ml-auto flex flex-wrap gap-3 text-[12px] text-neutral-500">
            <span>
              <b className="text-neutral-900">{stats.posts}</b> posts
            </span>
            <span>
              <b className="text-neutral-900">{stats.replies}</b> replies
            </span>
            <span>
              <b className="text-neutral-900">{stats.teachers}</b> teachers
            </span>
            <span>
              <b className="text-neutral-900">{stats.answered}</b> answered
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {/* composer */}
          <Card className="!p-4">
            {!composing ? (
              <button onClick={() => setComposing(true)} className="flex w-full items-center gap-3 text-left">
                <Avatar name={actingName} src={view === "teacher" ? (teacherObj?.avatar ?? null) : (me?.avatar ?? null)} />
                <span className="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[13.5px] text-neutral-400">{view === "teacher" ? "Share a tip or start a class discussion…" : "Ask a question or share what helped you…"}</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.map((k) => (
                    <button key={k.kind} onClick={() => setForm((f) => ({ ...f, kind: k.kind }))} className={cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", form.kind === k.kind ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600")}>
                      {k.emoji} {k.label}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-neutral-500">{KIND[form.kind].help}</p>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={form.kind === "question" ? "e.g. Why does my loop skip the last item?" : "Give it a title"} className="w-full rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[14px] font-medium outline-none placeholder:text-neutral-400 focus:border-neutral-950" />
                <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={4} placeholder="Explain what you tried and what happened. Tip: describe the idea in words — full solutions get blurred for others." className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-neutral-400 focus:border-neutral-950" />
                <div className="flex flex-wrap items-center gap-2">
                  <select value={form.challenge_id} onChange={(e) => setForm((f) => ({ ...f, challenge_id: e.target.value }))} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-[12.5px] text-neutral-700 outline-none">
                    <option value="">Not about one problem</option>
                    {challenges.map((c) => (
                      <option key={c.id} value={c.id}>
                        📘 {c.title}
                      </option>
                    ))}
                  </select>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setComposing(false)} className="h-9 rounded-full px-4 text-[13px] font-semibold text-neutral-500 hover:text-neutral-900">
                      Cancel
                    </button>
                    <button onClick={submit} disabled={posting || form.title.trim().length < 4 || form.body.trim().length < 2} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white disabled:opacity-40">
                      {posting ? <LoaderCircle className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />} Post as {actingName}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>
          <AnimatePresence>
            {notice && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-[#cfe9c8] bg-[#eeffe8] px-4 py-2.5 text-[13px] text-[#2f7c53]">
                {notice}
              </motion.p>
            )}
          </AnimatePresence>

          {/* filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setKind("")} className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold", !kind ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600")}>
              All
            </button>
            {KINDS.map((k) => (
              <button key={k.kind} onClick={() => setKind(k.kind)} className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold", kind === k.kind ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600")}>
                {k.emoji} {k.label}s
              </button>
            ))}
            <select value={problem} onChange={(e) => setProblem(e.target.value)} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-[12.5px] text-neutral-700 outline-none">
              <option value="">Every problem</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <div className="flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3">
              <Search className="size-3.5 text-neutral-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400" />
            </div>
          </div>

          {/* feed */}
          {posts === null ? (
            <Card className="flex items-center gap-2 text-[13px] text-neutral-500">
              <LoaderCircle className="size-4 animate-spin" /> Loading…
            </Card>
          ) : (
            <div className="space-y-3">
              {shown.map((p) => (
                <PostCard key={p.id} p={p} onOpen={() => setOpenId(p.id)} onVote={() => vote(p)} />
              ))}
              {shown.length === 0 && <Card className="text-center text-[13px] text-neutral-500">No posts here yet — be the first!</Card>}
            </div>
          )}
        </div>

        {/* side column */}
        <div className="space-y-4 lg:sticky lg:top-[77px] lg:self-start">
          {viewerRole === "teacher" && desk && (
            <Card tint="sky">
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="size-4 text-[#1967d2]" />
                <p className="text-[14px] font-semibold text-neutral-950">Teacher desk — who needs you</p>
              </div>
              <div className="space-y-2.5">
                {desk.students.slice(0, 5).map((s) => (
                  <div key={s.learner_id} className="rounded-2xl border border-white/70 bg-white/80 p-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} src={null} size={26} />
                      <span className="text-[13px] font-semibold text-neutral-900">{s.name}</span>
                      <span className="ml-auto text-[11px] text-neutral-500">{s.pass_rate}% pass · {s.submissions} tries</span>
                    </div>
                    {s.recurring.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.recurring.map((r) => (
                          <TagBadge key={r.tag} tag={r.tag} className="!text-[10px]" />
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-[12px] leading-[1.45] text-neutral-600">{s.suggestion}</p>
                    <div className="mt-2 flex gap-3 text-[11.5px] font-semibold">
                      <Link href={`/dashboard?learner=${s.learner_id}`} className="text-[#1967d2] hover:underline">
                        Open their dashboard →
                      </Link>
                      {s.open_questions > 0 && <span className="text-[#a8401f]">{s.open_questions} open question{s.open_questions === 1 ? "" : "s"}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {desk.open_questions.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1967d2]">Waiting for a teacher</p>
                  <div className="space-y-1.5">
                    {desk.open_questions.slice(0, 5).map((oq) => (
                      <button key={oq.id} onClick={() => setOpenId(oq.id)} className="block w-full rounded-xl bg-white/80 px-3 py-2 text-left text-[12.5px] hover:bg-white">
                        <span className="font-semibold text-neutral-900">{oq.title}</span>
                        <span className="block text-[11px] text-neutral-500">
                          {oq.author_name} · {timeAgo(oq.created_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          <Card>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Mentors here</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar name="Priya" src="/people/priya.jpg" size={40} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold text-neutral-900">Priya</span>
                    <RoleBadge role="mentor_ai" />
                  </div>
                  <p className="text-[12px] leading-[1.45] text-neutral-500">Gives every question a first nudge within seconds. Never writes the code.</p>
                </div>
              </div>
              {teachers.map((tc) => (
                <div key={tc.id} className="flex items-start gap-3">
                  <Avatar name={tc.display_name} src={tc.avatar} size={40} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-semibold text-neutral-900">{tc.display_name}</span>
                      <RoleBadge role="teacher" />
                    </div>
                    <p className="text-[12px] leading-[1.45] text-neutral-500">{tc.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card tint="green">
            <p className="text-[14px] font-semibold text-neutral-950">How we help each other</p>
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-[1.5] text-neutral-700">
              <li>🧭 Point to the idea, don't paste the answer.</li>
              <li>🙈 Full solutions are blurred until you've solved that problem.</li>
              <li>✅ The person who asked (or a teacher) marks the answer that helped.</li>
              <li>💛 Be kind — everyone here is learning.</li>
            </ul>
          </Card>

          {view === "student" && me && me.role !== "teacher" && learner && (
            <button
              onClick={async () => {
                const p = await api.saveProfile({ id: learner, role: "teacher" }).catch(() => null);
                if (p) {
                  setMe(p);
                  setNotice(`${p.display_name} is now a teacher account — your replies show a Teacher badge and you get the Teacher desk.`);
                }
              }}
              className="w-full rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-left text-[12.5px] text-neutral-500 hover:border-neutral-950 hover:text-neutral-900"
            >
              <b>Are you a teacher?</b> Turn <code className="font-mono">{learner}</code> into a teacher account →
            </button>
          )}
          {view === "student" && me?.role === "teacher" && learner && (
            <button onClick={async () => setMe(await api.saveProfile({ id: learner, role: "student" }))} className="w-full rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-left text-[12.5px] text-neutral-500 hover:border-neutral-950">
              <b>{me.display_name}</b> is a teacher account · switch back to student
            </button>
          )}
        </div>
      </div>

      <Portal>
        <AnimatePresence>{openId !== null && viewer && <Thread key={openId} id={openId} viewer={viewer} viewerRole={viewerRole} onClose={() => setOpenId(null)} onChanged={load} />}</AnimatePresence>
      </Portal>
    </AppShell>
  );
}
