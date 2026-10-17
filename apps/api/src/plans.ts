/**
 * Plans — Free, Pro ($4 · ₹349 a month) and Custom — on the server:
 *
 *   • planOf()        who is on Pro right now (a cancelled Pro lasts until the paid month ends)
 *   • useQuota()      counts one use of a limited feature and stops a Free learner at the daily limit
 *   • startProCheckout() Dodo's hosted checkout for the monthly Pro product in USD or INR,
 *                     or the in-app demo checkout when this server can't take real payments
 *   • activatePro()   applied by bounty.ts's applyPayment for a succeeded subscription payment
 *   • handleSubscriptionEvent() keeps renewals, cancellations and expiries in step with Dodo
 *   • cancel / resume, and "Talk to us" requests for the Custom plan
 *
 * LAYERFLOW_LIMITS=off turns the Free-plan limits off (the test harness does).
 */
import { LIMIT_WORDS, PLANS, PLAN_LIMITS, PRO_PRICE, dayKey, formatPrice, limitFor, type Currency } from "@layerflow/core";
import type { LayerflowStore, PaymentRow, SubscriptionRow } from "@layerflow/db";
import { checkoutMode, configuredProProduct, createCheckout, createSubscriptionProduct, dodoConfig, setCancelAtPeriodEnd } from "./lib/dodo.ts";
import { TZ, checkPin, setPin } from "./rewards.ts";

export interface PlansCtx {
  store: LayerflowStore;
  log?: (s: string) => void;
}

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode, expose: true });
}

const ID = /^[A-Za-z0-9_.-]{2,40}$/;
const MONTH_MS = 30 * 24 * 3600_000;

export const limitsOn = () => process.env.LAYERFLOW_LIMITS !== "off";
const today = () => dayKey(Date.now(), TZ());

export function planOf(store: LayerflowStore, learnerId: string | null | undefined): { plan: "free" | "pro"; sub: SubscriptionRow | null } {
  if (!learnerId) return { plan: "free", sub: null };
  const sub = store.subscription(learnerId);
  const pro = !!sub && sub.status !== "expired" && Date.parse(sub.current_period_end) > Date.now();
  return { plan: pro ? "pro" : "free", sub };
}

export const isPro = (store: LayerflowStore, learnerId: string | null | undefined) => planOf(store, learnerId).plan === "pro";

const PRO_HINT = `go Pro for ${formatPrice(PRO_PRICE.USD, "USD")} (${formatPrice(PRO_PRICE.INR, "INR")}) a month`;

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
    cancel_at_period_end: s.cancel_at_period_end,
    can_manage: s.provider === "demo" || !!s.subscription_id,
  };
}

export async function plansView(store: LayerflowStore, learnerId?: string) {
  const usd = configuredProProduct("USD");
  const inr = configuredProProduct("INR");
  const [modeUsd, modeInr] = await Promise.all([checkoutMode(!!usd), checkoutMode(!!inr)]);
  const id = learnerId && ID.test(learnerId) ? learnerId : null;
  const p = planOf(store, id);
  return {
    plans: PLANS,
    limits: PLAN_LIMITS,
    checkout: { USD: modeUsd, INR: modeInr, live: dodoConfig().mode === "live_mode" },
    me: id
      ? {
          learner_id: id,
          plan: p.plan,
          subscription: p.sub ? publicSub(p.sub) : null,
          usage: store.usage(id, today()),
          limits_on: limitsOn(),
          has_pin: !!store.walletPin(id),
        }
      : null,
  };
}

function safeBase(u: string | undefined): string | null {
  try {
    const x = new URL(u ?? "");
    return /^https?:$/.test(x.protocol) ? x.origin : null;
  } catch {
    return null;
  }
}

/** The product for test mode is created once and remembered; live products come from .env. */
async function proProduct(store: LayerflowStore, currency: Currency): Promise<string> {
  const fromEnv = configuredProProduct(currency);
  if (fromEnv) return fromEnv;
  const sku = `pro-monthly-${currency.toLowerCase()}`;
  const mode = dodoConfig().mode;
  const cached = store.dodoProduct(sku, mode);
  if (cached) return cached;
  const id = await createSubscriptionProduct({ name: "Layerflow Pro", description: "Unlimited Priya, unlimited Repo & Website Analyse and every practice bug-bounty program. Billed monthly.", price: PRO_PRICE[currency], currency, sku });
  store.saveDodoProduct(sku, mode, id);
  return id;
}

