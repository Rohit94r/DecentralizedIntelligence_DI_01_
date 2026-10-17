/**
 * HTTP routes for Rewards (streak · points · redeem), Bug Bounty, payments
 * (Razorpay checkout, verification + webhook), plans and the small admin desk.
 * Thin on purpose: validate the request, call one service, reply.
 */
import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { RedemptionStatus } from "@layerflow/db";
import {
  completeDemoPayment,
  createProgram,
  explainer,
  fileReport,
  getProgram,
  handleWebhook,
  listPrograms,
  myReports,
  nudge,
  retryCheckout,
  triage,
  verifyCheckout,
  type BountyCtx,
  type CreateProgramBody,
} from "./bounty.ts";
import { displayName } from "./learning.ts";
import { checkKey, checkoutMode, paymentsEnabled, razorpayConfig, verifyWebhook } from "./lib/razorpay.ts";
import { contactSales, planOf, plansView, startProCheckout } from "./plans.ts";
import { adminRedemptions, adminUpdateRedemption, cancelRedemption, payoutMode, redeem, rewardsPage, rewardsSummary, setPin, type RedeemBody } from "./rewards.ts";

const ID = { type: "string", pattern: "^[A-Za-z0-9_.-]{2,40}$" } as const;
const PIN = { type: "string", maxLength: 6 } as const;
const SEV = { type: "string", enum: ["critical", "high", "medium", "low"] } as const;

/**
 * Admin actions need LAYERFLOW_ADMIN_TOKEN in the x-admin-token header. With no
 * token configured they're open (demo mode) — the admin page says so loudly.
 */
function admin(req: FastifyRequest): { ok: boolean; open: boolean } {
  const token = process.env.LAYERFLOW_ADMIN_TOKEN;
  if (!token) return { ok: true, open: true };
  const got = Buffer.from(String(req.headers["x-admin-token"] ?? ""));
  const want = Buffer.from(token);
  return { ok: got.length === want.length && timingSafeEqual(got, want), open: false };
}

function requireAdmin(req: FastifyRequest) {
  if (!admin(req).ok) throw Object.assign(new Error("Admin token required."), { statusCode: 401 });
}

