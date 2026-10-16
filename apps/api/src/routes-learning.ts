/**
 * HTTP routes for Mentoring, voice, "Ask Priya", Repo Analyse and Community.
 * Thin on purpose: read the request, call one service in learning.ts, reply.
 */
import type { FastifyInstance } from "fastify";
import { MENTOR, POST_KINDS, listedChallenges } from "@layerflow/core";
import type { Ai } from "./lib/ai.ts";
import { synthesize, transcribe, voiceStatus } from "./lib/voice.ts";
import {
  acceptReply,
  addReply,
  analyze,
  chat,
  createPost,
  ensureProfile,
  getThread,
  listPosts,
  mentorOverview,
  mentorSession,
  people,
  teacherDesk,
  type ChatBody,
  type LearnCtx,
} from "./learning.ts";

const ID = { type: "string", pattern: "^[A-Za-z0-9_.-]{2,40}$" } as const;

export function registerLearningRoutes(app: FastifyInstance, ctx: LearnCtx, ai: Ai | null) {
  const log = ctx.log ?? (() => {});

  /* ── voice ── */
  app.get("/api/voice/status", async () => ({ ...voiceStatus(), chat: ai ? ai.label : "built-in", providers: ai?.providers ?? [], mentor: MENTOR }));

  app.post<{ Body: { text: string } }>(
    "/api/voice/tts",
    { schema: { body: { type: "object", required: ["text"], properties: { text: { type: "string", minLength: 1, maxLength: 1200 } } } } },
    async (req, reply) => {
      const audio = await synthesize(req.body.text, log);
      if (!audio) return reply.status(204).send();
      return reply.type("audio/mpeg").send(audio);
    },
  );

  // raw audio body (webm / ogg / mp4 / wav) from the browser's MediaRecorder
  app.addContentTypeParser(/^audio\/|^application\/octet-stream/, { parseAs: "buffer", bodyLimit: 8 * 1024 * 1024 }, (_req, body, done) => done(null, body));
  app.post("/api/voice/stt", { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf)) return reply.status(400).send({ error: "Send the recording as the raw request body." });
    const text = await transcribe(buf, String(req.headers["content-type"] ?? "audio/webm"), log);
    if (text === null) return reply.status(204).send();
    return { text };
  });

  /* ── Mentoring ── */
  app.get<{ Params: { id: string } }>("/api/mentor/:id", { schema: { params: { type: "object", properties: { id: ID } } } }, async (req) => mentorOverview(ctx.store, req.params.id));

  app.post<{ Body: { learner_id: string; challenge_id: string; lang?: string } }>(
    "/api/mentor/session",
    {
      schema: {
        body: { type: "object", required: ["learner_id", "challenge_id"], properties: { learner_id: ID, challenge_id: { type: "string", maxLength: 64 }, lang: { type: "string", enum: ["en", "hi", "mr"] } } },
      },
    },
    async (req) => mentorSession(ctx, req.body.learner_id, req.body.challenge_id, req.body.lang ?? "en"),
  );

  /* ── Ask Priya ── */
  app.post<{ Body: ChatBody }>(
    "/api/chat",
    {
      schema: {
        body: {
          type: "object",
          required: ["message"],
          properties: {
            learner_id: { type: "string", maxLength: 40 },
            lang: { type: "string", enum: ["en", "hi", "mr"] },
            message: { type: "string", minLength: 1, maxLength: 1200 },
            history: { type: "array", maxItems: 30, items: { type: "object", properties: { role: { type: "string" }, content: { type: "string", maxLength: 4000 } } } },
            context: {
              type: "object",
              properties: { page: { type: "string", maxLength: 40 }, challenge_id: { type: "string", maxLength: 64 }, code: { type: "string", maxLength: 20000 }, repo_report_id: { type: "string", maxLength: 16 } },
            },
          },
        },
      },
    },
    async (req) => chat(ctx, req.body),
  );

  /* ── Repo Analyse ── */
  app.post<{ Body: { url?: string; local?: boolean; learner_id?: string } }>(
    "/api/repo/analyze",
    { schema: { body: { type: "object", properties: { url: { type: "string", maxLength: 300 }, local: { type: "boolean" }, learner_id: { type: "string", maxLength: 40 } } } } },
    async (req) => analyze(ctx, req.body),
  );
  app.get<{ Querystring: { learner_id?: string } }>("/api/repo/reports", async (req) => ({ reports: ctx.store.repoReports(req.query.learner_id) }));
  app.get<{ Params: { id: string } }>("/api/repo/reports/:id", async (req, reply) => {
    const r = ctx.store.repoReport(req.params.id);
    if (!r) return reply.status(404).send({ error: "No such report" });
    return { id: r.id, created_at: r.created_at, ...(r.report as object) };
  });

  /* ── Community ── */
  app.get("/api/community/meta", async () => ({
    kinds: POST_KINDS,
    challenges: listedChallenges().map((c) => ({ id: c.id, title: c.title })),
    mentor: MENTOR,
  }));

  app.get<{ Querystring: { viewer?: string; kind?: string; challenge_id?: string; q?: string; author_id?: string } }>("/api/community/posts", async (req) => {
    const posts = listPosts(ctx.store, { ...req.query, q: req.query.q?.slice(0, 80) });
    // who replied (names, roles, avatars — never reply bodies, so spoilers stay blurred)
    const authors = ctx.store.replyAuthorsFor(posts.map((p) => p.id));
    return { posts: posts.map((p) => ({ ...p, replies_lite: authors.get(p.id) ?? [] })), stats: ctx.store.communityStats() };
  });

  app.get<{ Params: { id: string }; Querystring: { viewer?: string } }>("/api/community/posts/:id", async (req) => getThread(ctx.store, Number(req.params.id), req.query.viewer ?? ""));

  app.post<{ Body: { author_id: string; kind: string; title: string; body: string; challenge_id?: string | null } }>(
    "/api/community/posts",
    {
      schema: {
        body: {
          type: "object",
          required: ["author_id", "kind", "title", "body"],
          properties: {
            author_id: ID,
            kind: { type: "string", enum: ["question", "discussion", "tip", "showcase"] },
            title: { type: "string", maxLength: 140 },
            body: { type: "string", maxLength: 6000 },
            challenge_id: { type: ["string", "null"], maxLength: 64 },
          },
        },
      },
    },
    async (req) => createPost(ctx, req.body),
  );

  app.post<{ Params: { id: string }; Body: { author_id: string; body: string } }>(
    "/api/community/posts/:id/replies",
    { schema: { body: { type: "object", required: ["author_id", "body"], properties: { author_id: ID, body: { type: "string", maxLength: 6000 } } } } },
    async (req) => addReply(ctx, Number(req.params.id), req.body),
  );

  app.post<{ Params: { id: string }; Body: { actor_id: string; reply_id: number | null } }>(
    "/api/community/posts/:id/accept",
    { schema: { body: { type: "object", required: ["actor_id", "reply_id"], properties: { actor_id: ID, reply_id: { type: ["integer", "null"] } } } } },
    async (req) => acceptReply(ctx.store, Number(req.params.id), req.body),
  );

  app.post<{ Body: { voter_id: string; target: "post" | "reply"; id: number; value: 1 | -1 | 0 } }>(
    "/api/community/vote",
    {
      schema: {
        body: {
          type: "object",
          required: ["voter_id", "target", "id", "value"],
          properties: { voter_id: ID, target: { type: "string", enum: ["post", "reply"] }, id: { type: "integer" }, value: { type: "integer", enum: [-1, 0, 1] } },
        },
      },
    },
    async (req) => {
      ensureProfile(ctx.store, req.body.voter_id);
      return { score: ctx.store.vote(req.body.voter_id, req.body.target, req.body.id, req.body.value) };
    },
  );

  app.get("/api/community/people", async () => people(ctx.store));
  app.get("/api/community/teacher-desk", async () => teacherDesk(ctx.store));

  app.get<{ Params: { id: string } }>("/api/profile/:id", { schema: { params: { type: "object", properties: { id: ID } } } }, async (req) => ensureProfile(ctx.store, req.params.id));
  app.post<{ Body: { id: string; display_name?: string; role?: "student" | "teacher"; bio?: string } }>(
    "/api/profile",
    {
      schema: {
        body: {
          type: "object",
          required: ["id"],
          properties: { id: ID, display_name: { type: "string", minLength: 1, maxLength: 40 }, role: { type: "string", enum: ["student", "teacher"] }, bio: { type: "string", maxLength: 200 } },
        },
      },
    },
    async (req) => {
      const cur = ensureProfile(ctx.store, req.body.id);
      if (cur.role === "mentor_ai") throw Object.assign(new Error("The AI mentor's profile can't be edited."), { statusCode: 403 });
      ctx.store.upsertProfile({ id: cur.id, display_name: req.body.display_name ?? cur.display_name, role: req.body.role ?? cur.role, bio: req.body.bio ?? cur.bio });
      return ctx.store.profile(cur.id);
    },
  );
}
