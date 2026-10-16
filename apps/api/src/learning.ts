/**
 * Services behind Mentoring, the "Ask Priya" chat, Repo Analyse and Community.
 *
 * The same guardrails as the core product apply everywhere:
 *   • a challenge-aware reply is prose only (guardReply → validateHint + findLeak)
 *   • nothing here ever reads a hidden test — the mentor script is built from
 *     the stored explanation, Line Map, and a replay on a PUBLIC probe
 *   • every AI call is optional and every one is logged to the ledger
 */
import {
  MENTOR,
  TAG_LABELS,
  analyzeRepo,
  auditSite,
  buildMentorScript,
  findLeak,
  chatSystemPrompt,
  getChallenge,
  guardReply,
  listedChallenges,
  localReply,
  nextChallenge,
  parseRepoUrl,
  publicChallenge,
  repoAnswer,
  rollup,
  siteAnswer,
  spoilerCheck,
  tagLabel,
  validatePost,
  type ChatContext,
  type MistakeTag,
  type Outcome,
  type RepoReport,
  type SiteReport,
  type TraceResult,
} from "@layerflow/core";
import type { LayerflowStore } from "@layerflow/db";
import { parseJsonReply, type Ai, type AiMessage } from "./lib/ai.ts";
import { RepoError, fetchGithub, localSnapshot } from "./lib/repo-fetch.ts";
import { fetchSite } from "./lib/site-fetch.ts";
import type { Ctx } from "./service.ts";

export interface LearnCtx extends Ctx {
  ai: Ai | null;
  log?: (s: string) => void;
}

type Sub = NonNullable<ReturnType<LayerflowStore["getSubmission"]>>;

const HIDE = /^(harness|judge_|scripted_learner)/;

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export function displayName(store: LayerflowStore, id: string): string {
  return store.profile(id)?.display_name ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/[_-]+/g, " ");
}