export function registerRewardRoutes(app: FastifyInstance, ctx: BountyCtx) {
  const { store } = ctx;

  /* ── rewards ── */
  app.get<{ Params: { id: string } }>("/api/rewards/:id", { schema: { params: { type: "object", properties: { id: ID } } } }, async (req) => rewardsPage(store, req.params.id));
  app.get<{ Params: { id: string } }>("/api/rewards/:id/summary", { schema: { params: { type: "object", properties: { id: ID } } } }, async (req) => ({ ...rewardsSummary(store, req.params.id), plan: planOf(store, req.params.id).plan }));

  app.post<{ Body: { learner_id: string; pin: string } }>(
    "/api/rewards/pin",
    { schema: { body: { type: "object", required: ["learner_id", "pin"], properties: { learner_id: ID, pin: PIN } } } },
    async (req) => setPin(store, req.body.learner_id, req.body.pin),
  );

  app.post<{ Body: RedeemBody }>(
    "/api/rewards/redeem",
    {
      schema: {
        body: {
          type: "object",
          required: ["learner_id", "pin", "kind"],
          properties: {
            learner_id: ID,
            pin: PIN,
            kind: { type: "string", enum: ["cash", "goodie"] },
            points: { type: "integer", minimum: 1, maximum: 10_000_000 },
            upi_id: { type: "string", maxLength: 120 },
            item_id: { type: "string", maxLength: 40 },
            size: { type: "string", maxLength: 8 },
            shipping: {
              type: "object",
              properties: {
                name: { type: "string", maxLength: 80 },
                phone: { type: "string", maxLength: 20 },
                address: { type: "string", maxLength: 300 },
                city: { type: "string", maxLength: 60 },
                pincode: { type: "string", maxLength: 10 },
              },
            },
          },
        },
      },
    },
    async (req) => redeem(store, req.body),
  );

  app.post<{ Params: { id: string }; Body: { learner_id: string; pin: string } }>(
    "/api/rewards/redemptions/:id/cancel",
    { schema: { body: { type: "object", required: ["learner_id", "pin"], properties: { learner_id: ID, pin: PIN } } } },
    async (req) => cancelRedemption(store, req.params.id, req.body.learner_id, req.body.pin),
  );

  /* ── bug bounty ── */
  app.get<{ Querystring: { viewer?: string } }>("/api/bounty/programs", async (req) => listPrograms(store, req.query.viewer ?? ""));
  app.get<{ Params: { id: string }; Querystring: { viewer?: string } }>("/api/bounty/programs/:id", async (req) => getProgram(store, req.params.id, req.query.viewer ?? ""));
  app.get<{ Querystring: { learner_id?: string } }>("/api/bounty/reports", async (req) => ({ reports: req.query.learner_id ? myReports(store, req.query.learner_id) : [] }));
  app.get<{ Querystring: { lang?: string } }>("/api/bounty/explainer", async (req) => explainer(ctx, req.query.lang ?? "en"));

  app.post<{ Body: Parameters<typeof fileReport>[1] }>(
    "/api/bounty/reports",
    {
      schema: {
        body: {
          type: "object",
          required: ["program_id", "learner_id", "title", "category", "severity", "description"],
          properties: {
            program_id: { type: "string", maxLength: 40 },
            learner_id: ID,
            title: { type: "string", maxLength: 140 },
            category: { type: "string", maxLength: 40 },
            severity: SEV,
            file: { type: ["string", "null"], maxLength: 200 },
            line: { type: ["integer", "null"], minimum: 1, maximum: 100_000 },
            description: { type: "string", maxLength: 6000 },
            steps: { type: ["string", "null"], maxLength: 4000 },
            impact: { type: ["string", "null"], maxLength: 2000 },
            fix: { type: ["string", "null"], maxLength: 2000 },
          },
        },
      },
    },
    async (req) => fileReport(ctx, req.body),
  );

  app.post<{ Body: { learner_id: string; program_id: string } }>(
    "/api/bounty/nudge",
    { schema: { body: { type: "object", required: ["learner_id", "program_id"], properties: { learner_id: ID, program_id: { type: "string", maxLength: 40 } } } } },
    async (req) => nudge(store, req.body.learner_id, req.body.program_id),
  );

  const list = { type: "array", maxItems: 20, items: { type: "string", maxLength: 200 } } as const;
  app.post<{ Body: CreateProgramBody }>(
    "/api/bounty/programs",
    {
      schema: {
        body: {
          type: "object",
          required: ["owner_id", "pin", "kind", "company", "title", "summary", "scope", "rewards", "plan"],
          properties: {
            owner_id: ID,
            pin: PIN,
            kind: { type: "string", enum: ["company", "open_source"] },
            company: { type: "string", maxLength: 80 },
            title: { type: "string", maxLength: 120 },
            summary: { type: "string", maxLength: 1500 },
            repo_url: { type: ["string", "null"], maxLength: 200 },
            website: { type: ["string", "null"], maxLength: 200 },
            scope: list,
            out_of_scope: list,
            rewards: {
              type: "object",
              required: ["critical", "high", "medium", "low"],
              properties: { critical: { type: "integer" }, high: { type: "integer" }, medium: { type: "integer" }, low: { type: "integer" } },
            },
            plan: { type: "string", enum: ["community", "starter", "growth"] },
            return_base: { type: "string", maxLength: 200 },
          },
        },
      },
    },
    async (req) => createProgram(ctx, { ...req.body, out_of_scope: req.body.out_of_scope ?? [] }),
  );

  app.post<{ Params: { id: string }; Body: { owner_id: string; pin: string } }>(
    "/api/bounty/programs/:id/checkout",
    { schema: { body: { type: "object", required: ["owner_id", "pin"], properties: { owner_id: ID, pin: PIN, return_base: { type: "string", maxLength: 200 } } } } },
    async (req) => retryCheckout(ctx, req.params.id, req.body.owner_id, req.body.pin),
  );

  app.post<{ Params: { id: string }; Body: { actor_id: string; pin: string; status: "valid" | "duplicate" | "needs_info" | "invalid"; final_severity?: "critical" | "high" | "medium" | "low"; note?: string } }>(
    "/api/bounty/reports/:id/triage",
    {
      schema: {
        body: {
          type: "object",
          required: ["actor_id", "pin", "status"],
          properties: { actor_id: ID, pin: PIN, status: { type: "string", enum: ["valid", "duplicate", "needs_info", "invalid"] }, final_severity: SEV, note: { type: "string", maxLength: 1000 } },
        },
      },
    },
    async (req) => triage(ctx, req.params.id, req.body),
  );

  /* ── payments (Razorpay) ── */
  const paymentsStatus = async () => {
    const k = await checkKey();
    return { provider: "razorpay" as const, enabled: paymentsEnabled(), ready: k.ok, message: k.message, mode: paymentsEnabled() ? razorpayConfig().mode : null, webhook: !!razorpayConfig().webhookSecret, checkout: await checkoutMode() };
  };
  app.get("/api/payments/status", paymentsStatus);

  app.post<{ Body: { payment: string; owner_id: string } }>(
    "/api/payments/demo/complete",
    { schema: { body: { type: "object", required: ["payment", "owner_id"], properties: { payment: { type: "string", maxLength: 40 }, owner_id: ID } } } },
    async (req) => completeDemoPayment(ctx, req.body.payment, req.body.owner_id),
  );

  // Razorpay Checkout's success handler → verified here before anything unlocks
  app.post<{ Body: { payment: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } }>(
    "/api/payments/razorpay/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["payment", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature"],
          properties: { payment: { type: "string", maxLength: 40 }, razorpay_order_id: { type: "string", maxLength: 60 }, razorpay_payment_id: { type: "string", maxLength: 60 }, razorpay_signature: { type: "string", maxLength: 128 } },
        },
      },
    },
    async (req) => verifyCheckout(ctx, req.body),
  );

  // Razorpay signs the exact bytes — so this one route keeps the raw body.
  app.register(async (sub) => {
    sub.removeContentTypeParser("application/json");
    sub.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => done(null, body));
    sub.post("/api/payments/razorpay/webhook", async (req, reply) => {
      const raw = typeof req.body === "string" ? req.body : "";
      const sig = req.headers["x-razorpay-signature"];
      if (!verifyWebhook(raw, Array.isArray(sig) ? sig[0] : sig)) {
        ctx.log?.("[payments] webhook rejected: bad or missing signature");
        return reply.status(401).send({ error: "bad signature" });
      }
      let event: Parameters<typeof handleWebhook>[1];
      try {
        event = JSON.parse(raw);
      } catch {
        return reply.status(400).send({ error: "bad JSON" });
      }
      // Razorpay retries: process each event id once
      const eventId = String(req.headers["x-razorpay-event-id"] ?? "") || `${event.event}:${event.payload?.payment?.entity?.id ?? ""}`;
      if (!store.firstWebhook(eventId, String(event.event ?? ""))) return { ok: true, duplicate: true };
      return handleWebhook(ctx, event);
    });
  });

  /* ── plans: Free · Pro ($4 / ₹349 a month) · Custom ── */
  app.get<{ Querystring: { learner_id?: string } }>("/api/plans", async (req) => plansView(store, req.query.learner_id));

  app.post<{ Body: { learner_id: string; currency: "USD" | "INR" } }>(
    "/api/plans/checkout",
    { schema: { body: { type: "object", required: ["learner_id", "currency"], properties: { learner_id: ID, currency: { type: "string", enum: ["USD", "INR"] }, return_base: { type: "string", maxLength: 200 } } } } },
    async (req) => startProCheckout(ctx, req.body),
  );

  // "Talk to us" for the Custom plan — a few per hour per visitor is plenty
  const contactHits = new Map<string, number[]>();
  app.post<{ Body: { name: string; email: string; organisation: string; kind: string; seats?: number | null; message?: string | null; learner_id?: string | null } }>(
    "/api/plans/contact",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "email", "organisation", "kind"],
          properties: {
            name: { type: "string", maxLength: 80 },
            email: { type: "string", maxLength: 254 },
            organisation: { type: "string", maxLength: 120 },
            kind: { type: "string", enum: ["college", "company", "other"] },
            seats: { type: ["integer", "null"], minimum: 1, maximum: 100000 },
            message: { type: ["string", "null"], maxLength: 2000 },
            learner_id: { type: ["string", "null"], maxLength: 40 },
          },
        },
      },
    },
    async (req, reply) => {
      const now = Date.now();
      const recent = (contactHits.get(req.ip) ?? []).filter((t) => now - t < 3_600_000);
      if (recent.length >= 5) return reply.status(429).send({ error: "We've got your requests — we'll be in touch soon." });
      contactHits.set(req.ip, [...recent, now]);
      return contactSales(store, req.body);
    },
  );

  /* ── admin desk ── */
  app.get("/api/admin/leads", async (req) => {
    requireAdmin(req);
    return { leads: store.leads(200) };
  });

  app.post<{ Params: { id: string }; Body: { status: "new" | "contacted" | "won" | "lost" } }>(
    "/api/admin/leads/:id",
    { schema: { body: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["new", "contacted", "won", "lost"] } } } } },
    async (req, reply) => {
      requireAdmin(req);
      if (!store.setLeadStatus(req.params.id, req.body.status)) return reply.status(404).send({ error: "No such request." });
      return { ok: true };
    },
  );

  app.get("/api/admin/status", async (req) => {
    const a = admin(req);
    return { ok: a.ok, open: a.open, payouts: payoutMode(), payments: await paymentsStatus() };
  });

  app.get<{ Querystring: { status?: string } }>("/api/admin/redemptions", async (req) => {
    requireAdmin(req);
    return { redemptions: adminRedemptions(store, req.query.status) };
  });

  app.post<{ Params: { id: string }; Body: { status: RedemptionStatus; note?: string; payout_ref?: string } }>(
    "/api/admin/redemptions/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["status"],
          properties: { status: { type: "string", enum: ["approved", "paid", "shipped", "delivered", "rejected"] }, note: { type: "string", maxLength: 500 }, payout_ref: { type: "string", maxLength: 80 } },
        },
      },
    },
    async (req) => {
      requireAdmin(req);
      return adminUpdateRedemption(store, req.params.id, req.body);
    },
  );

  app.get("/api/admin/reports", async (req) => {
    requireAdmin(req);
    return {
      reports: store
        .reports({ limit: 500 })
        .filter((r) => (r.status === "triage" || r.status === "needs_info") && store.program(r.program_id))
        .map((r) => ({ ...r, bug_id: undefined, reporter_name: displayName(store, r.learner_id), program_title: store.program(r.program_id)!.title, company: store.program(r.program_id)!.company })),
    };
  });

  app.post<{ Params: { id: string }; Body: { status: "valid" | "duplicate" | "needs_info" | "invalid"; final_severity?: "critical" | "high" | "medium" | "low"; note?: string } }>(
    "/api/admin/reports/:id/triage",
    {
      schema: {
        body: {
          type: "object",
          required: ["status"],
          properties: { status: { type: "string", enum: ["valid", "duplicate", "needs_info", "invalid"] }, final_severity: SEV, note: { type: "string", maxLength: 1000 } },
        },
      },
    },
    async (req) => {
      requireAdmin(req);
      return triage(ctx, req.params.id, { ...req.body, admin: true });
    },
  );
}
