"use client";

/**
 * The checkout sheet for a paid bug-bounty plan when the server runs checkout
 * in demo mode (no working Dodo Payments key): it looks and flows like Dodo's
 * hosted checkout — pick UPI or card, pay, get a payment id — but nothing is
 * charged, and it says so. With a working key the real hosted checkout opens
 * instead and this sheet is never shown.
 */
import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CreditCard, FlaskConical, LoaderCircle, Lock, Smartphone, X } from "lucide-react";
import { Portal } from "@/components/app/Portal";
import { api, type DemoCheckout } from "@/lib/api";
import { cn } from "@/lib/utils";

const LIME = "#C6FE1E";
const INK = "#00160D";

export function DodoBadge({ className, label = "Payments by" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-0.5 pl-1 pr-2.5 text-[11px] font-medium text-neutral-600", className)}>
      <img src="/logos/dodopayments.svg" alt="" className="size-4" />
      {label} <b className="font-semibold text-neutral-900">Dodo Payments</b>
    </span>
  );
}

export function DodoCheckoutSheet({ checkout, ownerId, onClose, onPaid }: { checkout: DemoCheckout; ownerId: string; onClose: () => void; onPaid: (paymentId: string | null) => void }) {
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [vpa, setVpa] = useState("success@upi");
  const [stage, setStage] = useState<"form" | "paying" | "done">("form");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amount = `₹${checkout.amount_inr.toLocaleString("en-IN")}`;

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
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
            <img src="/logos/dodopayments-wordmark.svg" alt="Dodo Payments" className="h-5" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#96681c]">
                <FlaskConical className="size-3" /> Demo
              </span>
              {stage === "form" && (
                <button onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100" aria-label="Close">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          <div className="px-5 pt-4">
            <div className="flex items-center gap-3">
              <img src="/brands/layerflow.svg" alt="" className="size-9 rounded-lg" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold">Layerflow</p>
                <p className="truncate text-[12px] text-neutral-500">Bug bounty — {checkout.plan_name} plan</p>
              </div>
              <p className="ml-auto text-[20px] font-semibold tabular-nums tracking-[-0.02em]">{amount}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {stage === "done" ? (
              <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-5 pt-6 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ backgroundColor: LIME, color: INK }}>
                  <Check className="size-6" strokeWidth={3} />
                </span>
                <p className="mt-3 text-[16px] font-semibold">Payment successful</p>
                <p className="mt-1 text-[12.5px] text-neutral-500">{amount} paid to Layerflow. Your program is now open for hunters.</p>
                <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-left text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Payment ID</span>
                    <span className="font-mono font-semibold">{paymentId}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-neutral-500">Method</span>
                    <span className="font-semibold">{method === "upi" ? `UPI · ${vpa}` : "Card · 4242"}</span>
                  </div>
                </div>
                <button onClick={() => onPaid(paymentId)} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold" style={{ backgroundColor: INK, color: "#fff" }}>
                  Continue to your program
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-5 pt-5">
                <p className="text-[12px] font-medium text-neutral-500">Pay with</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["upi", "UPI", Smartphone],
                      ["card", "Card", CreditCard],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button key={id} type="button" disabled={stage !== "form"} onClick={() => setMethod(id)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold", method === id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 text-neutral-600")}>
                      <Icon className="size-4" /> {label}
                    </button>
                  ))}
                </div>
                {method === "upi" ? (
                  <label className="mt-3 block">
                    <span className="text-[12px] font-medium text-neutral-500">UPI ID</span>
                    <input value={vpa} onChange={(e) => setVpa(e.target.value.trim())} disabled={stage !== "form"} className="mt-1 h-11 w-full rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] outline-none focus:border-neutral-900" />
                  </label>
                ) : (
                  <div className="mt-3 space-y-2">
                    <input readOnly value="4242 4242 4242 4242" className="h-11 w-full rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] text-neutral-700 outline-none" aria-label="Card number" />
                    <div className="grid grid-cols-2 gap-2">
                      <input readOnly value="12 / 34" className="h-11 rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] text-neutral-700 outline-none" aria-label="Expiry" />
                      <input readOnly value="123" className="h-11 rounded-xl border border-neutral-200 px-3 font-mono text-[13.5px] text-neutral-700 outline-none" aria-label="CVC" />
                    </div>
                  </div>
                )}
                {error && <p className="mt-3 rounded-lg bg-[#c64e27]/10 px-3 py-2 text-[12.5px] text-[#a8401f]">{error}</p>}
                <button onClick={pay} disabled={stage !== "form" || (method === "upi" && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa))} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold disabled:opacity-50" style={{ backgroundColor: LIME, color: INK }}>
                  {stage === "paying" ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" /> Processing payment…
                    </>
                  ) : (
                    `Pay ${amount}`
                  )}
                </button>
                <p className="mt-3 text-center text-[11px] leading-[1.5] text-neutral-500">Demo checkout — nothing is charged. With a working Dodo Payments key, Layerflow opens Dodo's real hosted checkout here.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-center gap-1.5 border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[11px] text-neutral-500">
            <Lock className="size-3" /> Secured by <img src="/logos/dodopayments.svg" alt="" className="size-3.5" /> <b className="font-semibold text-neutral-700">Dodo Payments</b>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}
