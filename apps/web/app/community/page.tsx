"use client";

/**
 * Community — students ask, share tips and help each other; teachers answer
 * (with a badge) and see who needs help on the Teacher desk; Priya, the AI
 * mentor, gives every new question a first nudge. A post that contains a
 * full solution is blurred for anyone who hasn't solved that problem yet.
 *
 * Layout, kept simple: a plain header with a one-line summary, then the
 * feed (composer, channel chips, sort, search, posts) beside one column with
 * the Teacher desk (for teachers), mentors and guidelines. Sorting, filters
 * and "who's active" are computed here from what the endpoints return.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, CircleAlert, CircleCheck, CircleDashed, Clock, Flame, MessagesSquare, PenLine, Search, SearchX, Sparkles, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Portal } from "@/components/app/Portal";
import { ChannelChips, type Counts } from "@/components/community/Channels";
import { Composer, type DraftPost } from "@/components/community/Composer";
import { CommunityHeader } from "@/components/community/Header";
import { PostCard, PostCardSkeleton } from "@/components/community/PostCard";
import { GuidelinesCard, MentorsCard, TeacherAccountToggle, TeacherDeskCard } from "@/components/community/Rail";
import { ThreadDrawer } from "@/components/community/ThreadDrawer";
import {
  FOCUS,
  KIND,
  KINDS,
  WEEK_MS,
  activePeople,
  applySmart,
  applySort,
  threadSig,
  toThreadInfo,
  type Smart,
  type Sort,
  type ThreadCache,
  type ThreadInfo,
} from "@/components/community/meta";
import { api, type CommunityStats, type Post, type PostKind, type Profile, type Role, type TeacherDesk } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const SORTS: { id: Sort; label: string; Icon: typeof Clock }[] = [
  { id: "latest", label: "Latest", Icon: Clock },
  { id: "top", label: "Top", Icon: Flame },
  { id: "unanswered", label: "Unanswered", Icon: CircleDashed },
];

const EMPTY_FORM: DraftPost = { kind: "question", title: "", body: "", challenge_id: "" };

export default function CommunityPage() {
  const { t } = useI18n();
  const [learner] = useLearner();
  const [view, setView] = useState<"student" | "teacher">("student");
  const [teacherId, setTeacherId] = useState("teacher_james");
  const [me, setMe] = useState<Profile | null>(null);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [challenges, setChallenges] = useState<{ id: string; title: string }[]>([]);
  const [desk, setDesk] = useState<TeacherDesk | null>(null);

  const [feed, setFeed] = useState<Post[] | null>(null); // what the server returns for the current kind / problem / search
  const [base, setBase] = useState<Post[] | null>(null); // the whole community, for counts and "who's active"
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<ThreadCache>({});

  const [kind, setKind] = useState<"" | PostKind>("");
  const [problem, setProblem] = useState("");
  const [q, setQ] = useState("");
  const [smart, setSmart] = useState<Smart>("");
  const [sort, setSort] = useState<Sort>("latest");

  const [openId, setOpenId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState<DraftPost>(EMPTY_FORM);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const viewer = view === "teacher" ? teacherId : (learner ?? "");
  const viewerRole: Role = view === "teacher" ? "teacher" : (me?.role ?? "student");
  const teacherObj = teachers.find((x) => x.id === teacherId);
  const acting = {
    name: view === "teacher" ? (teacherObj?.display_name ?? "Teacher") : (me?.display_name ?? learner ?? "you"),
    avatar: view === "teacher" ? (teacherObj?.avatar ?? null) : (me?.avatar ?? null),
    role: viewerRole,
  };

  useEffect(() => {
    api.people().then((p) => setTeachers(p.teachers)).catch(() => {});
    api.communityMeta().then((m) => setChallenges(m.challenges)).catch(() => {});
  }, []);
  useEffect(() => {
    if (learner) api.profile(learner).then(setMe).catch(() => {});
  }, [learner]);

  /* ── posts: the filtered feed, plus the whole community when a filter is on ── */
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!viewer) return;
    const mine = ++seq.current;
    const search = q.trim();
    const filtered = !!(kind || problem || search);
    setLoading(true);
    try {
      const [f, all] = await Promise.all([api.posts({ viewer, kind: kind || undefined, challenge_id: problem || undefined, q: search || undefined }), filtered ? api.posts({ viewer }) : Promise.resolve(null)]);
      if (mine !== seq.current) return;
      // the list already says who replied — seed the thread cache so no thread has to be fetched for faces
      setThreads((m) => {
        const n = { ...m };
        for (const p of [...f.posts, ...(all?.posts ?? [])]) if (p.replies_lite) n[p.id] = { sig: threadSig(p), replies: p.replies_lite };
        return n;
      });
      setFeed(f.posts);
      setStats(f.stats);
      setBase(all ? all.posts : f.posts);
    } catch {
      if (mine === seq.current) setFeed((cur) => cur ?? []);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [viewer, kind, problem, q]);
  useEffect(() => {
    const id = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  useEffect(() => {
    if (viewerRole === "teacher") api.teacherDesk().then(setDesk).catch(() => {});
  }, [viewerRole, base]);

  /* ── who replied where: fetched once per thread, refreshed only when a reply or the accepted answer changes ── */
  const inflight = useRef(new Set<number>());
  const failed = useRef(new Set<string>());
  useEffect(() => {
    if (!base || !viewer) return;
    const todo = base.slice(0, 30).filter((p) => p.reply_count > 0 && threads[p.id]?.sig !== threadSig(p) && !inflight.current.has(p.id) && !failed.current.has(`${p.id}:${threadSig(p)}`));
    if (!todo.length) return;
    todo.forEach((p) => inflight.current.add(p.id));
    let i = 0;
    const next = () => {
      const p = todo[i++];
      if (!p) return;
      api
        .thread(p.id, viewer)
        .then((x) => setThreads((m) => ({ ...m, [p.id]: toThreadInfo(x) })))
        .catch(() => failed.current.add(`${p.id}:${threadSig(p)}`))
        .finally(() => {
          inflight.current.delete(p.id);
          next();
        });
    };
    for (let k = 0; k < 4; k++) next();
  }, [base, viewer, threads]);
  const onThreadLoaded = useCallback((id: number, info: ThreadInfo) => setThreads((m) => ({ ...m, [id]: info })), []);

  /* ── derived ── */
  const counts = useMemo<Counts | null>(() => {
    if (!base) return null;
    const inProblem = problem ? base.filter((p) => p.challenge_id === problem) : base;
    const inView = kind ? inProblem.filter((p) => p.kind === kind) : inProblem;
    return {
      all: inProblem.length,
      kinds: Object.fromEntries(KINDS.map((k) => [k.kind, inProblem.filter((p) => p.kind === k.kind).length])) as Record<PostKind, number>,
      smart: {
        unanswered: applySmart(inView, "unanswered", viewer, threads).length,
        solved: applySmart(inView, "solved", viewer, threads).length,
        mine: applySmart(inView, "mine", viewer, threads).length,
      },
    };
  }, [base, kind, problem, viewer, threads]);

  const hotProblems = useMemo(() => {
    const m = new Map<string, { id: string; title: string; count: number }>();
    for (const p of base ?? []) {
      if (!p.challenge_id) continue;
      const cur = m.get(p.challenge_id) ?? { id: p.challenge_id, title: p.challenge_title ?? p.challenge_id, count: 0 };
      cur.count += 1;
      m.set(p.challenge_id, cur);
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, 4);
  }, [base]);

  const shown = useMemo(() => (feed ? applySort(applySmart(feed, smart, viewer, threads), sort, threads) : null), [feed, smart, sort, viewer, threads]);
  const active = useMemo(() => activePeople(base ?? [], threads), [base, threads]);
  const weekPosts = useMemo(() => (base ? base.filter((p) => Date.now() - new Date(p.created_at).getTime() < WEEK_MS).length : null), [base]);

  const problemTitle = (id: string) => challenges.find((c) => c.id === id)?.title ?? base?.find((p) => p.challenge_id === id)?.challenge_title ?? id;
  const anyFilter = !!(kind || problem || smart || q.trim());
  const clearFilters = () => {
    setKind("");
    setProblem("");
    setSmart("");
    setQ("");
  };

  /* ── actions ── */
  const openComposer = (k?: PostKind, challenge?: string) => {
    setForm((f) => ({
      ...f,
      kind: k ?? (f.title || f.body ? f.kind : viewerRole === "teacher" ? "discussion" : "question"),
      challenge_id: challenge ?? (f.challenge_id || problem),
    }));
    setComposing(true);
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const submit = async () => {
    if (!viewer) return;
    setPosting(true);
    setNotice(null);
    try {
      const r = await api.createPost({ author_id: viewer, kind: form.kind, title: form.title.trim(), body: form.body.trim(), challenge_id: form.challenge_id || null });
      const wasQuestion = form.kind === "question";
      setComposing(false);
      setForm(EMPTY_FORM);
      setNotice({
        tone: "ok",
        text: r.spoiler ? "Posted! It contains a solution, so it's blurred for people who haven't solved that problem yet." : wasQuestion ? "Posted! Priya already left a first nudge — a teacher will follow up." : "Posted!",
      });
      load();
      setOpenId(r.id);
    } catch (e) {
      setNotice({ tone: "err", text: (e as Error).message || "Couldn't post that — try again." });
    } finally {
      setPosting(false);
    }
  };

  const vote = async (p: Post) => {
    if (!viewer) return;
    const next = p.my_vote > 0 ? 0 : 1;
    const patch = (list: Post[] | null) => list?.map((x) => (x.id === p.id ? { ...x, my_vote: next, score: x.score - x.my_vote + next } : x)) ?? null;
    setFeed(patch);
    setBase(patch);
    await api.vote(viewer, "post", p.id, next).catch(() => {});
    load();
  };

  const makeTeacher = async () => {
    if (!learner) return;
    const p = await api.saveProfile({ id: learner, role: "teacher" }).catch(() => null);
    if (p) {
      setMe(p);
      setNotice({ tone: "ok", text: `${p.display_name} is now a teacher account — your replies show a Teacher badge and you get the Teacher desk.` });
    }
  };
  const makeStudent = async () => {
    if (!learner) return;
    const p = await api.saveProfile({ id: learner, role: "student" }).catch(() => null);
    if (p) setMe(p);
  };

  // friendly notices fade on their own; errors stay until dismissed
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const id = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(id);
  }, [notice]);

  // "/" jumps to search
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || openId !== null) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [openId]);

  const channelProps = {
    kind,
    setKind,
    smart,
    setSmart,
    problem,
    setProblem,
    counts,
    challenges,
    hotProblems,
  };

  /* ── empty states, one per situation ── */
  const empty = (() => {
    const search = q.trim();
    if (search) return { Icon: SearchX, title: `Nothing matches “${search}”`, body: "Try a shorter word or a different spelling — or ask it as a new question.", cta: { label: "Ask it as a question", run: () => (setForm((f) => ({ ...f, title: f.title || search })), openComposer("question")) } };
    if (smart === "mine") return { Icon: UserRound, title: "You haven't posted here yet", body: "Ask about something you're stuck on, or share a trick that worked for you.", cta: { label: "Start a post", run: () => openComposer() } };
    if (smart === "unanswered") return { Icon: CircleCheck, title: "Every question has an answer", body: "Nothing is waiting for help right now. Got a question of your own?", cta: { label: "Ask a question", run: () => openComposer("question") } };
    if (smart === "solved") return { Icon: CircleDashed, title: "Nothing marked solved here yet", body: "When the asker (or a teacher) marks the reply that helped, the post shows up here.", cta: { label: "See unanswered", run: () => setSmart("unanswered") } };
    if (problem) return { Icon: BookOpen, title: `No posts about ${problemTitle(problem)} yet`, body: "Be the first — ask what's confusing you or share what helped.", cta: { label: `Ask about ${problemTitle(problem)}`, run: () => openComposer("question", problem) } };
    if (kind) return { Icon: KIND[kind].Icon, title: `No ${KIND[kind].plural.toLowerCase()} yet`, body: KIND[kind].help, cta: { label: KIND[kind].verb, run: () => openComposer(kind) } };
    return { Icon: MessagesSquare, title: "No posts yet", body: "Start the conversation — ask a question or share a tip.", cta: { label: "Start a post", run: () => openComposer() } };
  })();

  const summary = [kind && KIND[kind].plural, problem && `about ${problemTitle(problem)}`, smart === "unanswered" ? "unanswered" : smart === "solved" ? "solved" : smart === "mine" ? "your posts" : "", q.trim() && `matching “${q.trim()}”`].filter(Boolean) as string[];

  return (
    <AppShell title={t("app.community")} subtitle="Students help each other · teachers mentor" wide>
      <CommunityHeader
        stats={stats}
        weekPosts={weekPosts}
        view={view}
        setView={setView}
        studentName={me?.display_name ?? learner ?? ""}
        teachers={teachers}
        teacherId={teacherId}
        setTeacherId={setTeacherId}
        active={active}
      />

      <div className="@container/board">
        <div className="grid gap-6 @min-[50rem]:grid-cols-[minmax(0,1fr)_18rem] @5xl:grid-cols-[minmax(0,1fr)_20rem] @5xl:gap-8">
          {/* the feed */}
          <section aria-label="Posts" className="@container/feed min-w-0 space-y-4">
            <div ref={composerRef} className="scroll-mt-24">
              <Composer
                open={composing}
                onOpen={openComposer}
                onClose={() => setComposing(false)}
                form={form}
                setForm={setForm}
                challenges={challenges}
                acting={acting}
                posting={posting}
                onSubmit={submit}
              />
            </div>

            <AnimatePresence>
              {notice && (
                <motion.div
                  role="status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={cn(
                    "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[13px] leading-[1.5]",
                    notice.tone === "ok" ? "lf-tint-green border-[#cfe9c8] bg-[#eeffe8] text-[#2f7c53] dark:text-[#8fe3a6]" : "lf-tint-orange border-[#f0d9b8] bg-[#fff2df] text-[#a8401f] dark:text-[#ff9b77]",
                  )}
                >
                  {notice.tone === "ok" ? <Sparkles className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
                  <p className="min-w-0 flex-1">{notice.text}</p>
                  <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className={cn("-mr-1 flex size-6 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100", FOCUS)}>
                    <X className="size-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* channels */}
            <ChannelChips {...channelProps} />

            {/* sort + search */}
            <div className="flex flex-col gap-2.5 @md/feed:flex-row @md/feed:items-center @md/feed:justify-between">
              <div role="group" aria-label="Sort posts" className="inline-flex shrink-0 self-start rounded-full border border-neutral-200 bg-white p-1">
                {SORTS.map((s) => {
                  const on = sort === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSort(s.id)}
                      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors", FOCUS, on ? "bg-neutral-100 text-neutral-950" : "text-neutral-500 hover:text-neutral-900")}
                    >
                      <s.Icon className="size-3.5" /> {s.label}
                    </button>
                  );
                })}
              </div>
              <label className="flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 transition-shadow focus-within:ring-2 focus-within:ring-[#359462]/30 @md/feed:w-auto @md/feed:max-w-72 @md/feed:flex-1">
                <Search className="size-3.5 shrink-0 text-neutral-400" />
                <span className="sr-only">Search posts</span>
                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} placeholder="Search posts" className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400" />
                {q ? (
                  <button type="button" onClick={() => setQ("")} aria-label="Clear search" className={cn("flex size-5 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900", FOCUS)}>
                    <X className="size-3" />
                  </button>
                ) : (
                  <kbd className="hidden rounded-md border border-neutral-200 px-1.5 font-sans text-[10.5px] text-neutral-400 @lg/feed:inline">/</kbd>
                )}
              </label>
            </div>

            {anyFilter && shown && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[12.5px] text-neutral-500">
                <span>
                  <b className="font-semibold text-neutral-900">{shown.length}</b> {shown.length === 1 ? "post" : "posts"}
                  {summary.length ? ` · ${summary.join(" · ")}` : ""}
                </span>
                <button type="button" onClick={clearFilters} className={cn("ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900", FOCUS)}>
                  <X className="size-3" /> Clear filters
                </button>
              </div>
            )}

            {shown === null ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading posts">
                {[0, 1, 2, 3].map((i) => (
                  <PostCardSkeleton key={i} i={i} />
                ))}
              </div>
            ) : shown.length > 0 ? (
              <div className={cn("space-y-3 transition-opacity duration-200", loading && "opacity-60")}>
                {shown.map((p, i) => (
                  <PostCard key={p.id} p={p} index={i} info={threads[p.id]} onOpen={() => setOpenId(p.id)} onVote={() => vote(p)} onProblem={(id) => setProblem(id)} />
                ))}
                {shown.length > 3 && <p className="pt-2 text-center text-[11.5px] text-neutral-400">You&apos;re all caught up.</p>}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
                  <empty.Icon className="size-5" />
                </span>
                <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">{empty.title}</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] leading-[1.55] text-neutral-500">{empty.body}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={empty.cta.run} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[12.5px] font-semibold text-white", FOCUS)}>
                    <PenLine className="size-3.5" /> {empty.cta.label}
                  </button>
                  {anyFilter && (
                    <button type="button" onClick={clearFilters} className={cn("inline-flex h-9 items-center rounded-full border border-neutral-200 px-4 text-[12.5px] font-semibold text-neutral-600 hover:border-neutral-950 hover:text-neutral-950", FOCUS)}>
                      Clear filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </section>

          {/* people, guidelines, the desk */}
          <aside aria-label="People and guidelines" className="grid min-w-0 content-start gap-4 @min-[40rem]:grid-cols-2 @min-[50rem]:grid-cols-1">
            {viewerRole === "teacher" && (
              <div className="@min-[40rem]:col-span-2 @min-[50rem]:col-span-1">
                <TeacherDeskCard desk={desk} onOpen={setOpenId} />
              </div>
            )}
            <MentorsCard teachers={teachers} />
            <GuidelinesCard />
            {view === "student" && me && learner && <TeacherAccountToggle learner={learner} me={me} onMakeTeacher={makeTeacher} onMakeStudent={makeStudent} />}
          </aside>
        </div>
      </div>

      <Portal>
        <AnimatePresence>
          {openId !== null && viewer && (
            <ThreadDrawer key={openId} id={openId} viewer={viewer} viewerRole={viewerRole} acting={acting} onClose={() => setOpenId(null)} onChanged={load} onLoaded={onThreadLoaded} />
          )}
        </AnimatePresence>
      </Portal>
    </AppShell>
  );
}