export async function startProCheckout(ctx: PlansCtx, b: { learner_id: string; currency: Currency; return_base: string }) {
  const { store } = ctx;
  if (!ID.test(b.learner_id)) throw err("Pick a learner first.", 400);
  if (b.currency !== "USD" && b.currency !== "INR") throw err("Pay in USD or INR.", 400);
  const { plan, sub } = planOf(store, b.learner_id);
  if (plan === "pro" && !sub?.cancel_at_period_end) throw err("You're already on Pro.", 409);
  const base = safeBase(b.return_base);
  if (!base) throw err("Missing return address for the checkout.", 400);
  const amount = PRO_PRICE[b.currency];
  const payId = store.createPayment({ purpose: "subscription", ref: b.learner_id, sku: `pro-monthly-${b.currency.toLowerCase()}`, amount_paise: amount, currency: b.currency });
  const mode = await checkoutMode(!!configuredProProduct(b.currency));
  if (mode === "demo") {
    store.updatePayment(payId, { session_id: `demo_${payId}` });
    ctx.log?.(`[plans] demo checkout ${payId} for ${b.learner_id} (Pro, ${formatPrice(amount, b.currency)}/month) — nothing is charged`);
    return { mode: "demo" as const, payment: payId, checkout_url: null, demo_checkout: { payment: payId, plan: "pro", plan_name: "Pro", title: "Layerflow Pro — billed monthly", amount, currency: b.currency, owner_id: b.learner_id } };
  }
  try {
    const product = await proProduct(store, b.currency);
    const c = await createCheckout({
      product_id: product,
      return_url: `${base}/pricing?payment=${payId}`,
      cancel_url: `${base}/pricing?payment=${payId}&cancelled=1`,
      metadata: { layerflow_payment: payId, purpose: "subscription", learner_id: b.learner_id, plan: "pro", currency: b.currency },
      country: b.currency === "INR" ? "IN" : null,
    });
    store.updatePayment(payId, { session_id: c.session_id, checkout_url: c.checkout_url });
    ctx.log?.(`[plans] checkout ${c.session_id} for ${b.learner_id} (Pro, ${formatPrice(amount, b.currency)}/month, ${dodoConfig().mode})`);
    return { mode: "dodo" as const, payment: payId, checkout_url: c.checkout_url, demo_checkout: null };
  } catch (e) {
    store.updatePayment(payId, { status: "failed" });
    throw e;
  }
}

/** A succeeded subscription payment: Pro for a month from now — or from the end of the month already paid for. */
export function activatePro(store: LayerflowStore, pay: PaymentRow, paymentId: string, subscriptionId: string | null, log?: (s: string) => void) {
  const cur = store.subscription(pay.ref);
  const from = cur && Date.parse(cur.current_period_end) > Date.now() ? Date.parse(cur.current_period_end) : Date.now();
  store.saveSubscription({
    learner_id: pay.ref,
    plan: "pro",
    status: "active",
    provider: pay.session_id?.startsWith("demo_") ? "demo" : "dodo",
    currency: pay.currency,
    amount: pay.amount_paise,
    subscription_id: subscriptionId ?? cur?.subscription_id ?? null,
    payment_id: paymentId,
    current_period_end: new Date(from + MONTH_MS).toISOString(),
    cancel_at_period_end: false,
  });
  log?.(`[plans] ${pay.id} succeeded → ${pay.ref} is on Pro`);
}

/**
 * Dodo's subscription webhooks (subscription.active / renewed / on_hold /
 * cancelled / expired / failed) and renewal payments, which carry the
 * subscription id but not our metadata.
 */
export function handleSubscriptionEvent(ctx: PlansCtx, type: string, d: Record<string, unknown>) {
  const { store } = ctx;
  const subId = String(d.subscription_id ?? "");
  const learner = String((d.metadata as Record<string, unknown> | undefined)?.learner_id ?? "");
  const sub = (subId && store.subscriptionByProviderId(subId)) || (learner && ID.test(learner) ? store.subscription(learner) : null);
  if (!sub) return { ok: true, ignored: true };
  const next = typeof d.next_billing_date === "string" ? d.next_billing_date : null;
  const t = type.toLowerCase();
  if (t === "payment.succeeded" || t === "subscription.renewed" || t === "subscription.active") {
    const from = Math.max(Date.now(), Date.parse(sub.current_period_end) || 0);
    const end = next && Date.parse(next) > Date.now() ? next : new Date(t === "payment.succeeded" ? from + MONTH_MS : from).toISOString();
    store.saveSubscription({ ...sub, status: "active", subscription_id: subId || sub.subscription_id, current_period_end: end, cancel_at_period_end: false });
  } else if (t === "subscription.cancelled") store.saveSubscription({ ...sub, status: "cancelled", cancel_at_period_end: true });
  else if (t === "subscription.expired" || t === "subscription.failed" || t === "subscription.on_hold") store.saveSubscription({ ...sub, status: "expired", current_period_end: new Date().toISOString() });
  else return { ok: true, ignored: true };
  ctx.log?.(`[plans] ${type} → ${sub.learner_id}`);
  return { ok: true };
}

/** Stop (or restart) renewing. Pro stays on until the paid month ends either way. */
export async function setRenewal(ctx: PlansCtx, b: { learner_id: string; pin: string; renew: boolean }) {
  const { store } = ctx;
  if (!ID.test(b.learner_id)) throw err("Pick a learner first.", 400);
  if (!store.walletPin(b.learner_id)) setPin(store, b.learner_id, b.pin);
  else checkPin(store, b.learner_id, b.pin);
  const { plan, sub } = planOf(store, b.learner_id);
  if (plan !== "pro" || !sub) throw err("You're not on Pro.", 409);
  if (sub.provider === "dodo") {
    if (!sub.subscription_id) throw err("This subscription is managed in Dodo Payments — use the link in your receipt email.", 409);
    await setCancelAtPeriodEnd(sub.subscription_id, !b.renew);
  }
  store.saveSubscription({ ...sub, status: b.renew ? "active" : "cancelled", cancel_at_period_end: !b.renew });
  return { ok: true, subscription: publicSub(store.subscription(b.learner_id)!) };
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
