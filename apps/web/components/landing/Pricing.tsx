"use client";

/** Landing section: the three plans — Free, Pro ($4 · ₹349 a month) and Custom. */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { CurrencySwitch, FALLBACK_PLANS, PlanCards } from "@/components/plans/PlanCards";
import { api, type Currency, type PlanCard } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Pricing() {
  const [plans, setPlans] = useState<PlanCard[]>(FALLBACK_PLANS);
  const [currency, setCurrency] = useState<Currency>("INR");
  useEffect(() => {
    api
      .plans()
      .then((p) => setPlans(p.plans))
      .catch(() => {});
  }, []);
  return (
    <section id="pricing" className="bg-neutral-50 py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl md:text-5xl">Simple pricing</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600 sm:text-lg">Start free. Go Pro for unlimited mentoring and analysis. Colleges and companies get a plan made for them. Earning points and cashing out is the same on every plan.</p>
          <CurrencySwitch currency={currency} onChange={setCurrency} className="mt-6" />
        </div>
        <PlanCards
          plans={plans}
          currency={currency}
          cta={(p) => (
            <Link
              href={p.id === "free" ? "/practice" : p.id === "pro" ? "/pricing" : "/pricing#custom"}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors",
                p.id === "pro" ? "bg-[#bbf451] text-[#1a2e05] hover:bg-[#a8e23a]" : p.id === "custom" ? "bg-[#5e2ac4] text-white hover:bg-[#4f22a8]" : "bg-neutral-950 text-white hover:bg-neutral-800",
              )}
            >
              {p.cta} <ArrowRight className="size-4" />
            </Link>
          )}
        />
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-neutral-500">
          <Lock className="size-3.5" /> Payments are handled by
          <img src="/logos/razorpay.svg" alt="" className="size-4" />
          <b className="font-semibold text-neutral-700">Razorpay</b> — UPI, cards, netbanking and wallets. No auto-debit.
        </p>
      </div>
    </section>
  );
}
