/**
 * Dodo Payments — hosted checkout for the paid Bug Bounty plans.
 *
 * Optional, like every key in Layerflow. Without DODO_PAYMENTS_API_KEY the
 * free Community plan still works and paid plans say payments aren't set up.
 *
 *   DODO_PAYMENTS_API_KEY         Bearer key (a test key only works in test mode;
 *                                 DODO_PAYLOAD_API_KEY / DODO_API_KEY are accepted too)
 *   DODO_PAYMENTS_ENVIRONMENT     test_mode (default) | live_mode — live means real money
 *   DODO_PAYMENTS_WEBHOOK_SECRET  whsec_… — verifies POST /api/payments/dodo/webhook
 *   DODO_PRODUCT_BOUNTY_STARTER / DODO_PRODUCT_BOUNTY_GROWTH
 *                                 product ids (pdt_…) for the paid plans
 *
 * A Dodo checkout needs a product. In test mode each plan's INR product is
 * created on first use and remembered in the dodo_products table; in live
 * mode Layerflow never creates products in your account — set the ids above.
 *
 * Dodo only takes money IN — it has no API that pays users out, and its
 * merchant policy excludes physical goods. So cash-outs are paid by an admin
 * over UPI and goodies are redeemed with points (see rewards.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type DodoMode = "test_mode" | "live_mode";

export function dodoConfig() {
  const mode: DodoMode = process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
  return {
    key: process.env.DODO_PAYMENTS_API_KEY || process.env.DODO_PAYLOAD_API_KEY || process.env.DODO_API_KEY || undefined,
    mode,
    base: mode === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com",
    webhookSecret: process.env.DODO_PAYMENTS_WEBHOOK_SECRET || undefined,
  };
}

export function paymentsEnabled(): boolean {
  return !!dodoConfig().key;
}

let keyCheck: { at: number; mode: DodoMode; key: string; ok: boolean; message: string } | null = null;

/**
 * Does the key actually work in the configured mode? A read-only call, cached
 * for 10 minutes, so the admin desk can say "payments ready" honestly — a live
 * key with test_mode (or the reverse) is the most common setup mistake.
 */
