/**
 * Services behind Rewards: the daily streak, points, and redeeming them.
 *
 *   • A streak day = a day you solved something (a passing submission or a
 *     confirmed bug-bounty report). Each one is credited 100 points, once —
 *     syncStreakPoints() is idempotent, so it runs whenever points are shown.
 *   • Cash-outs go to a review queue: an admin pays them over UPI and marks
 *     them paid (Dodo Payments can't send money to users).
 *   • Goodies are redeemed with points and shipped by an admin.
 *   • Every redemption needs the learner's wallet PIN — Layerflow has no
 *     passwords, so without it anyone could cash out someone else's points.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  CASH_STEP_POINTS,
  DEFAULT_TZ_OFFSET_MIN,
  GOODIES,
  MIN_CASH_POINTS,
  PIN_RE,
  POINTS_PER_RUPEE,
  POINTS_PER_STREAK_DAY,
  dayKey,
  getChallenge,
  getGoodie,
  maskShipping,
  maskUpi,
  nextChallenge,
  nextMilestone,
  pointsToPaise,
  rupees,
  streakInfo,
  validateCashOut,
  validateShipping,
  type ShippingInput,
} from "@layerflow/core";
import type { LayerflowStore, RedemptionRow, RedemptionStatus } from "@layerflow/db";

/** Minutes east of UTC that "a day" is counted in (LAYERFLOW_TZ_OFFSET_MIN, default India +330). */
export const TZ = (): number => {
  const raw = process.env.LAYERFLOW_TZ_OFFSET_MIN;
  const n = Number(raw);
  return raw && Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : DEFAULT_TZ_OFFSET_MIN;
};

/** The ISO instant of local midnight today. */
export function todayStartIso(now = Date.now()): string {
  return new Date(Date.parse(`${dayKey(now, TZ())}T00:00:00Z`) - TZ() * 60_000).toISOString();
}

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

/* ───────────────────────── streak + points ───────────────────────── */

/** Days (local time) on which the learner solved something, with the first moment of each. */
export function solveDays(store: LayerflowStore, learnerId: string): Map<string, string> {
  const days = new Map<string, string>();
  const add = (at: string) => {
    const d = dayKey(at, TZ());
    if (!days.has(d) || at < days.get(d)!) days.set(d, at);
  };
  for (const h of store.history(learnerId)) if (h.passed) add(h.at);
  for (const t of store.validReportTimes(learnerId)) add(t);
  return days;
}

/** Credits 100 points for every solve day not yet credited. Returns how many were new. */
export function syncStreakPoints(store: LayerflowStore, learnerId: string): number {
  let added = 0;
  for (const [day, at] of solveDays(store, learnerId)) {
    if (store.creditPoints({ learner_id: learnerId, delta: POINTS_PER_STREAK_DAY, kind: "streak_day", ref: day, note: `Streak day · ${day}`, at })) added++;
  }
  return added;
}

export function streakFor(store: LayerflowStore, learnerId: string) {
  const s = streakInfo(solveDays(store, learnerId).keys(), Date.now(), TZ());
  return { ...s, next_milestone: nextMilestone(s.current) };
}

/** The small version for the header chip on every page. */
export function rewardsSummary(store: LayerflowStore, learnerId: string) {
  syncStreakPoints(store, learnerId);
  const s = streakFor(store, learnerId);
  const balance = store.pointsBalance(learnerId);
  return { learner_id: learnerId, streak: s.current, today_done: s.today_done, at_risk: s.at_risk, points: balance, inr: rupees(balance), has_pin: !!store.walletPin(learnerId) };
}

