/**
 * The server's edge — what one VPS needs to serve the WEBSITE and the APP from
 * the same API safely:
 *
 *   CORS        the website is same-origin (nginx / Next proxy /api), so it needs
 *               nothing. A web-based app on another origin (Expo web, Capacitor,
 *               app.yourdomain) is allowed only if listed in LAYERFLOW_CORS_ORIGINS.
 *               Native Android / iOS apps don't send Origin and need no CORS.
 *   real IPs    behind nginx every request comes from 127.0.0.1; Fastify's
 *               trustProxy ("loopback" by default) reads X-Forwarded-For instead.
 *   rate limits per device (IP) on the endpoints that cost money or CPU — AI,
 *               voice, the sandbox — so one script can't drain the keys or the box.
 *               Requests from the machine itself (harness, health checks) are exempt.
 *   reset       /api/dev/reset wipes everything: in production it needs
 *               LAYERFLOW_ALLOW_RESET=1 (a judging window) or the admin token.
 */
import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";

/** Fastify `trustProxy` value: only believe X-Forwarded-For from the local proxy (nginx / Next). */
export function trustProxySetting(): boolean | string {
  const v = process.env.LAYERFLOW_TRUST_PROXY;
  if (v === "off" || v === "false") return false;
  if (v === "true") return true;
  return v ?? "loopback";
}

const isLoopback = (ip: string) => ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

function corsOrigins(): Set<string> {
  return new Set(
    (process.env.LAYERFLOW_CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

/** POST routes that cost money (AI, voice) or CPU (the sandbox), grouped for per-IP limits. */
const GROUPS: { name: "ai" | "run"; env: string; perMinute: number; match: RegExp }[] = [
  { name: "ai", env: "LAYERFLOW_RATE_AI", perMinute: 60, match: /^\/api\/(chat|answer|mentor\/session|voice\/(tts|stt)|repo\/analyze|site\/analyze)\b/ },
  { name: "run", env: "LAYERFLOW_RATE_RUN", perMinute: 150, match: /^\/api\/(submit|hint|replay|bug-factory\/locate|bounty\/reports$)/ },
];

export function registerEdge(app: FastifyInstance): void {
  /* ── CORS (app origins only; the website is same-origin) ── */
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (!origin) return;
    const allowed = corsOrigins();
    if (!allowed.has(origin.replace(/\/$/, ""))) {
      if (req.method === "OPTIONS") return reply.status(204).send();
      return;
    }
    reply.header("access-control-allow-origin", origin);
    reply.header("vary", "Origin");
    reply.header("access-control-expose-headers", "retry-after");
    if (req.method === "OPTIONS") {
      reply.header("access-control-allow-methods", "GET, POST, OPTIONS");
      reply.header("access-control-allow-headers", "content-type, x-admin-token");
      reply.header("access-control-max-age", "600");
      return reply.status(204).send();
    }
  });

  /* ── per-device rate limits ── */
  const hits = new Map<string, number[]>();
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [k, ts] of hits) {
      const keep = ts.filter((t) => t > cutoff);
      if (keep.length) hits.set(k, keep);
      else hits.delete(k);
    }
  }, 60_000).unref();

  app.addHook("onRequest", async (req, reply) => {
    if (req.method !== "POST" || process.env.LAYERFLOW_RATE === "off") return;
    const url = req.url.split("?")[0];
    const g = GROUPS.find((x) => x.match.test(url));
    if (!g || isLoopback(req.ip)) return;
    const limit = Number(process.env[g.env] ?? g.perMinute);
    if (!(limit > 0)) return;
    const key = `${g.name}|${req.ip}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= limit) {
      const retry = Math.max(1, Math.ceil((60_000 - (now - recent[0])) / 1000));
      reply.header("retry-after", String(retry));
      return reply.status(429).send({ error: `Too many requests from this device — please wait ${retry} seconds and try again.` });
    }
    recent.push(now);
    hits.set(key, recent);
  });
}

/** May this request wipe the database? */
export function resetAllowed(req: FastifyRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.LAYERFLOW_ALLOW_RESET === "1") return true;
  const token = process.env.LAYERFLOW_ADMIN_TOKEN;
  if (!token) return false;
  const got = Buffer.from(String(req.headers["x-admin-token"] ?? ""));
  const want = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}
