/**
 * Razorpay — Standard Checkout for the paid Bug Bounty plans and the Pro plan.
 *
 * Replaces Dodo Payments. Optional like every other key: with no Razorpay key in
 * .env the free Community plan still works and paid plans report that payments
 * aren't set up.
 *
 *   RAZORPAY_KEY_ID            rzp_test_… / rzp_live_…  (the PUBLIC half — safe to show)
 *   RAZORPAY_KEY_SECRET        the private half — NEVER commit, never log, never return
 *   RAZORPAY_WEBHOOK_SECRET    verifies POST /api/payments/razorpay/webhook
 *   RAZORPAY_MODE              test | live (only affects copy; the key decides the mode)
 *   RAZORPAY_PLAN_PRO_INR      monthly plan id from the dashboard
 *
 * ── How this differs from Dodo (important) ──────────────────────────────────
 * Razorpay has **no hosted checkout page and no product catalogue**:
 *
 *   1. We create an ORDER   → POST /v1/orders  (amount, currency, receipt, notes)
 *   2. The browser opens Checkout.js with { key, order_id, handler }
 *   3. On success Razorpay calls back with
 *        razorpay_payment_id · razorpay_order_id · razorpay_signature
 *   4. We verify that signature server-side with HMAC-SHA256 over
 *        `${razorpay_payment_id}|${razorpay_order_id}` keyed by the key secret
 *   5. Only then do we mark the payment succeeded.
 *
 * So there is no `checkout_url` to redirect to — the caller gets the order
 * details and mounts Checkout.js. `createCheckout()` therefore returns
 * `checkout_url: null` plus an `order` block ready for Checkout.js.
 *
 * Razorpay amounts are always in the **smallest currency unit** (paise for INR),
 * same as Dodo, so every price in the codebase carries over unchanged.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayMode = "test" | "live";

/** Order info the browser needs to mount Checkout.js. */
export interface RazorpayOrder {
  /** order id — pass as `order_id` to Checkout.js */
  id: string;
  amount: number;
  currency: string;
  /** the public key id — pass as `key` to Checkout.js */
  key_id: string;
  receipt: string;
  /** prefill + notes echoed back on the callback */
  notes?: Record<string, string>;
  prefill?: { name?: string; email?: string; contact?: string };
}

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID || undefined;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || undefined;
  // the key itself decides the mode; RAZORPAY_MODE only shapes our messages
  const mode: RazorpayMode = keyId?.startsWith("rzp_live_") || process.env.RAZORPAY_MODE === "live" ? "live" : "test";
  return {
    keyId,
    keySecret,
    mode,
    base: "https://api.razorpay.com/v1",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || undefined,
  };
}

export function paymentsEnabled(): boolean {
  const c = razorpayConfig();
  return !!(c.keyId && c.keySecret);
}

let keyCheck: { at: number; keyId: string; ok: boolean; message: string } | null = null;

/**
 * Does the key pair actually authenticate? A read-only GET /account, cached for
 * 10 minutes, so the admin desk can say "payments ready" honestly — a half-set
 * pair (id without secret, or a test id with a live secret) is the usual mistake.
 */
