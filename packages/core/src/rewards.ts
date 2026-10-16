/**
 * Rewards — a LeetCode-style daily streak that pays points, and what points buy.
 *
 *   • A day counts when the learner SOLVES something that day: a passing
 *     submission, or a bug-bounty report that was confirmed valid.
 *   • Every streak day earns 100 points; 100 points = ₹10.
 *   • Points are credited once per learner per day (the database enforces it),
 *     so a re-seed or a replay never pays twice.
 *   • Points can be cashed out (UPI, reviewed by an admin) or spent on goodies;
 *     if you're short for a goodie, you can pay the rest at checkout.
 *
 * Pure: no I/O. Days are counted in India time by default (UTC+05:30) so the
 * streak rolls over at local midnight, not at 05:30 in the morning.
 */

export const POINTS_PER_STREAK_DAY = 100;
export const POINTS_PER_RUPEE = 10;
/** smallest cash-out: 1,000 points = ₹100 */
export const MIN_CASH_POINTS = 1000;
/** cash-outs move in steps of 100 points (₹10) */
export const CASH_STEP_POINTS = 100;
export const DEFAULT_TZ_OFFSET_MIN = 330;

export function pointsToPaise(points: number): number {
  return Math.round((points * 100) / POINTS_PER_RUPEE);
}

export function rupees(points: number): string {
  const r = points / POINTS_PER_RUPEE;
  return `₹${r.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** YYYY-MM-DD in the given UTC offset (minutes). */
export function dayKey(at: string | number | Date, offsetMin = DEFAULT_TZ_OFFSET_MIN): string {
  const t = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
  return new Date(t + offsetMin * 60_000).toISOString().slice(0, 10);
}

function shift(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface StreakInfo {
  current: number;
  longest: number;
  /** solved something today already */
  today_done: boolean;
  /** the streak is alive but ends tonight unless you solve something today */
  at_risk: boolean;
  today: string;
  /** the last 7 days, oldest first */
  last7: { day: string; done: boolean }[];
  active_days: number;
}

/**
 * The streak survives until the end of the day after the last solve — like
 * LeetCode, you have all of today to keep yesterday's streak going.
 */
export function streakInfo(activeDays: Iterable<string>, now: Date | number = Date.now(), offsetMin = DEFAULT_TZ_OFFSET_MIN): StreakInfo {
  const days = new Set(activeDays);
  const today = dayKey(now instanceof Date ? now.getTime() : now, offsetMin);
  const todayDone = days.has(today);
  let cur = 0;
  let d = todayDone ? today : shift(today, -1);
  while (days.has(d)) {
    cur++;
    d = shift(d, -1);
  }
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of [...days].sort()) {
    run = prev && shift(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = shift(today, i - 6);
    return { day, done: days.has(day) };
  });
  return { current: cur, longest, today_done: todayDone, at_risk: cur > 0 && !todayDone, today, last7, active_days: days.size };
}

/** The next streak milestone to aim for (shown as a goal, not a bonus). */
export function nextMilestone(current: number): number {
  for (const m of [3, 7, 14, 30, 50, 100, 200, 365]) if (current < m) return m;
  return Math.ceil((current + 1) / 100) * 100;
}

/* ───────────────────────── goodies ───────────────────────── */

export interface Goodie {
  id: string;
  name: string;
  blurb: string;
  points: number;
  emoji: string;
  /** clothing sizes, when the item has them */
  sizes?: string[];
  tint: "green" | "purple" | "orange" | "sky" | "amber";
}

export const GOODIES: Goodie[] = [
  { id: "sticker-pack", name: "Bug Hunter sticker pack", blurb: "12 die-cut vinyl stickers — off-by-one, print vs return and friends.", points: 1500, emoji: "🐞", tint: "green" },
  { id: "notebook", name: "Trace-table notebook", blurb: "A5 dotted notebook with trace-table pages for debugging by hand.", points: 2500, emoji: "📓", tint: "sky" },
  { id: "cap", name: "Layerflow cap", blurb: "Black cotton cap with the lime L. One size.", points: 3500, emoji: "🧢", tint: "purple" },
  { id: "mug", name: "“It works on my machine” mug", blurb: "350 ml ceramic. Dishwasher-safe, bug-proof.", points: 4000, emoji: "☕", tint: "orange" },
  { id: "tshirt", name: "Layerflow T-shirt", blurb: "Soft cotton tee — “Find the bug. Keep the skill.”", points: 6000, emoji: "👕", sizes: ["S", "M", "L", "XL", "XXL"], tint: "amber" },
  { id: "hoodie", name: "Bug Bounty hoodie", blurb: "Heavyweight hoodie for hunters with 5+ confirmed bugs (or the points).", points: 12000, emoji: "🧥", sizes: ["S", "M", "L", "XL", "XXL"], tint: "purple" },
];

export function getGoodie(id: string): Goodie | undefined {
  return GOODIES.find((g) => g.id === id);
}

/* ───────────────────────── validation + masking ───────────────────────── */

export const UPI_RE = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;
export const PIN_RE = /^\d{4,6}$/;

export interface ShippingInput {
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
}

export function validateShipping(s: Partial<ShippingInput> | undefined): string | null {
  if (!s) return "Add a delivery address.";
  if (!s.name || s.name.trim().length < 2) return "Add the name to deliver to.";
  if (!s.phone || !/^[6-9]\d{9}$/.test(s.phone.replace(/[\s-]/g, "").replace(/^\+?91/, ""))) return "Add a 10-digit Indian mobile number.";
  if (!s.address || s.address.trim().length < 8) return "Add the full street address.";
  if (!s.city || s.city.trim().length < 2) return "Add the city.";
  if (!s.pincode || !/^[1-9]\d{5}$/.test(s.pincode.trim())) return "Add a 6-digit PIN code.";
  return null;
}

export function validateCashOut(points: number, balance: number, upi: string | undefined): string | null {
  if (!Number.isInteger(points) || points <= 0) return "Choose how many points to cash out.";
  if (points < MIN_CASH_POINTS) return `The smallest cash-out is ${MIN_CASH_POINTS.toLocaleString("en-IN")} points (${rupees(MIN_CASH_POINTS)}).`;
  if (points % CASH_STEP_POINTS !== 0) return `Cash out in steps of ${CASH_STEP_POINTS} points (${rupees(CASH_STEP_POINTS)}).`;
  if (points > balance) return `You have ${balance.toLocaleString("en-IN")} points — that's not enough for ${points.toLocaleString("en-IN")}.`;
  if (!upi || !UPI_RE.test(upi.trim())) return "Add a valid UPI ID, like name@okbank.";
  return null;
}

/** "rohan.k@okicici" → "ro•••k@okicici" — never send the full UPI ID back to the browser. */
export function maskUpi(upi: string | null): string | null {
  if (!upi) return null;
  const [user, bank] = upi.split("@");
  if (!bank) return "•••";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(3, user.length - 3))}${user.length > 3 ? user.slice(-1) : ""}@${bank}`;
}

/** Only the city and the last 3 digits of the PIN code leave the server. */
export function maskShipping(s: ShippingInput | null): string | null {
  if (!s) return null;
  return `${s.name.split(/\s+/)[0]} · ${s.city} ${s.pincode.slice(0, 3)}•••`;
}
