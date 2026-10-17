/**
 * Plans — Free, Pro ($4 · ₹349 a month) and Custom — on the server:
 *
 *   • planOf()        who is on Pro right now (Pro lasts until the paid month ends)
 *   • useQuota()      counts one use of a limited feature and stops a Free learner at the daily limit
 *   • startProCheckout() a Razorpay order for one month of Pro, in rupees or dollars
 *                     (the in-app demo checkout when this server can't take payments)
 *   • activatePro()   applied by bounty.ts's applyPayment for a verified Pro payment:
 *                     30 days of Pro, added on top of any time already paid for
 *   • "Talk to us" requests for the Custom plan
 *
 * Pro is prepaid — no auto-debit: each payment adds a month, and Pro simply ends
 * when the paid time runs out. LAYERFLOW_LIMITS=off turns the Free-plan limits
 * off (the test harness does).
 */
import { LIMIT_WORDS, PLANS, PLAN_LIMITS, PRO_PRICE, dayKey, formatPrice, limitFor, type Currency } from "@layerflow/core";
import type { LayerflowStore, PaymentRow, SubscriptionRow } from "@layerflow/db";
import { RazorpayError, checkoutMode, checkoutOptions, createOrder, razorpayConfig } from "./lib/razorpay.ts";
import { TZ } from "./rewards.ts";

export interface PlansCtx {
  store: LayerflowStore;
  log?: (s: string) => void;
}

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode, expose: true });
}

const ID = /^[A-Za-z0-9_.-]{2,40}$/;
const MONTH_MS = 30 * 24 * 3600_000;
/** You can pay up to a year ahead. */
const MAX_AHEAD_MS = 12 * MONTH_MS;

export const limitsOn = () => process.env.LAYERFLOW_LIMITS !== "off";
const today = () => dayKey(Date.now(), TZ());

export function planOf(store: LayerflowStore, learnerId: string | null | undefined): { plan: "free" | "pro"; sub: SubscriptionRow | null } {
  if (!learnerId) return { plan: "free", sub: null };
  const sub = store.subscription(learnerId);
  const pro = !!sub && sub.status !== "expired" && Date.parse(sub.current_period_end) > Date.now();
  return { plan: pro ? "pro" : "free", sub };
}

export const isPro = (store: LayerflowStore, learnerId: string | null | undefined) => planOf(store, learnerId).plan === "pro";

const PRO_HINT = `go Pro for ${formatPrice(PRO_PRICE.INR, "INR")} (${formatPrice(PRO_PRICE.USD, "USD")}) a month`;

/** A Free-plan limit was reached — 402 so the web app can offer the upgrade. */
export function planLimit(message: string) {
  return Object.assign(new Error(message), { statusCode: 402, expose: true, code: "plan_limit" });
}

/** Throws when a Free learner has used today's allowance (counts nothing). */
export function assertQuota(store: LayerflowStore, learnerId: string | null | undefined, kind: "chat" | "mentor" | "analyse"): void {
  if (!learnerId || !ID.test(learnerId) || !limitsOn()) return;
  const limit = limitFor(kind, PLAN_LIMITS[planOf(store, learnerId).plan]);
  if (limit === null) return;
  if ((store.usage(learnerId, today())[kind] ?? 0) >= limit) throw planLimit(`You've used today's ${limit} free ${LIMIT_WORDS[kind].many}. They come back at midnight — or ${PRO_HINT} for unlimited.`);
}

/** Checks, then counts one use of a limited feature. */
export function useQuota(store: LayerflowStore, learnerId: string | null | undefined, kind: "chat" | "mentor" | "analyse"): void {
  assertQuota(store, learnerId, kind);
  countUse(store, learnerId, kind);
}

/** Counts one use (call it once the work succeeded). Pro use is counted too — it's free to keep. */
export function countUse(store: LayerflowStore, learnerId: string | null | undefined, kind: "chat" | "mentor" | "analyse"): void {
  if (!learnerId || !ID.test(learnerId) || !limitsOn()) return;
  store.bumpUsage(learnerId, kind, today());
}

/** CampusConnect and PayLite take reports from Pro learners; ShopKart is free for everyone. */
export function requireProProgram(store: LayerflowStore, learnerId: string, programTitle: string): void {
  if (!limitsOn() || isPro(store, learnerId)) return;
  throw planLimit(`${programTitle} is a Pro practice program. ShopKart is free for everyone — or ${PRO_HINT} to hunt in every practice program.`);
}

function publicSub(s: SubscriptionRow) {
  return {
    status: s.status,
    provider: s.provider,
    currency: s.currency,
    price: formatPrice(s.amount, s.currency as Currency),
    current_period_end: s.current_period_end,
  };
}

