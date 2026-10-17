/**
 * Razorpay — how money comes in (Pro and company bug-bounty plans).
 *
 *   1. our server creates an Order (amount, currency, our payment id in `notes`)
 *   2. the browser opens Razorpay Checkout with the order id and the Key ID —
 *      UPI, cards, netbanking and wallets, on Razorpay's own secure popup
 *   3. Checkout hands back razorpay_payment_id + razorpay_signature; the server
 *      checks HMAC_SHA256(order_id|payment_id, key secret) and asks Razorpay for
 *      the payment before anything is unlocked (and captures it if needed)
 *   4. webhooks (payment.captured / order.paid), signed with
 *      HMAC_SHA256(raw body, webhook secret), catch a payment whose tab closed early
 *
 * .env: RAZORPAY_KEY_ID (rzp_test_… or rzp_live_… — live takes real money),
 * RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET for the webhook.
 * Without a working key pair, checkout runs as a clearly-labelled demo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayMode = "test" | "live";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || undefined;
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || undefined;
  return {
    keyId,
    keySecret,
    mode: (keyId?.startsWith("rzp_live_") ? "live" : "test") as RazorpayMode,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || undefined,
  };
}

export function paymentsEnabled(): boolean {
  const c = razorpayConfig();
  return !!(c.keyId && c.keySecret);
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

let keyCheck: { at: number; id: string; ok: boolean; message: string } | null = null;

/** Does the key pair work? A read-only call, cached for 10 minutes. */
export async function checkKey(): Promise<{ ok: boolean; message: string }> {
  const c = razorpayConfig();
  if (!c.keySecret && !c.keyId) return { ok: false, message: "No Razorpay keys in .env — checkout runs in demo mode (nothing is charged)." };
  if (!c.keyId) return { ok: false, message: "RAZORPAY_KEY_ID is missing — add the Key ID (rzp_live_… or rzp_test_…) next to the secret in .env. Checkout runs in demo mode until then." };
  if (!c.keySecret) return { ok: false, message: "RAZORPAY_KEY_SECRET is missing in .env. Checkout runs in demo mode until then." };
  if (keyCheck && keyCheck.id === c.keyId && Date.now() - keyCheck.at < 10 * 60_000) return keyCheck;
  const r = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { authorization: auth() }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const ok = !!r?.ok;
  const message = ok
    ? c.mode === "live"
      ? "Razorpay is LIVE — payments take real money."
      : "Razorpay test mode is ready — no real money: pick Netbanking, any bank, then Success on Razorpay's test bank page."
    : r?.status === 401
      ? "Razorpay rejected the key pair — check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are from the same key."
      : "Couldn't reach Razorpay to check the keys.";
  keyCheck = { at: Date.now(), id: c.keyId, ok, message };
  return keyCheck;
}

/**
 * Razorpay Checkout when the keys work, otherwise the in-app demo checkout.
 * LAYERFLOW_CHECKOUT=razorpay|demo forces one.
 */
export async function checkoutMode(): Promise<"razorpay" | "demo"> {
  const want = process.env.LAYERFLOW_CHECKOUT;
  if (want === "demo" || want === "razorpay") return want;
  return (await checkKey()).ok ? "razorpay" : "demo";
}

function auth(): string {
  const c = razorpayConfig();
  return "Basic " + Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64");
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!paymentsEnabled()) throw new RazorpayError("Payments aren't set up on this server yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.", 503);
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { authorization: auth(), "content-type": "application/json", accept: "application/json" },
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
    if (r.status === 401) throw new RazorpayError("Razorpay rejected the API keys — check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    const msg = (data as { error?: { description?: string } } | null)?.error?.description ?? text.slice(0, 200);
    throw new RazorpayError(`Razorpay said: ${msg || `HTTP ${r.status}`}`, r.status >= 500 ? 502 : 400);
  }
  return data as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string | null;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
  method?: string;
  notes: Record<string, string> | unknown[];
}

/** `amount` is in the smallest unit: 34900 = ₹349, 400 = $4. */
export function createOrder(o: { amount: number; currency: "INR" | "USD"; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
  // payment_capture: 1 — capture automatically, so the money settles without a second call
  return call<RazorpayOrder>("POST", "/orders", { amount: o.amount, currency: o.currency, receipt: o.receipt.slice(0, 40), payment_capture: 1, notes: o.notes });
}

export function getPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!/^pay_[A-Za-z0-9]{6,40}$/.test(paymentId)) throw new RazorpayError("That isn't a Razorpay payment id.", 400);
  return call<RazorpayPayment>("GET", `/payments/${paymentId}`);
}

/** Accounts without auto-capture leave payments "authorized" — capture them so the money settles. */
export function capturePayment(paymentId: string, amount: number, currency: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>("POST", `/payments/${paymentId}/capture`, { amount, currency });
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Checkout's success handler: signature = HMAC_SHA256(order_id + "|" + payment_id, key secret)
 * — order id FIRST, as Razorpay documents it. (payment_id|order_id would reject every real payment.)
 */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = razorpayConfig().keySecret): boolean {
  if (!secret || !orderId || !paymentId || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return sameHex(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
}

/** Webhooks: X-Razorpay-Signature = HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhook(raw: string, signature: string | undefined, secret = razorpayConfig().webhookSecret): boolean {
  if (!secret || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return sameHex(createHmac("sha256", secret).update(raw).digest("hex"), signature);
}

/** What the browser needs to open Checkout for an order (the Key ID is public; the secret never leaves the server). */
export function checkoutOptions(order: RazorpayOrder, o: { description: string; notes: Record<string, string> }) {
  return { key_id: razorpayConfig().keyId!, order_id: order.id, amount: order.amount, currency: order.currency, name: "Layerflow", description: o.description, notes: o.notes };
}