export async function checkKey(): Promise<{ ok: boolean; message: string }> {
  const c = razorpayConfig();
  if (!c.keyId) return { ok: false, message: "No RAZORPAY_KEY_ID in .env — paid plans are off; the free Community plan works." };
  if (!c.keySecret) return { ok: false, message: "RAZORPAY_KEY_ID is set but RAZORPAY_KEY_SECRET is missing — add both to .env." };
  if (keyCheck && keyCheck.keyId === c.keyId && Date.now() - keyCheck.at < 10 * 60_000) return keyCheck;
  const r = await fetch(`${c.base}/account`, { headers: authHeaders(), signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const ok = !!r?.ok;
  const message = ok
    ? c.mode === "live"
      ? "Razorpay is LIVE — checkout takes real money."
      : "Razorpay test mode is ready — use 4111 1111 1111 1111 with any future expiry and any CVV."
    : r?.status === 401
      ? "Razorpay rejected the key pair — check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are from the same mode (both test or both live)."
      : "Couldn't reach Razorpay to check the key.";
  keyCheck = { at: Date.now(), keyId: c.keyId, ok, message };
  return keyCheck;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const c = razorpayConfig();
  // Razorpay HTTP Basic auth: base64(key_id:key_secret)
  const basic = Buffer.from(`${c.keyId ?? ""}:${c.keySecret ?? ""}`).toString("base64");
  return { authorization: `Basic ${basic}`, "content-type": "application/json", accept: "application/json", ...extra };
}

export class RazorpayError extends Error {
  /** the message is written for the user — the API's error handler shows it */
  readonly expose = true;
  constructor(
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const c = razorpayConfig();
  if (!paymentsEnabled()) throw new RazorpayError("Payments aren't set up on this server yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.", 503);
  const r = await fetch(c.base + path, {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!r) throw new RazorpayError("Couldn't reach Razorpay — try again in a minute.");
  const text = await r.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    if (r.status === 401) throw new RazorpayError("Razorpay rejected the key pair — check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are both test or both live.");
    const err = (data as { error?: { description?: string; message?: string } } | null)?.error;
    const msg = err?.description || err?.message || text.slice(0, 200);
    throw new RazorpayError(`Razorpay said: ${msg || `HTTP ${r.status}`}`);
  }
  return data as T;
}

/* ────────────────────────────── checkout ────────────────────────────── */

/**
 * How a paid plan is checked out: Razorpay Standard Checkout when the key pair
 * works, otherwise a demo checkout that runs in the app and charges nothing.
 * LAYERFLOW_CHECKOUT=razorpay|demo forces one.
 *
 * ⚠️ The callers still compare the result against the literal "dodo". Once this
 * module replaces lib/dodo.ts those six comparisons must change to "razorpay".
 */
export async function checkoutMode(hasProduct = true): Promise<"razorpay" | "demo"> {
  const want = process.env.LAYERFLOW_CHECKOUT;
  if (want === "demo" || want === "razorpay") return want;
  if (!(await checkKey()).ok) return "demo";
  // orders are created ad hoc on Razorpay, so there is no product id to be missing
  return hasProduct ? "razorpay" : "demo";
}

/**
 * Create an ORDER the browser can pay. Amounts are in the smallest unit
 * (paise). `notes` is echoed back on the callback and on webhooks — we use it
 * to carry our internal payment id so a return can be matched.
 */
export async function createCheckout(c: {
  amount: number;
  currency: "INR" | "USD";
  receipt: string;
  return_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  prefill?: RazorpayOrder["prefill"];
  description?: string;
}): Promise<{ session_id: string; checkout_url: null; order: RazorpayOrder }> {
  const cfg = razorpayConfig();
  const notes: Record<string, string> = { return_url: c.return_url, cancel_url: c.cancel_url, ...(c.metadata ?? {}) };
  const r = await call<{ id: string; amount: number; currency: string; receipt: string; notes?: Record<string, string> }>(
    "POST",
    "/orders",
    {
      amount: c.amount,
      currency: c.currency,
      receipt: c.receipt,
      payment_capture: 1,
      notes,
      ...(c.description ? { notes: { ...notes, description: c.description } } : {}),
    },
  );
  if (!r?.id) throw new RazorpayError("Razorpay didn't return an order id.");
  return {
    session_id: r.id,
    checkout_url: null, // Razorpay has no hosted page — the browser mounts Checkout.js
    order: { id: r.id, amount: r.amount, currency: r.currency, key_id: cfg.keyId ?? "", receipt: r.receipt, notes: r.notes ?? notes, prefill: c.prefill },
  };
}

/**
 * Verify the Checkout.js callback signature.
 * HMAC-SHA256 over `${razorpay_payment_id}|${razorpay_order_id}` keyed by the
 * key secret, hex encoded, compared in constant time.
 *
 * THIS is the step that stops anyone from posting a fake "payment succeeded".
 */
export function verifyPaymentSignature(
  razorpayPaymentId: string,
  razorpayOrderId: string,
  signature: string,
): boolean {
  const c = razorpayConfig();
  if (!c.keySecret || !razorpayPaymentId || !razorpayOrderId || !signature) return false;
  const expected = createHmac("sha256", c.keySecret).update(`${razorpayPaymentId}|${razorpayOrderId}`).digest("hex");
  const got = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Webhooks: HMAC-SHA256 over the **raw** request body keyed by the webhook
 * secret, hex encoded, compared against the x-razorpay-signature header.
 * The raw body must be captured verbatim — re-serialised JSON will not match.
 */
export function verifyWebhook(raw: string, headers: Record<string, string | string[] | undefined>, secret = razorpayConfig().webhookSecret): boolean {
  if (!secret) return false;
  const h = headers["x-razorpay-signature"];
  const sig = Array.isArray(h) ? h[0] : h;
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const got = Buffer.from(sig, "utf8");
  const want = Buffer.from(expected, "utf8");
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ────────────────────────────── products/plans ────────────────────────────── */

/**
 * Razorpay has no product catalogue, so a "product" here is just a stable label
 * carried on the order. We keep the function so plan-creation code is unchanged.
 */
export function createProduct(p: { name: string; description: string; price_paise: number; sku: string }): Promise<string> {
  return Promise.resolve(p.sku);
}

/** Monthly plan id for the Pro tier, set once in the dashboard. */
export function configuredProPlan(currency: "USD" | "INR"): string | undefined {
  return process.env[`RAZORPAY_PLAN_PRO_${currency}`] || undefined;
}

/** Plan id for a paid Bug Bounty plan (starter / growth). */
export function configuredPlan(planId: string): string | undefined {
  return process.env[`RAZORPAY_PLAN_BOUNTY_${planId.toUpperCase()}`] || undefined;
}

/** Subscriptions in Razorpay need a Plan; created once in the dashboard. */
export function createSubscriptionProduct(p: { name: string; description: string; price: number; currency: "USD" | "INR"; sku: string }): Promise<string> {
  return Promise.resolve(configuredProPlan(p.currency) ?? p.sku);
}

/** Stop renewing at the end of the paid month (or undo that). */
export function setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean): Promise<unknown> {
  if (!/^[A-Za-z0-9_]{4,80}$/.test(subscriptionId)) throw new RazorpayError("That isn't a subscription id.", 400);
  return call("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { cancel_at_cycle_end: cancel });
}

/* ────────────────────────────── reads ────────────────────────────── */

/** Payment status mapped onto the vocabulary the rest of the app already uses. */
export interface RazorpayPayment {
  payment_id: string;
  status: "captured" | "authorized" | "failed" | "created" | "refunded";
  total_amount: number;
  currency: string;
  metadata: Record<string, string | number | boolean> | null;
  order_id?: string | null;
  invoice_id?: string | null;
  method?: string | null;
}

export async function getPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!/^[A-Za-z0-9_]{4,80}$/.test(paymentId)) throw new RazorpayError("That isn't a payment id.", 400);
  const r = await call<{ id: string; status?: string; amount?: number; currency?: string; notes?: Record<string, string>; order_id?: string; invoice_id?: string; method?: string }>(
    "GET",
    `/payments/${encodeURIComponent(paymentId)}`,
  );
  return {
    payment_id: r.id,
    status: (r.status as RazorpayPayment["status"]) ?? "created",
    total_amount: r.amount ?? 0,
    currency: r.currency ?? "INR",
    metadata: (r.notes as Record<string, string>) ?? null,
    order_id: r.order_id ?? null,
    invoice_id: r.invoice_id ?? null,
    method: r.method ?? null,
  };
}

export async function getOrder(orderId: string): Promise<{ id: string; amount: number; currency: string; status: string; paid: boolean; notes: Record<string, string> }> {
  if (!/^[A-Za-z0-9_]{4,80}$/.test(orderId)) throw new RazorpayError("That isn't an order id.", 400);
  const r = await call<{ id: string; amount: number; currency: string; status?: string; paid?: boolean; notes?: Record<string, string> }>(
    "GET",
    `/orders/${encodeURIComponent(orderId)}`,
  );
  return {
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    status: r.status ?? "created",
    paid: !!r.paid,
    notes: r.notes ?? {},
  };
}

/** List the payments captured against an order — used to reconcile a return. */
export async function paymentsForOrder(orderId: string): Promise<RazorpayPayment[]> {
  if (!/^[A-Za-z0-9_]{4,80}$/.test(orderId)) throw new RazorpayError("That isn't an order id.", 400);
  const r = await call<{ items?: { payment?: { id: string; status?: string; amount?: number; currency?: string; notes?: Record<string, string>; order_id?: string; method?: string } }[] }>(
    "GET",
    `/orders/${encodeURIComponent(orderId)}/payments`,
  );
  return (r.items ?? [])
    .map((x) => x.payment)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      payment_id: p.id,
      status: (p.status as RazorpayPayment["status"]) ?? "created",
      total_amount: p.amount ?? 0,
      currency: p.currency ?? "INR",
      metadata: (p.notes as Record<string, string>) ?? null,
      order_id: p.order_id ?? orderId,
      method: p.method ?? null,
    }));
}

/**
 * Razorpay only takes money IN. It has no payout API, and its merchant policy
 * excludes physical goods — so cash-outs stay manual over UPI from /admin, the
 * same as before. Goodies are redeemed with points (see rewards.ts).
 */

/* ─────────────────────── legacy names (stable API surface) ─────────────────────── */
/* The payment consumers still import the old names; these aliases keep the swap to a
   single import-path change per file. Safe to delete once the callers are renamed. */
export const dodoConfig = razorpayConfig;
export const DodoError = RazorpayError;
export type DodoPayment = RazorpayPayment;
export type DodoMode = RazorpayMode;
export const configuredProduct = configuredPlan;
export const getCheckout = getOrder;