export async function plansView(store: LayerflowStore, learnerId?: string) {
  const mode = await checkoutMode();
  const id = learnerId && ID.test(learnerId) ? learnerId : null;
  const p = planOf(store, id);
  return {
    plans: PLANS,
    limits: PLAN_LIMITS,
    checkout: { mode, provider: "razorpay" as const, live: mode === "razorpay" && razorpayConfig().mode === "live" },
    me: id ? { learner_id: id, plan: p.plan, subscription: p.sub ? publicSub(p.sub) : null, usage: store.usage(id, today()), limits_on: limitsOn() } : null,
  };
}

export async function startProCheckout(ctx: PlansCtx, b: { learner_id: string; currency: Currency }) {
  const { store } = ctx;
  if (!ID.test(b.learner_id)) throw err("Pick a learner first.", 400);
  if (b.currency !== "USD" && b.currency !== "INR") throw err("Pay in INR or USD.", 400);
  const { sub } = planOf(store, b.learner_id);
  if (sub && Date.parse(sub.current_period_end) - Date.now() > MAX_AHEAD_MS - MONTH_MS) throw err(`You've already paid for Pro until ${new Date(sub.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`, 409);
  const amount = PRO_PRICE[b.currency];
  const mode = await checkoutMode();
  const payId = store.createPayment({ purpose: "subscription", ref: b.learner_id, sku: `pro-month-${b.currency.toLowerCase()}`, amount_paise: amount, currency: b.currency, provider: mode === "demo" ? "demo" : "razorpay" });
  const title = "Layerflow Pro — 1 month";
  if (mode === "demo") {
    store.updatePayment(payId, { session_id: `demo_${payId}` });
    ctx.log?.(`[plans] demo checkout ${payId} for ${b.learner_id} (Pro, ${formatPrice(amount, b.currency)}) — nothing is charged`);
    return { mode: "demo" as const, payment: payId, razorpay: null, demo_checkout: { payment: payId, plan: "pro", plan_name: "Pro", title, amount, currency: b.currency, owner_id: b.learner_id } };
  }
  const notes = { layerflow_payment: payId, purpose: "subscription", learner_id: b.learner_id, plan: "pro" };
  try {
    const order = await createOrder({ amount, currency: b.currency, receipt: payId, notes });
    store.updatePayment(payId, { session_id: order.id });
    ctx.log?.(`[plans] razorpay order ${order.id} for ${b.learner_id} (Pro, ${formatPrice(amount, b.currency)}, ${razorpayConfig().mode})`);
    return { mode: "razorpay" as const, payment: payId, razorpay: checkoutOptions(order, { description: title, notes }), demo_checkout: null };
  } catch (e) {
    store.updatePayment(payId, { status: "failed" });
    if (b.currency === "USD" && e instanceof RazorpayError && /currency/i.test(e.message)) throw err("Dollar payments aren't switched on for this Razorpay account yet — pay in rupees, or turn on International payments in the Razorpay dashboard.", 400);
    throw e;
  }
}

/** A verified Pro payment: 30 days of Pro, added on top of any time already paid for. */
export function activatePro(store: LayerflowStore, pay: PaymentRow, paymentId: string, log?: (s: string) => void) {
  const cur = store.subscription(pay.ref);
  const from = cur && cur.status !== "expired" && Date.parse(cur.current_period_end) > Date.now() ? Date.parse(cur.current_period_end) : Date.now();
  store.saveSubscription({
    learner_id: pay.ref,
    plan: "pro",
    status: "active",
    provider: pay.session_id?.startsWith("demo_") ? "demo" : "razorpay",
    currency: pay.currency,
    amount: pay.amount_paise,
    subscription_id: null,
    payment_id: paymentId,
    current_period_end: new Date(from + MONTH_MS).toISOString(),
    cancel_at_period_end: true, // prepaid: nothing is charged automatically
  });
  log?.(`[plans] ${pay.id} succeeded → ${pay.ref} is on Pro`);
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,}$/;

export function contactSales(store: LayerflowStore, b: { name: string; email: string; organisation: string; kind: string; seats?: number | null; message?: string | null; learner_id?: string | null }) {
  const name = (b.name ?? "").trim();
  const email = (b.email ?? "").trim();
  const organisation = (b.organisation ?? "").trim();
  if (name.length < 2) throw err("Tell us your name.", 400);
  if (!EMAIL.test(email)) throw err("That email address doesn't look right.", 400);
  if (organisation.length < 2) throw err("Which college or company is this for?", 400);
  const kind = (["college", "company", "other"] as const).find((k) => k === b.kind) ?? "other";
  const seats = typeof b.seats === "number" && b.seats > 0 ? Math.min(100_000, Math.round(b.seats)) : null;
  const id = store.createLead({ name, email, organisation, kind, seats, message: b.message?.trim().slice(0, 2000) || null, learner_id: b.learner_id && ID.test(b.learner_id) ? b.learner_id : null });
  return { ok: true, id, message: `Thanks, ${name.split(" ")[0]} — we'll email ${email} within two working days.` };
}