function firstSentence(s: string): string {
  return (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
}

/* ───────────────────────── replay (shared with /api/replay) ───────────────────────── */

export function visibleRows(sub: Sub) {
  const c = getChallenge(sub.challenge_id)!;
  const pub = publicChallenge(c);
  return sub.results
    .filter((r) => r.kind === "visible")
    .map((r) => ({ test: r.test, call: pub.visible[r.test - 1]?.call ?? "", expected: pub.visible[r.test - 1]?.expected ?? "", got: r.got ?? "", outcome: r.outcome as Outcome }));
}

export function hiddenRows(sub: Sub) {
  return sub.results.filter((r) => r.kind === "hidden").map((r) => ({ test: r.test, outcome: r.outcome as Outcome }));
}

/** Replays a stored submission on a PUBLIC input: a probe for the kind of input that failed. */
export async function replaySubmission(ctx: Ctx, sub: Sub, opts: { kind?: string; args_source?: string } = {}) {
  const challenge = getChallenge(sub.challenge_id)!;
  let kind = opts.kind;
  if (!kind && !opts.args_source) {
    const failingEdges = sub.results
      .filter((r) => r.outcome !== "passed")
      .map((r) => (r.kind === "visible" ? challenge.visible : challenge.hidden)[r.test - 1]?.edge)
      .filter((e): e is string => !!e && !!challenge.probes[e]);
    kind = failingEdges[0] ?? "default";
  }
  const args = challenge.probes[kind ?? "default"] ?? challenge.visible[0].args;
  const res = await ctx.sandbox.trace({
    code: sub.code,
    fn: challenge.fn,
    args: opts.args_source ? undefined : args,
    argsSource: opts.args_source,
    culpritLine: sub.analysis?.culprit_line ?? null,
  });
  return {
    ...res,
    used_kind: opts.args_source ? "custom" : (kind ?? "default"),
    kinds: Object.keys(challenge.probes).map((k) => ({ kind: k, label: k === "default" ? "first visible example" : (challenge.edges[k]?.one ?? k) })),
  };
}

/* ───────────────────────── Mentoring ───────────────────────── */

export function mentorOverview(store: LayerflowStore, learnerId: string) {
  const history = store.history(learnerId);
  const by = new Map<string, typeof history>();
  for (const h of history) by.set(h.challenge_id, [...(by.get(h.challenge_id) ?? []), h]);
  const problems = [...by.entries()]
    .map(([cid, hs]) => {
      const c = getChallenge(cid);
      if (!c) return null;
      const last = hs[hs.length - 1];
      const sub = store.getSubmission(last.submission_id);
      const tagsSeen = [...new Set(hs.flatMap((h) => h.tags))];
      return {
        challenge_id: cid,
        title: c.title,
        signature: c.signature,
        difficulty: c.difficulty,
        bug_factory: !!c.bugFactory,
        attempts: hs.length,
        passed: last.passed,
        ever_passed: hs.some((h) => h.passed),
        last_at: last.at,
        submission_id: last.submission_id,
        tags: last.tags,
        tags_seen: tagsSeen,
        tag_labels: tagsSeen.map((t) => tagLabel(t)),
        headline: sub ? firstSentence(sub.explanation) : "",
        culprit_line: sub?.analysis?.culprit_line ?? null,
        hints_used: hs.reduce((n, h) => n + h.hints_used, 0),
        status: last.passed ? ("solved" as const) : ("struggling" as const),
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => Number(a.passed) - Number(b.passed) || b.last_at.localeCompare(a.last_at));

  const r = rollup(history);
  const next = nextChallenge(history, store.mastery(learnerId));
  const tried = new Set(by.keys());
  return {
    mentor: MENTOR,
    learner_id: learnerId,
    learner_name: displayName(store, learnerId),
    problems,
    recurring: r.recurring.map((t) => ({ tag: t, label: tagLabel(t), where: r.where[t] })),
    one_off: r.oneOff.map((t) => ({ tag: t, label: tagLabel(t), where: r.where[t] })),
    next: { challenge_id: next.challenge_id, title: getChallenge(next.challenge_id)?.title ?? next.challenge_id, reason: next.reason },
    fresh: listedChallenges()
      .filter((c) => !tried.has(c.id))
      .slice(0, 4)
      .map((c) => ({ challenge_id: c.id, title: c.title, difficulty: c.difficulty })),
    totals: { attempted: problems.length, solved: problems.filter((p) => p.ever_passed).length, struggling: problems.filter((p) => !p.passed).length },
  };
}

const LANG_NAME: Record<string, string> = { hi: "Hindi (Devanagari script)", mr: "Marathi (Devanagari script)" };

/** Translate the mentor's lines (Hindi / Marathi) when an AI provider is configured. Numbers and code names must survive. */
async function translateSegments<T extends { say: string; speech: string }>(ctx: LearnCtx, segs: T[], lang: string, challenge: Parameters<typeof findLeak>[1], code: string): Promise<{ segs: T[]; translated: boolean }> {
  if (!ctx.ai || !LANG_NAME[lang] || !segs.length) return { segs, translated: false };
  const out = await ctx.ai.complete(
    [
      {
        role: "system",
        content: `Translate each string into natural, warm, spoken ${LANG_NAME[lang]} for a friendly teacher talking to a school student. Keep every number, line number and code name (like count_vowels('Ice') or [1, 4, 9]) exactly as written. Reply with JSON only: {"t": ["...", "..."]} in the same order.`,
      },
      { role: "user", content: JSON.stringify(segs.map((s) => s.say)) },
    ],
    { maxTokens: 2200, temperature: 0.3, json: true, timeoutMs: 25_000 },
  );
  const t = out ? parseJsonReply<{ t: string[] }>(out.text)?.t : null;
  if (!t || t.length !== segs.length) return { segs, translated: false };
  return {
    segs: segs.map((s, i) => {
      const say = typeof t[i] === "string" ? t[i].trim() : "";
      const digits = (x: string) => (x.match(/\d+/g) ?? []).join(",");
      // a translation that changed a number, or would leak, is dropped for that line
      if (!say || digits(say) !== digits(s.say) || findLeak(say, challenge, [], code)) return s;
      return { ...s, say, speech: say };
    }),
    translated: true,
  };
}

export async function mentorSession(ctx: LearnCtx, learnerId: string, challengeId: string, lang = "en") {
  const c = getChallenge(challengeId);
  if (!c) throw err(`No challenge called ${challengeId}`, 404);
  const sub = ctx.store.latestSubmission(learnerId, c.id);
  const all = ctx.store.history(learnerId);
  const mine = all.filter((h) => h.challenge_id === c.id);
  let trace: (TraceResult & { used_kind: string }) | null = null;
  if (sub && !sub.passed) trace = await replaySubmission(ctx, sub).catch(() => null);
  const r = rollup(all);
  const next = nextChallenge(all, ctx.store.mastery(learnerId));
  const visible = sub ? visibleRows(sub) : [];
  const hidden = sub ? hiddenRows(sub) : [];
  const segments = buildMentorScript({
    learnerName: displayName(ctx.store, learnerId),
    mentorName: MENTOR.name,
    challenge: c,
    attempts: mine.length,
    everPassed: mine.some((h) => h.passed),
    latest: sub
      ? { passed: sub.passed, tags: sub.tags, explanation: sub.explanation, visible, hidden, analysis: sub.analysis, code: sub.code, ladderKey: sub.ladder_key }
      : null,
    hintsUsed: sub ? ctx.store.hintsFor(sub.id).length : 0,
    trace,
    recurringWhere: r.where,
    next,
  });
  const tr = lang !== "en" ? await translateSegments(ctx, segments, lang, c, sub?.code ?? "") : { segs: segments, translated: false };
  ctx.store.logEvent({
    kind: "mentor",
    learner_id: learnerId,
    prompt: `tier=deterministic · mentor session · challenge=${c.id} · submission=${sub?.id ?? "none"} · segments=${segments.length}${tr.translated ? ` · translated=${lang}` : ""}`,
    response: tr.segs.map((s) => s.say).join(" ‖ "),
    model: tr.translated ? (ctx.ai?.label ?? null) : null,
    rejected: false,
  });
  return {
    mentor: MENTOR,
    learner_name: displayName(ctx.store, learnerId),
    challenge: publicChallenge(c),
    submission_id: sub?.id ?? null,
    passed: sub?.passed ?? false,
    code: sub?.code ?? c.starter,
    visible,
    hidden,
    tags: sub?.tags ?? [],
    line_map: sub?.analysis ?? null,
    trace,
    segments: tr.segs,
    lang: tr.translated ? lang : "en",
  };
}

/* ───────────────────────── Ask Priya (chat) ───────────────────────── */

export interface ChatBody {
  learner_id?: string;
  lang?: string;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  context?: { page?: string; challenge_id?: string; code?: string; repo_report_id?: string };
}

export async function chat(ctx: LearnCtx, body: ChatBody) {
  const message = body.message.trim().slice(0, 1200);
  const learnerId = body.learner_id && /^[A-Za-z0-9_.-]{2,40}$/.test(body.learner_id) ? body.learner_id : null;
  const history = (body.history ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-10);

  // ── about a Repo Analyse report ──
  if (body.context?.repo_report_id) {
    const row = ctx.store.repoReport(body.context.repo_report_id);
    if (!row) throw err("That report no longer exists — run the analysis again.", 404);
    if ((row.report as { kind?: string }).kind === "site") return siteChat(ctx, row.id, row.report as SiteReport, message, history, learnerId);
    const report = row.report as RepoReport;
    const local = repoAnswer(message, report);
    let reply = local;
    let model: string | null = null;
    if (ctx.ai) {
      const bugs = report.bugs ?? []; // reports saved before bug detection have none
      const asked = bugs.find((b) => message.includes(`${b.file}:${b.line}`));
      const summary = {
        repo: report.repo.name,
        kind: report.kind,
        stack: report.stack,
        score: report.score,
        layers: report.layers.map((l) => `${l.label}: ${l.present ? "yes" : "missing"}`),
        findings: report.findings.map((f) => `[${f.severity}] ${f.title} — fix: ${f.fix}${f.files?.length ? ` (files: ${f.files.slice(0, 3).join(", ")})` : ""}`),
        strengths: report.strengths.map((s) => s.title),
        target: report.target.layers.map((l) => `${l.label}: ${l.rule}`),
        bugs_found: bugs.length,
        top_bugs: bugs.slice(0, 3).map((b) => `[${b.severity}, ${b.confidence}] ${b.title} — ${b.file}:${b.line}`),
        ...(report.overview
          ? {
              what_it_is: report.overview.summary,
              parts: report.overview.parts.map((p) => `${p.label}: ${p.folders.slice(0, 3).join(", ")}${p.tech.length ? ` (${p.tech.slice(0, 4).join(", ")})` : ""}`),
              start_reading: report.overview.start_here.map((s) => `${s.path} — ${s.why}`),
              how_it_runs: report.overview.how_it_runs,
            }
          : {}),
        // the bug the student is asking about (its snippet never contains a secret-looking line)
        ...(asked ? { asked_bug: { title: asked.title, where: `${asked.file}:${asked.line}`, why: asked.why, fix: asked.fix, code: asked.snippet.lines.join("\n") } } : {}),
      };
      const msgs: AiMessage[] = [
        {
          role: "system",
          content:
            "You are Priya, a friendly senior engineer reviewing a student's repository for Layerflow. Explain simply, like to a first-year student: short sentences, everyday words, concrete next steps. Under 150 words. You may include a tiny code or folder example (max 8 lines). Base everything on this analysis; don't invent files.\n" +
            JSON.stringify(summary),
        },
        ...history.map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
        { role: "user", content: message },
      ];
      const out = await ctx.ai.complete(msgs, { maxTokens: 450 });
      if (out && out.text.length < 2500) {
        reply = out.text;
        model = out.model;
      }
    }
    ctx.store.logEvent({ kind: "chat", learner_id: learnerId, prompt: `page=repo · report=${row.id} · ${message}`, response: reply, model, rejected: false });
    return { reply, suggestions: ["What should I fix first?", "How do I make it scalable?", "What's already good?"], source: model ? "ai" : "built-in", model, intent: "repo" };
  }

  // ── general, or about one practice problem ──
  const challenge = body.context?.challenge_id ? (getChallenge(body.context.challenge_id) ?? null) : null;
  const sub = challenge && learnerId ? ctx.store.latestSubmission(learnerId, challenge.id) : null;
  const chatCtx: ChatContext = {
    page: body.context?.page,
    learnerName: learnerId ? displayName(ctx.store, learnerId) : undefined,
    challenge,
    code: (body.context?.code ?? sub?.code ?? "").slice(0, 20_000),
    latest: sub ? { passed: sub.passed, tags: sub.tags, explanation: sub.explanation, analysis: sub.analysis, ladderKey: sub.ladder_key } : null,
    turn: history.filter((m) => m.role === "user").length,
  };
  const local = localReply(message, chatCtx);
  let reply = local.reply;
  let model: string | null = null;
  // Asking for the answer is ALWAYS handled deterministically: exactly one rung, never a collapse.
  if (ctx.ai && local.intent !== "answer_request") {
    const langRule = body.lang && LANG_NAME[body.lang] ? `\nReply in ${LANG_NAME[body.lang]}, but keep Python words and code names in English.` : "";
    const msgs: AiMessage[] = [
      { role: "system", content: chatSystemPrompt(chatCtx) + langRule },
      ...history.map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
      { role: "user", content: message },
    ];
    const out = await ctx.ai.complete(msgs, { maxTokens: 380 });
    if (out) {
      const g = guardReply(out.text, chatCtx);
      if (g.ok) {
        reply = out.text;
        model = out.model;
      } else {
        ctx.store.logEvent({ kind: "chat", learner_id: learnerId, prompt: `rejected by guard (${g.reason}) · challenge=${challenge?.id ?? "none"} · ${message}`, response: out.text, model: out.model, rejected: true });
      }
    }
  }
  ctx.store.logEvent({
    kind: "chat",
    learner_id: learnerId,
    prompt: `page=${chatCtx.page ?? "?"} · challenge=${challenge?.id ?? "none"} · intent=${local.intent} · ${message}`,
    response: reply,
    model,
    rejected: false,
  });
  return { reply, suggestions: local.suggestions, source: model ? "ai" : "built-in", model, intent: local.intent };
}

/* ───────────────────────── Repo Analyse ───────────────────────── */

export async function analyze(ctx: LearnCtx, body: { url?: string; local?: boolean; learner_id?: string }) {
  let snap;
  if (body.local) snap = localSnapshot();
  else {
    const parsed = parseRepoUrl(body.url ?? "");
    if (!parsed) throw new RepoError("Paste a GitHub link like https://github.com/owner/repo (or owner/repo).", 400);
    snap = await fetchGithub(parsed.owner, parsed.name);
  }
  const report = analyzeRepo(snap);
  let reviewModel: string | null = null;
  if (ctx.ai) {
    const out = await ctx.ai.complete(
      [
        {
          role: "system",
          content:
            "You are Priya, a warm senior engineer mentoring a student. Write a spoken-style review of their repository in 4-6 short sentences (under 110 words): one genuine compliment, the most important thing to fix and why, and one tip for making it scalable. Simple words. No lists, no code, no file contents. Only use facts from the analysis.",
        },
        {
          role: "user",
          content: JSON.stringify({
            repo: report.repo.name,
            kind: report.kind,
            stack: report.stack,
            score: report.score,
            strengths: report.strengths.map((s) => s.title),
            findings: report.findings.slice(0, 8).map((f) => `[${f.severity}] ${f.title}`),
            missing_layers: report.layers.filter((l) => !l.present).map((l) => l.label),
            bugs_found: report.bugs.length,
            top_bugs: report.bugs.slice(0, 3).map((b) => `[${b.severity}, ${b.confidence}] ${b.title} — ${b.file}:${b.line}`),
          }),
        },
      ],
      { maxTokens: 300 },
    );
    if (out && out.text.length < 1400 && !/```/.test(out.text)) {
      report.review = out.text.replace(/\s+/g, " ").trim();
      reviewModel = out.model;
    }
  }
  const repoName = snap.source === "local" ? "local" : `${snap.owner}/${snap.name}`;
  const learnerId = body.learner_id && /^[A-Za-z0-9_.-]{2,40}$/.test(body.learner_id) ? body.learner_id : null;
  const id = ctx.store.saveRepoReport({ learner_id: learnerId, repo: repoName, source: snap.source, score: report.score, grade: report.grade, report: { ...report, review_model: reviewModel } });
  ctx.store.logEvent({
    kind: "repo",
    learner_id: learnerId,
    prompt: `repo analyse · ${repoName} · files=${report.metrics.files} sampled=${report.metrics.sampled_files}`,
    response: `score ${report.score} (${report.grade}) · ${report.findings.length} findings · ${report.bugs.length} bugs · ${report.review}`,
    model: reviewModel,
    rejected: false,
  });
  return { id, ...report, review_model: reviewModel };
}

/* ───────────────────────── Website Analyse ───────────────────────── */

/** For a company without a public repo: check the live site instead (see lib/site-fetch.ts for how it's fetched safely). */
export async function analyzeSite(ctx: LearnCtx, body: { url?: string; learner_id?: string }) {
  const fetched = await fetchSite(body.url ?? "");
  const report = auditSite(fetched);
  let reviewModel: string | null = null;
  if (ctx.ai) {
    const out = await ctx.ai.complete(
      [
        {
          role: "system",
          content:
            "You are Priya, a warm senior engineer teaching a student how to review a website. In 4-5 short sentences (under 100 words): what the site is built with, one thing it does well, the most important problem and why it matters to real visitors, and what to fix first. Simple words. No lists, no code. Only use facts from the analysis.",
        },
        {
          role: "user",
          content: JSON.stringify({
            site: report.site.host,
            title: report.site.title,
            score: report.score,
            built_with: report.tech.map((t) => (t.version ? `${t.name} ${t.version}` : t.name)),
            categories: report.categories.map((c) => `${c.label}: ${c.score}/100`),
            problems: report.issues.slice(0, 8).map((i) => `[${i.severity}, ${i.category}] ${i.title} — ${i.detail}`),
            good: report.passed.slice(0, 6).map((p) => p.title),
          }),
        },
      ],
      { maxTokens: 260 },
    );
    if (out && out.text.length < 1200 && !/```/.test(out.text)) {
      report.review = out.text.replace(/\s+/g, " ").trim();
      reviewModel = out.model;
    }
  }
  const learnerId = body.learner_id && /^[A-Za-z0-9_.-]{2,40}$/.test(body.learner_id) ? body.learner_id : null;
  const id = ctx.store.saveRepoReport({ learner_id: learnerId, repo: report.site.host, source: "site", score: report.score, grade: report.grade, report: { ...report, review_model: reviewModel } });
  ctx.store.logEvent({
    kind: "repo",
    learner_id: learnerId,
    prompt: `site analyse · ${report.site.url}`,
    response: `score ${report.score} (${report.grade}) · ${report.issues.length} issues · tech: ${report.tech.map((t) => t.name).join(", ")}`,
    model: reviewModel,
    rejected: false,
  });
  return { id, ...report, review_model: reviewModel };
}

async function siteChat(ctx: LearnCtx, reportId: string, report: SiteReport, message: string, history: { role: "user" | "assistant"; content: string }[], learnerId: string | null) {
  let reply = siteAnswer(message, report);
  let model: string | null = null;
  if (ctx.ai) {
    const asked = report.issues.find((i) => message.includes(i.title));
    const summary = {
      site: report.site.url,
      title: report.site.title,
      score: report.score,
      built_with: report.tech.map((t) => `${t.name}${t.version ? ` ${t.version}` : ""} (${t.kind})`),
      categories: report.categories.map((c) => `${c.label}: ${c.score}/100`),
      problems: report.issues.map((i) => `[${i.severity}, ${i.category}] ${i.title} — ${i.detail} — fix: ${i.fix}`),
      good: report.passed.map((p) => p.title),
      ...(asked ? { asked_about: { title: asked.title, what_we_saw: asked.detail, evidence: asked.evidence, why: asked.why, fix: asked.fix } } : {}),
    };
    const msgs: AiMessage[] = [
      {
        role: "system",
        content:
          "You are Priya, a friendly senior engineer explaining a website review to a first-year student on Layerflow. Short sentences, everyday words, concrete next steps. Under 150 words. You may include a tiny config or HTML example (max 8 lines). Base everything on this analysis; don't invent findings, and never suggest attacking the site.\n" +
          JSON.stringify(summary),
      },
      ...history.map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
      { role: "user", content: message },
    ];
    const out = await ctx.ai.complete(msgs, { maxTokens: 450 });
    if (out && out.text.length < 2500) {
      reply = out.text;
      model = out.model;
    }
  }
  ctx.store.logEvent({ kind: "chat", learner_id: learnerId, prompt: `page=repo · site report=${reportId} · ${message}`, response: reply, model, rejected: false });
  return { reply, suggestions: ["What should I fix first?", "Is this site secure?", "What is it built with?"], source: model ? "ai" : "built-in", model, intent: "repo" };
}

/* ───────────────────────── Community ───────────────────────── */

export function ensureProfile(store: LayerflowStore, id: string) {
  if (!store.profile(id)) store.upsertProfile({ id, display_name: id.charAt(0).toUpperCase() + id.slice(1), role: "student" });
  return store.profile(id)!;
}

/** Problems whose solutions this viewer may see unblurred: the ones they solved — or all of them, for a teacher. */
function solvedBy(store: LayerflowStore, viewer: string): Set<string> {
  if (store.profile(viewer)?.role === "teacher") return new Set(listedChallenges().map((c) => c.id));
  return new Set(store.history(viewer).filter((h) => h.passed).map((h) => h.challenge_id));
}

function decorate<T extends { spoiler: boolean; challenge_id?: string | null; author_id: string }>(p: T, solved: Set<string>, viewer: string, challengeId?: string | null) {
  const cid = challengeId ?? p.challenge_id ?? null;
  return { ...p, locked: p.spoiler && p.author_id !== viewer && !(cid && solved.has(cid)), challenge_title: cid ? (getChallenge(cid)?.title ?? cid) : null };
}

export function listPosts(store: LayerflowStore, q: { viewer?: string; kind?: string; challenge_id?: string; q?: string; author_id?: string }) {
  const viewer = q.viewer ?? "";
  const solved = viewer ? solvedBy(store, viewer) : new Set<string>();
  return store.posts({ ...q, viewer }).map((p) => decorate(p, solved, viewer));
}

export function getThread(store: LayerflowStore, id: number, viewer = "") {
  const p = store.post(id, viewer);
  if (!p) throw err("That post doesn't exist.", 404);
  const solved = viewer ? solvedBy(store, viewer) : new Set<string>();
  return { ...decorate(p, solved, viewer), replies: p.replies.map((r) => decorate(r, solved, viewer, p.challenge_id)) };
}

/** The AI mentor's first reply on a question — prose only, guarded like a hint. */
async function mentorReply(ctx: LearnCtx, post: { title: string; body: string; challenge_id: string | null; author_id: string }) {
  const challenge = post.challenge_id ? (getChallenge(post.challenge_id) ?? null) : null;
  const sub = challenge ? ctx.store.latestSubmission(post.author_id, challenge.id) : null;
  const chatCtx: ChatContext = {
    page: "community",
    learnerName: displayName(ctx.store, post.author_id),
    challenge,
    code: sub?.code ?? "",
    latest: sub ? { passed: sub.passed, tags: sub.tags, explanation: sub.explanation, analysis: sub.analysis, ladderKey: sub.ladder_key } : null,
  };
  const question = `${post.title}\n${post.body}`;
  let local = localReply(question, chatCtx);
  if (local.intent === "fallback" && challenge) local = localReply(sub && !sub.passed ? "what's wrong" : "explain the task", chatCtx);
  let text =
    local.intent === "fallback"
      ? "Great question — a teacher will reply soon. While you wait, try this: pick the smallest example that goes wrong, work it out by hand, then follow your code line by line. The first line where your notes and the code disagree is usually the bug."
      : local.reply;
  let model: string | null = null;
  if (ctx.ai) {
    const out = await ctx.ai.complete(
      [
        { role: "system", content: chatSystemPrompt(chatCtx) + "\nYou are answering a question posted in the class community. Start with one short sentence of empathy, then guide. A teacher may add more later." },
        { role: "user", content: question },
      ],
      { maxTokens: 320 },
    );
    if (out && guardReply(out.text, { ...chatCtx, challenge: chatCtx.challenge }).ok) {
      text = out.text;
      model = out.model;
    }
  }
  ctx.store.logEvent({ kind: "chat", learner_id: post.author_id, prompt: `page=community · auto mentor reply · challenge=${challenge?.id ?? "none"} · ${post.title}`, response: text, model, rejected: false });
  return text;
}

export async function createPost(ctx: LearnCtx, b: { author_id: string; kind: string; title: string; body: string; challenge_id?: string | null }) {
  const problem = validatePost(b);
  if (problem) throw err(problem, 400);
  if (b.challenge_id && !getChallenge(b.challenge_id)) throw err("Unknown practice problem.", 400);
  ensureProfile(ctx.store, b.author_id);
  const sp = spoilerCheck(`${b.title}\n${b.body}`, b.challenge_id);
  const id = ctx.store.createPost({ author_id: b.author_id, kind: b.kind, title: b.title.trim(), body: b.body.trim(), challenge_id: b.challenge_id ?? null, spoiler: sp.spoiler });
  if (b.kind === "question") {
    const text = await mentorReply(ctx, { title: b.title, body: b.body, challenge_id: b.challenge_id ?? null, author_id: b.author_id });
    ctx.store.addReply({ post_id: id, author_id: MENTOR.id, body: text, spoiler: false, ai: true });
  }
  return { id, spoiler: sp.spoiler, spoiler_reason: sp.reason };
}

export function addReply(ctx: LearnCtx, postId: number, b: { author_id: string; body: string }) {
  const p = ctx.store.post(postId);
  if (!p) throw err("That post doesn't exist.", 404);
  const problem = validatePost({ body: b.body });
  if (problem) throw err(problem, 400);
  ensureProfile(ctx.store, b.author_id);
  const sp = spoilerCheck(b.body, p.challenge_id);
  const id = ctx.store.addReply({ post_id: postId, author_id: b.author_id, body: b.body.trim(), spoiler: sp.spoiler });
  return { id, spoiler: sp.spoiler, spoiler_reason: sp.reason };
}

export function acceptReply(store: LayerflowStore, postId: number, b: { actor_id: string; reply_id: number | null }) {
  const p = store.post(postId);
  if (!p) throw err("That post doesn't exist.", 404);
  const actor = store.profile(b.actor_id);
  if (p.author_id !== b.actor_id && actor?.role !== "teacher") throw err("Only the person who asked (or a teacher) can mark the answer.", 403);
  if (b.reply_id !== null && !p.replies.some((r) => r.id === b.reply_id)) throw err("That reply isn't in this thread.", 400);
  store.acceptReply(postId, b.reply_id);
  return { ok: true };
}

export function people(store: LayerflowStore) {
  const learners = new Map(store.learners().map((l) => [l.id, l]));
  const profiles = store.profiles();
  const teachers = profiles.filter((p) => p.role === "teacher");
  const students = profiles
    .filter((p) => p.role === "student" && !HIDE.test(p.id))
    .map((p) => ({ ...p, submissions: learners.get(p.id)?.submissions ?? 0, passes: learners.get(p.id)?.passes ?? 0 }));
  return { mentor: MENTOR, teachers, students, stats: store.communityStats() };
}

/** For teachers: who needs help right now, and with what. */
export function teacherDesk(store: LayerflowStore) {
  const open = store.posts({ kind: "question", limit: 200 }).filter((p) => p.teacher_replies === 0 && p.accepted_reply_id === null);
  const rows = store
    .learners()
    .filter((l) => !HIDE.test(l.id) && l.submissions > 0)
    .map((l) => {
      const history = store.history(l.id);
      const r = rollup(history);
      const byChallenge = new Map<string, { passed: boolean; at: string }>();
      for (const h of history) byChallenge.set(h.challenge_id, { passed: h.passed, at: h.at });
      const stuck = [...byChallenge.entries()].filter(([, v]) => !v.passed).map(([cid]) => ({ challenge_id: cid, title: getChallenge(cid)?.title ?? cid }));
      const questions = open.filter((p) => p.author_id === l.id).length;
      const need = r.recurring.length * 3 + stuck.length * 2 + questions * 2;
      return {
        learner_id: l.id,
        name: displayName(store, l.id),
        submissions: l.submissions,
        pass_rate: l.submissions ? Math.round((l.passes / l.submissions) * 100) : 0,
        last_at: l.last_at,
        recurring: r.recurring.map((t: MistakeTag) => ({ tag: t, label: tagLabel(t), where: r.where[t] })),
        stuck_on: stuck,
        open_questions: questions,
        need,
        suggestion: r.recurring[0]
          ? `Keeps hitting “${tagLabel(r.recurring[0]).toLowerCase()}” (in ${r.where[r.recurring[0]].length} problems). A 5-minute chat about ${TAG_LABELS[r.recurring[0]].toLowerCase().includes("boundary") ? "edge values" : "this pattern"} would help.`
          : stuck[0]
            ? `Stuck on ${stuck[0].title} — a nudge from you could unblock it.`
            : "Doing well — a word of encouragement goes a long way.",
      };
    })
    .sort((a, b) => b.need - a.need);
  return { students: rows, open_questions: open.map((p) => ({ id: p.id, title: p.title, author_name: p.author_name, challenge_id: p.challenge_id, created_at: p.created_at })) };
}

