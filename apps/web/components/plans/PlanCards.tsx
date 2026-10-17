"use client";

/**
 * The three plans side by side — Free, Pro and Custom — with a rupee / dollar
 * switch. Used on the landing page and on /pricing; each page decides what
 * the buttons do.
 */
import React from "react";
import { Check } from "lucide-react";
import { money, type Currency, type PlanCard, type PlanId } from "@/lib/api";
import { cn } from "@/lib/utils";

/** What the API serves (packages/core/src/plans.ts) — shown until it answers, or if it can't be reached. */
export const FALLBACK_PLANS: PlanCard[] = [
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
    price: { USD: 400, INR: 34_900 },
    per: "month",
    cta: "Go Pro",
    features: [
      "Everything in Free",
      "Unlimited chat and calls with Priya",
      "Unlimited Repo & Website Analyse",
      "Every practice bounty program — CampusConnect and PayLite too",
      "A Pro badge next to your name",
      "Cancel any time — Pro stays on until the month you paid for ends",
    ],
    note: "Billed monthly through Dodo Payments. Pay in rupees (UPI, cards) in India, or in dollars anywhere else.",
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

export function CurrencySwitch({ currency, onChange, className }: { currency: Currency; onChange: (c: Currency) => void; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-full border border-neutral-200 bg-white p-1", className)} role="radiogroup" aria-label="Currency">
      {(
        [
          ["INR", "₹ Rupees"],
          ["USD", "$ Dollars"],
        ] as const
      ).map(([c, label]) => (
        <button key={c} type="button" role="radio" aria-checked={currency === c} onClick={() => onChange(c)} className={cn("rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors", currency === c ? "bg-neutral-950 text-white" : "text-neutral-600 hover:text-neutral-950")}>
          {label}
        </button>
      ))}
    </div>
  );
}

const STYLE: Record<PlanId, { card: string; title: string; check: string }> = {
  free: { card: "border-neutral-200/80 bg-white", title: "text-neutral-950", check: "text-[#359462]" },
  pro: { card: "border-neutral-950 bg-neutral-950 text-white shadow-[0_24px_60px_-28px_rgba(16,15,25,0.6)]", title: "text-white", check: "text-[#bbf451]" },
  custom: { card: "border-[#ddd0ff]/70 bg-[#f2eeff] lf-tint-purple", title: "text-[#5e2ac4] dark:text-[#b69cff]", check: "text-[#5e2ac4] dark:text-[#b69cff]" },
};

export function PlanCards({ plans, currency, current, cta }: { plans: PlanCard[]; currency: Currency; current?: PlanId | null; cta: (p: PlanCard) => React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {plans.map((p) => {
        const st = STYLE[p.id];
        const dark = p.id === "pro";
        const other: Currency = currency === "INR" ? "USD" : "INR";
        return (
          <div key={p.id} className={cn("relative flex flex-col rounded-3xl border p-6 sm:p-8", st.card)}>
            <div className="flex items-center justify-between gap-2">
              <p className={cn("text-[22px] font-medium tracking-[-0.03em]", st.title)}>{p.name}</p>
              {dark && <span className="rounded-full bg-[#bbf451] px-2.5 py-0.5 text-[11px] font-bold text-[#1a2e05]">Recommended</span>}
              {current === p.id && !dark && <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-600">Your plan</span>}
            </div>
            <p className={cn("mt-1 text-[13.5px]", dark ? "text-white/60" : "text-neutral-500")}>{p.tagline}</p>
            <div className="mt-6 min-h-[64px]">
              {p.price ? (
                <>
                  <p className="flex items-baseline gap-1.5">
                    <span className={cn("text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums", dark ? "text-white" : "text-neutral-950")}>{money(p.price[currency], currency)}</span>
                    <span className={cn("text-[14px] font-medium", dark ? "text-white/60" : "text-neutral-500")}>{p.per === "month" ? "/ month" : p.per}</span>
                  </p>
                  {p.price[other] > 0 && <p className={cn("mt-1.5 text-[12.5px]", dark ? "text-white/50" : "text-neutral-500")}>or {money(p.price[other], other)} a month in {other === "USD" ? "dollars" : "rupees"}</p>}
                </>
              ) : (
                <>
                  <p className={cn("text-[36px] font-semibold leading-none tracking-[-0.04em]", st.title)}>Let's talk</p>
                  <p className="mt-1.5 text-[12.5px] text-neutral-500">Priced for your class or team</p>
                </>
              )}
            </div>
            <div className="mt-6">{cta(p)}</div>
            <ul className="mt-6 space-y-2.5 text-[13.5px] leading-[1.45]">
              {p.features.map((f) => (
                <li key={f} className={cn("flex gap-2.5", dark ? "text-white/85" : "text-neutral-700")}>
                  <Check className={cn("mt-0.5 size-4 shrink-0", st.check)} strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
            <p className={cn("mt-auto pt-6 text-[12px] leading-[1.5]", dark ? "text-white/45" : "text-neutral-500")}>{p.note}</p>
          </div>
        );
      })}
    </div>
  );
}