function publicRedemption(r: RedemptionRow) {
  const g = r.item_id ? getGoodie(r.item_id) : undefined;
  return {
    id: r.id,
    kind: r.kind,
    item_id: r.item_id,
    item_name: g?.name ?? null,
    item_emoji: g?.emoji ?? null,
    size: r.size,
    points: r.points,
    inr: rupees(r.points),
    upi: maskUpi(r.upi_id),
    ship_to: maskShipping(r.shipping),
    status: r.status,
    note: r.note,
    payout_ref: r.payout_ref,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function rewardsPage(store: LayerflowStore, learnerId: string) {
  syncStreakPoints(store, learnerId);
  const streak = streakFor(store, learnerId);
  const totals = store.pointsTotals(learnerId);
  const days = solveDays(store, learnerId);
  // the last 20 weeks, oldest first — the calendar on the Rewards page
  const today = streak.today;
  const calendar: { day: string; done: boolean }[] = [];
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7 * 20 + 1);
  for (let i = 0; i < 7 * 20; i++) {
    const k = d.toISOString().slice(0, 10);
    calendar.push({ day: k, done: days.has(k) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const next = nextChallenge(store.history(learnerId), store.mastery(learnerId));
  return {
    learner_id: learnerId,
    streak,
    calendar,
    points: { ...totals, inr: rupees(totals.balance), earned_inr: rupees(totals.earned) },
    rules: {
      points_per_day: POINTS_PER_STREAK_DAY,
      points_per_rupee: POINTS_PER_RUPEE,
      min_cash_points: MIN_CASH_POINTS,
      cash_step_points: CASH_STEP_POINTS,
      day_counts_when: "You solve at least one practice problem, or a bug you reported is confirmed.",
      timezone_offset_min: TZ(),
      payouts: payoutMode(),
    },
    today_pick: { challenge_id: next.challenge_id, title: getChallenge(next.challenge_id)?.title ?? next.challenge_id, reason: next.reason },
    ledger: store.pointsLedger(learnerId, 40),
    redemptions: store.redemptions({ learner_id: learnerId, limit: 50 }).map(publicRedemption),
    goodies: GOODIES.map((g) => ({ ...g, inr: rupees(g.points), affordable: totals.balance >= g.points })),
    has_pin: !!store.walletPin(learnerId),
  };
}

/* ───────────────────────── wallet PIN ───────────────────────── */

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 32).toString("hex");
}

export function setPin(store: LayerflowStore, learnerId: string, pin: string) {
  if (!PIN_RE.test(pin)) throw err("Choose a PIN of 4 to 6 digits.", 400);
  if (store.walletPin(learnerId)) throw err("This wallet already has a PIN.", 409);
  const salt = randomBytes(16).toString("hex");
  store.setWalletPin(learnerId, salt, hashPin(pin, salt));
  return { ok: true };
}

export function checkPin(store: LayerflowStore, learnerId: string, pin: string | undefined): void {
  const row = store.walletPin(learnerId);
  if (!row) throw err("Set a wallet PIN first — it protects your points.", 400);
  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) throw err("Too many wrong PINs. Your wallet is locked for 15 minutes.", 429);
  const ok = typeof pin === "string" && PIN_RE.test(pin) && timingSafeEqual(Buffer.from(hashPin(pin, row.salt), "hex"), Buffer.from(row.hash, "hex"));
  store.recordPinAttempt(learnerId, ok);
  if (!ok) throw err("That PIN isn't right.", 403);
}

/* ───────────────────────── redeem ───────────────────────── */

/**
 * How cash-outs are paid. Dodo Payments can't send money to users, so:
 *   demo   (default) — the withdrawal completes in the app straight away with a
 *          DEMO reference, clearly labelled — no real money moves
 *   manual — requests wait on the admin desk, who pays over UPI and adds the UTR
 * Set LAYERFLOW_PAYOUTS=manual before real money is involved.
 */
export function payoutMode(): "demo" | "manual" {
  return process.env.LAYERFLOW_PAYOUTS === "manual" ? "manual" : "demo";
}

export interface RedeemBody {
  learner_id: string;
  pin: string;
  kind: "cash" | "goodie";
  points?: number;
  upi_id?: string;
  item_id?: string;
  size?: string;
  shipping?: ShippingInput;
}

export function redeem(store: LayerflowStore, b: RedeemBody) {
  checkPin(store, b.learner_id, b.pin);
  syncStreakPoints(store, b.learner_id);
  const balance = store.pointsBalance(b.learner_id);
  if (b.kind === "cash") {
    const points = Number(b.points);
    const problem = validateCashOut(points, balance, b.upi_id);
    if (problem) throw err(problem, 400);
    const r = store.createRedemption({ learner_id: b.learner_id, kind: "cash", points, amount_paise: pointsToPaise(points), upi_id: b.upi_id!.trim(), note: `Cash-out ${rupees(points)} to UPI` });
    if (payoutMode() === "demo") {
      const ref = `DEMO${Date.now().toString().slice(-6)}${randomBytes(2).toString("hex").toUpperCase()}`;
      const paid = store.setRedemptionStatus(r.id, "paid", { note: "Demo payout — no real money was sent.", payout_ref: ref });
      return { redemption: publicRedemption(paid), payout: { mode: "demo" as const, ref }, message: `Demo payout: ${rupees(points)} shown as sent to ${maskUpi(r.upi_id)}. No real money moves in demo mode.` };
    }
    return { redemption: publicRedemption(r), payout: { mode: "manual" as const, ref: null }, message: `Requested ${rupees(points)} to ${maskUpi(r.upi_id)}. An admin checks it and sends it — usually within 3 working days.` };
  }
  const g = b.item_id ? getGoodie(b.item_id) : undefined;
  if (!g) throw err("Pick a goodie.", 400);
  if (g.sizes && (!b.size || !g.sizes.includes(b.size))) throw err(`Pick a size: ${g.sizes.join(", ")}.`, 400);
  const problem = validateShipping(b.shipping);
  if (problem) throw err(problem, 400);
  if (balance < g.points) throw err(`${g.name} needs ${g.points.toLocaleString("en-IN")} points — you have ${balance.toLocaleString("en-IN")}. Keep your streak going!`, 400);
  const s = b.shipping!;
  const shipping = { name: s.name.trim(), phone: s.phone.replace(/[\s-]/g, ""), address: s.address.trim(), city: s.city.trim(), pincode: s.pincode.trim() };
  const r = store.createRedemption({ learner_id: b.learner_id, kind: "goodie", item_id: g.id, size: g.sizes ? b.size : null, points: g.points, amount_paise: pointsToPaise(g.points), shipping, note: `Goodie · ${g.name}` });
  return { redemption: publicRedemption(r), message: `${g.emoji} ${g.name} is on its way to the packing table — we'll ship it to ${maskShipping(shipping)}.` };
}

export function cancelRedemption(store: LayerflowStore, id: string, learnerId: string, pin: string) {
  const r = store.redemption(id);
  if (!r || r.learner_id !== learnerId) throw err("No such request.", 404);
  if (r.status !== "requested") throw err("Only a request that hasn't been processed yet can be cancelled.", 409);
  checkPin(store, learnerId, pin);
  return { redemption: publicRedemption(store.setRedemptionStatus(id, "cancelled", { note: "Cancelled by you" })) };
}

/* ───────────────────────── admin ───────────────────────── */

const NEXT: Record<string, RedemptionStatus[]> = {
  requested: ["approved", "paid", "shipped", "rejected"],
  approved: ["paid", "shipped", "rejected"],
  shipped: ["delivered"],
  paid: [],
  delivered: [],
};

/** The admin sees full UPI ids and addresses — they need them to pay and ship. */
export function adminRedemptions(store: LayerflowStore, status?: string) {
  // cash is paid, goodies are shipped — only offer the moves that fit the request
  const fits = (r: RedemptionRow, s: RedemptionStatus) => (r.kind === "cash" ? s !== "shipped" && s !== "delivered" : s !== "paid");
  return store.redemptions({ status, limit: 300 }).map((r) => ({ ...publicRedemption(r), learner_id: r.learner_id, upi_id: r.upi_id, shipping: r.shipping, next: (NEXT[r.status] ?? []).filter((s) => fits(r, s)) }));
}

export function adminUpdateRedemption(store: LayerflowStore, id: string, b: { status: RedemptionStatus; note?: string; payout_ref?: string }) {
  const r = store.redemption(id);
  if (!r) throw err("No such request.", 404);
  if (!(NEXT[r.status] ?? []).includes(b.status)) throw err(`A ${r.status} request can't become ${b.status}.`, 409);
  if (b.status === "paid" && r.kind !== "cash") throw err("Goodies are shipped, not paid.", 400);
  if ((b.status === "shipped" || b.status === "delivered") && r.kind !== "goodie") throw err("Cash-outs are paid, not shipped.", 400);
  if (b.status === "paid" && !b.payout_ref?.trim()) throw err("Add the UPI transaction reference (UTR) so the learner can check it.", 400);
  return publicRedemption(store.setRedemptionStatus(id, b.status, { note: b.note ?? null, payout_ref: b.payout_ref ?? null }));
}
