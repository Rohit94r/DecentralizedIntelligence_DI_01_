/**
 * Layerflow's plans — the business model in one place, used by the API (to
 * enforce limits), the pricing page, the landing page and the tests.
 *
 *   Free    everything you need to learn, with daily limits on the costly parts
 *           (the AI mentor, Repo / Website Analyse) and the beginner bounty program
 *   Pro     ₹349 / month ($4 outside India) — no daily limits, every practice
 *           bounty program, a Pro badge; prepaid through Razorpay, a month at a time
 *   Custom  for colleges and companies — priced per class or team, by talking to us
 *
 * Earning is never behind a paywall: streak points, bug-bounty points, goodies
 * and UPI withdrawals work the same on every plan.
 */

export type PlanId = "free" | "pro" | "custom";
export type Currency = "USD" | "INR";

/** null = no limit */
export interface PlanLimits {
  chat_per_day: number | null;
  mentor_per_day: number | null;
  analyses_per_day: number | null;
  /** false = only the beginner practice program (ShopKart) takes reports */
  all_bounty_programs: boolean;
}

export const PLAN_LIMITS: Record<"free" | "pro", PlanLimits> = {
  free: { chat_per_day: 20, mentor_per_day: 2, analyses_per_day: 3, all_bounty_programs: false },
  pro: { chat_per_day: null, mentor_per_day: null, analyses_per_day: null, all_bounty_programs: true },
};

/** Monthly Pro price in the smallest unit of each currency. */
export const PRO_PRICE: Record<Currency, number> = { USD: 400, INR: 34_900 };

export function formatPrice(amount: number, currency: Currency): string {
  const v = amount / 100;
  return currency === "INR" ? `₹${v.toLocaleString("en-IN")}` : `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

export interface PlanCard {
  id: PlanId;
  name: string;
  tagline: string;
  /** null = priced by talking to us */
  price: Record<Currency, number> | null;
  per: string | null;
  cta: string;
  features: string[];
  /** small print under the features */
  note: string;
}

export const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to start learning.",
    price: { USD: 0, INR: 0 },
    per: "forever",
    cta: "Start for free",
    features: [
      "All practice problems, run safely in the sandbox",
      "Plain-words explanations and the full hint ladder",
      "Priya, your AI mentor — 20 chat messages and 2 calls a day",
      "Repo & Website Analyse — 3 a day",
      "Bug Bounty: the ShopKart practice program, plus company and open-source programs",
      "Daily streak, points, goodies and UPI withdrawals",
      "Community",
    ],
    note: "No card needed.",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For learners who practise every day.",
    price: { USD: PRO_PRICE.USD, INR: PRO_PRICE.INR },
    per: "month",
    cta: "Go Pro",
    features: [
      "Everything in Free",
      "Unlimited chat and calls with Priya",
      "Unlimited Repo & Website Analyse",
      "Every practice bounty program — CampusConnect and PayLite too",
      "A Pro badge next to your name",
      "No auto-debit — each payment adds 30 days of Pro",
    ],
    note: "Paid through Razorpay — UPI, cards, netbanking or wallets in rupees, or a card in dollars from anywhere.",
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "For colleges, bootcamps and companies.",
    price: null,
    per: null,
    cta: "Talk to us",
    features: [
      "Pro for every student in your class or everyone in your team",
      "A private bug-bounty program for your company, hosted and triaged here",
      "Practice problems written for your syllabus",
      "One invoice in rupees for the whole group",
      "A setup call and a direct line to us",
    ],
    note: "Priced per class or team. Tell us what you need and we'll reply within two working days.",
  },
];

/** What each Free-plan limit is called in messages. */
export const LIMIT_WORDS: Record<"chat" | "mentor" | "analyse", { one: string; many: string }> = {
  chat: { one: "chat message with Priya", many: "chat messages with Priya" },
  mentor: { one: "mentoring call", many: "mentoring calls" },
  analyse: { one: "Repo / Website analysis", many: "Repo / Website analyses" },
};

export function limitFor(kind: "chat" | "mentor" | "analyse", limits: PlanLimits): number | null {
  return kind === "chat" ? limits.chat_per_day : kind === "mentor" ? limits.mentor_per_day : limits.analyses_per_day;
}
