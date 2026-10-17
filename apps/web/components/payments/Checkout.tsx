"use client";

/**
 * Payments UI. Real payments open Razorpay's own popup (lib/razorpay.ts).
 * When the server has no working Razorpay keys, this demo sheet stands in:
 * it flows like a checkout — UPI or card, pay, a payment id — but nothing is
 * charged, and it says so.
 */
import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CreditCard, FlaskConical, Landmark, LoaderCircle, Lock, Smartphone, X } from "lucide-react";
import { Portal } from "@/components/app/Portal";
import { api, money, type DemoCheckout } from "@/lib/api";
import { cn } from "@/lib/utils";

const BLUE = "#3395FF";
const NAVY = "#0C2451";

export function PaymentsBadge({ className, label = "Payments by" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-0.5 pl-1.5 pr-2.5 text-[11px] font-medium text-neutral-600", className)}>
      <img src="/logos/razorpay.svg" alt="" className="size-3.5" />
      {label} <b className="font-semibold text-neutral-900">Razorpay</b>
    </span>
  );
}

export function DemoCheckoutSheet({ checkout, ownerId, onClose, onPaid, doneText = "Your program is now open for hunters.", continueLabel = "Continue to your program" }: { checkout: DemoCheckout; ownerId: string; onClose: () => void; onPaid: (paymentId: string | null) => void; doneText?: string; continueLabel?: string }) {
  const [method, setMethod] = useState<"upi" | "card" | "bank">("upi");
  const [vpa, setVpa] = useState("success@razorpay");
  const [stage, setStage] = useState<"form" | "paying" | "done">("form");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amount = checkout.amount != null && checkout.currency ? money(checkout.amount, checkout.currency) : `₹${(checkout.amount_inr ?? 0).toLocaleString("en-IN")}`;
  const what = checkout.title ?? `Bug bounty — ${checkout.plan_name} plan`;

  const pay = async () => {
    setError(null);
    setStage("paying");
    try {
      const [r] = await Promise.all([api.completeDemoPayment(checkout.payment, ownerId), new Promise((ok) => setTimeout(ok, 1400))]);
      if (r.status !== "succeeded") throw new Error("The payment didn't go through.");
      setPaymentId(r.payment_id);
      setStage("done");
    } catch (e) {
      setError((e as Error).message);
      setStage("form");
    }
  };

  return (
    <Portal>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[90] flex items-end justify-center bg-neutral-950/50 sm:items-center sm:p-4" onClick={stage === "form" ? onClose : undefined}>
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-t-2xl bg-white text-neutral-900 shadow-2xl sm:rounded-2xl">
          <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ backgroundColor: NAVY }}>
            <img src="/brands/layerflow.svg" alt="" className="size-9 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Layerflow</p>
              <p className="truncate text-[12px] text-white/70">{what}</p>
            </div>
            <div className="text-right">
              <p className="text-[18px] font-semibold tabular-nums">{amount}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b] px-1.5 py-px text-[10px] font-bold text-[#3b2604]">
                <FlaskConical className="size-2.5" /> Demo
              </span>
            </div>
            {stage === "form" && (
              <button onClick={onClose} className="-mr-1 flex size-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10" aria-label="Close">
                <X className="size-4" />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {stage === "done" ? (
              <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-5 pt-6 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#359462] text-white">
                  <Check className="size-6" strokeWidth={3} />
                </span>
                <p className="mt-3 text-[16px] font-semibold">Payment successful</p>
                <p className="mt-1 text-[12.5px] text-neutral-500">
                  {amount} paid to Layerflow. {doneText}
                </p>
                <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-left text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Payment ID</span>
                    <span className="font-mono font-semibold">{paymentId}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-neutral-500">Method</span>
                    <span className="font-semibold">{method === "upi" ? `UPI · ${vpa}` : method === "card" ? "Card · 4111" : "Netbanking"}</span>
                  </div>
                </div>
                <button onClick={() => onPaid(paymentId)} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold text-white" style={{ backgroundColor: BLUE }}>
                  {continueLabel}
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-5 pt-5">
                <p className="text-[12px] font-medium text-neutral-500">Pay with</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["upi", "UPI", Smartphone],
                      ["card", "Card", CreditCard],
                      ["bank", "Netbanking", Landmark],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button key={id} type="button" disabled={stage !== "form"} onClick={() => setMethod(id)} className={cn("flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[12px] font-semibold", method === id ? "border-[#3395FF] bg-[#3395FF]/5 text-[#0C2451]" : "border-neutral-200 text-neutral-600")}>
                      <Icon className="size-4" /> {label}
                    </button>
                  ))}
                </div>
                {method === "upi" && (
                  <label className="mt-3 block">
                    <span className="text-[12px] font-medium text-neutral-500">UPI ID</span>
                    <input value={vpa} onChange={(e) => setVpa(e.target.value.trim())} disabled={stage !== "form"} className="mt-1 h-11 w-full rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] outline-none focus:border-[#3395FF]" />
                  </label>
                )}
                {method === "card" && (
                  <div className="mt-3 space-y-2">
                    <input readOnly value="4111 1111 1111 1111" className="h-11 w-full rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] text-neutral-700 outline-none" aria-label="Card number" />
                    <div className="grid grid-cols-2 gap-2">
                      <input readOnly value="12 / 34" className="h-11 rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] text-neutral-700 outline-none" aria-label="Expiry" />
                      <input readOnly value="123" className="h-11 rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] text-neutral-700 outline-none" aria-label="CVV" />
                    </div>
                  </div>
                )}
                {method === "bank" && <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2.5 text-[12.5px] text-neutral-600">Your bank's page would open here.</p>}
                {error && <p className="mt-3 rounded-lg bg-[#c64e27]/10 px-3 py-2 text-[12.5px] text-[#a8401f]">{error}</p>}
                <button onClick={pay} disabled={stage !== "form" || (method === "upi" && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa))} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: BLUE }}>
                  {stage === "paying" ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" /> Processing payment…
                    </>
                  ) : (
                    `Pay ${amount}`
                  )}
                </button>
                <p className="mt-3 text-center text-[11px] leading-[1.5] text-neutral-500">Demo checkout — nothing is charged. With Razorpay keys in .env, Razorpay's real checkout opens instead.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-center gap-1.5 border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[11px] text-neutral-500">
            <Lock className="size-3" /> Secured by <img src="/logos/razorpay.svg" alt="" className="size-3.5" /> <b className="font-semibold text-neutral-700">Razorpay</b>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}