export async function checkKey(): Promise<{ ok: boolean; message: string }> {
  const c = dodoConfig();
  if (!c.key) return { ok: false, message: "No Dodo Payments key in .env — paid plans are off; the free Community plan works." };
  if (keyCheck && keyCheck.mode === c.mode && keyCheck.key === c.key && Date.now() - keyCheck.at < 10 * 60_000) return keyCheck;
  const r = await fetch(`${c.base}/products?page_size=1`, { headers: { authorization: `Bearer ${c.key}` }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const ok = !!r?.ok;
  const other = c.mode === "test_mode" ? "live_mode" : "test_mode";
  const message = ok
    ? c.mode === "live_mode"
      ? "Dodo Payments is LIVE — checkouts take real money."
      : "Dodo Payments test mode is ready — use test cards / success@upi."
    : r?.status === 401
      ? `The key isn't valid for ${c.mode}. If it's a ${other.replace("_mode", "")} key, set DODO_PAYMENTS_ENVIRONMENT=${other} in .env (live means real money).`
      : "Couldn't reach Dodo Payments to check the key.";
  keyCheck = { at: Date.now(), mode: c.mode, key: c.key, ok, message };
  return keyCheck;
}

/**
 * How a paid plan is checked out: Dodo's hosted checkout when the key works,
 * otherwise a demo checkout that runs in the app and charges nothing.
 * LAYERFLOW_CHECKOUT=dodo|demo forces one.
 */
export async function checkoutMode(hasProduct = true): Promise<"dodo" | "demo"> {
  const want = process.env.LAYERFLOW_CHECKOUT;
  if (want === "demo" || want === "dodo") return want;
  if (!(await checkKey()).ok) return "demo";
  // live mode never creates products by itself: without a product id in .env the demo checkout stands in
  return hasProduct || dodoConfig().mode === "test_mode" ? "dodo" : "demo";
}

/** Product id for a paid plan: from .env, or (test mode only) created on first use. */
export function configuredProduct(planId: string): string | undefined {
  return process.env[`DODO_PRODUCT_BOUNTY_${planId.toUpperCase()}`] || undefined;
}

export class DodoError extends Error {
  /** the message is written for the user — the API's error handler shows it */
  readonly expose = true;
  constructor(
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const c = dodoConfig();
  if (!c.key) throw new DodoError("Payments aren't set up on this server yet — add DODO_PAYMENTS_API_KEY to .env.", 503);
  const r = await fetch(c.base + path, {
    method,
    headers: { authorization: `Bearer ${c.key}`, "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!r) throw new DodoError("Couldn't reach Dodo Payments — try again in a minute.");
  const text = await r.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    if (r.status === 401) throw new DodoError(`Dodo Payments rejected the API key — check DODO_PAYMENTS_API_KEY and that DODO_PAYMENTS_ENVIRONMENT (${c.mode}) matches the key.`);
    const msg = (data as { message?: string } | null)?.message ?? text.slice(0, 200);
    throw new DodoError(`Dodo Payments said: ${msg || `HTTP ${r.status}`}`);
  }
  return data as T;
}

/** A one-time INR product. `price_paise` is in the smallest unit: 199900 = ₹1,999. */
export async function createProduct(p: { name: string; description: string; price_paise: number; sku: string }): Promise<string> {
  const r = await call<{ product_id: string }>("POST", "/products", {
    name: p.name,
    description: p.description,
    tax_category: "saas",
    price: { type: "one_time_price", currency: "INR", price: p.price_paise, discount_bps: 0, purchasing_power_parity: false, tax_inclusive: true },
    metadata: { sku: p.sku },
  });
  if (!r?.product_id) throw new DodoError("Dodo Payments didn't return a product id.");
  return r.product_id;
}

/**
 * A monthly subscription product (Pro). `price` is in the smallest unit:
 * 400 = $4.00, 34900 = ₹349. Only test mode creates products by itself;
 * live products are made once (scripts or the dashboard) and set in .env.
 */
export async function createSubscriptionProduct(p: { name: string; description: string; price: number; currency: "USD" | "INR"; sku: string }): Promise<string> {
  const r = await call<{ product_id: string }>("POST", "/products", {
    name: p.name,
    description: p.description,
    tax_category: "saas",
    price: {
      type: "recurring_price",
      currency: p.currency,
      price: p.price,
      discount: 0,
      purchasing_power_parity: false,
      tax_inclusive: true, // the price on the site is the price people pay
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 10,
      subscription_period_interval: "Year",
      trial_period_days: 0,
    },
    metadata: { sku: p.sku },
  });
  if (!r?.product_id) throw new DodoError("Dodo Payments didn't return a product id.");
  return r.product_id;
}

/** The live (or test) product id set in .env for the monthly Pro plan in this currency. */
export function configuredProProduct(currency: "USD" | "INR"): string | undefined {
  return process.env[`DODO_PRODUCT_PRO_${currency}`] || undefined;
}

/** Stop renewing at the end of the paid month (or undo that). */
export function setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean): Promise<unknown> {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(subscriptionId)) throw new DodoError("That isn't a subscription id.", 400);
  return call("PATCH", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_next_billing_date: cancel });
}

/** A hosted checkout session. The customer comes back to return_url?payment_id=…&status=… */
export async function createCheckout(c: { product_id: string; return_url: string; cancel_url: string; metadata: Record<string, string>; country?: string | null }): Promise<{ session_id: string; checkout_url: string }> {
  const country = c.country === undefined ? "IN" : c.country;
  const r = await call<{ session_id: string; checkout_url: string | null }>("POST", "/checkouts", {
    product_cart: [{ product_id: c.product_id, quantity: 1 }],
    ...(country ? { billing_address: { country } } : {}),
    return_url: c.return_url,
    cancel_url: c.cancel_url,
    metadata: c.metadata,
  });
  if (!r?.session_id || !r.checkout_url) throw new DodoError("Dodo Payments didn't return a checkout link.");
  return { session_id: r.session_id, checkout_url: r.checkout_url };
}

export interface DodoPayment {
  payment_id: string;
  status: string | null;
  total_amount: number;
  currency: string;
  metadata: Record<string, string | number | boolean> | null;
  checkout_session_id?: string | null;
  /** set on payments that start or renew a subscription */
  subscription_id?: string | null;
}

export function getPayment(paymentId: string): Promise<DodoPayment> {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(paymentId)) throw new DodoError("That isn't a payment id.", 400);
  return call<DodoPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);
}

export function getCheckout(sessionId: string): Promise<{ id: string; payment_id: string | null; payment_status: string | null }> {
  return call("GET", `/checkouts/${encodeURIComponent(sessionId)}`);
}

/**
 * Standard Webhooks: HMAC-SHA256 over `${webhook-id}.${webhook-timestamp}.${raw body}`
 * with the base64 key after "whsec_", base64-encoded, sent as space-separated
 * "v1,<sig>" values; timestamps older than 5 minutes are rejected.
 */
export function verifyWebhook(raw: string, headers: Record<string, string | string[] | undefined>, secret = dodoConfig().webhookSecret, now = Date.now()): boolean {
  if (!secret) return false;
  const h = (k: string) => {
    const v = headers[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const id = h("webhook-id");
  const ts = h("webhook-timestamp");
  const sig = h("webhook-signature");
  if (!id || !ts || !sig || !/^\d+$/.test(ts)) return false;
  if (Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest();
  return sig.split(" ").some((part) => {
    const [v, s] = part.split(",");
    const got = Buffer.from(s ?? "", "base64");
    return v === "v1" && got.length === expected.length && timingSafeEqual(got, expected);
  });
}
