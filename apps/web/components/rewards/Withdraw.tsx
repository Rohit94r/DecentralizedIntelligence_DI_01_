"use client";

/**
 * Withdraw points to UPI — the cash side of Rewards.
 *
 * Dodo Payments can't send money to users, so payouts run in one of two modes
 * (LAYERFLOW_PAYOUTS on the server):
 *   demo   — the payout completes here, step by step, with a DEMO reference,
 *            and every screen says no real money moved
 *   manual — the request waits for the Layerflow team to pay it over UPI
 */
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, BadgeCheck, Building2, Check, CircleDollarSign, Clock, Copy, FlaskConical, LoaderCircle, ShieldCheck, Smartphone, Wallet, X } from "lucide-react";
import { Card } from "@/components/app/bits";
import { Portal } from "@/components/app/Portal";
import { api, timeAgo, type Redemption, type RewardsView } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { usePin } from "./PinDialog";

const UPI = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;

export interface PayoutResult {
  redemption: Redemption;
  mode: "demo" | "manual";
  ref: string | null;
}

function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#96681c]", className)}>
      <FlaskConical className="size-3" /> Demo mode — no real money
    </span>
  );
}

/** The step-by-step payout screen shown right after you confirm. */
export function PayoutTracker({ p, onClose }: { p: PayoutResult; onClose: () => void }) {
  const demo = p.mode === "demo";
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const ts = (demo ? [700, 1500, 2400] : [700]).map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => ts.forEach(clearTimeout);
  }, [demo]);
  useEffect(() => {
    if (demo && stage === 3) import("canvas-confetti").then((c) => c.default({ particleCount: 120, spread: 80, origin: { y: 0.45 } }));
  }, [demo, stage]);

  const steps = demo
    ? [
        { title: "Request received", sub: `${p.redemption.points.toLocaleString("en-IN")} points` },
        { title: "Wallet checked", sub: "Points moved out of your balance" },
        { title: `Sending ${p.redemption.inr}`, sub: `to ${p.redemption.upi}` },
        { title: "Paid", sub: "Demo payout complete" },
      ]
    : [
        { title: "Request received", sub: `${p.redemption.points.toLocaleString("en-IN")} points held` },
        { title: "Waiting for review", sub: "The Layerflow team checks every payout" },
        { title: `Paid to ${p.redemption.upi}`, sub: "Usually within 3 working days" },
      ];
  const done = demo ? stage >= 3 : false;

  return (
    <Portal>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[88] flex items-end justify-center bg-neutral-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Withdrawal</p>
              <p className="mt-1 text-[38px] font-medium leading-none tracking-[-0.04em] text-neutral-950 tabular-nums">{p.redemption.inr}</p>
              <p className="mt-1 font-mono text-[12.5px] text-neutral-500">to {p.redemption.upi}</p>
            </div>
            <button onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          {demo && <DemoBadge className="mt-3" />}

          <ol className="relative mt-6 space-y-5 pl-9">
            <span className="absolute bottom-3 left-[13px] top-3 w-0.5 bg-neutral-100" />
            <motion.span className="absolute left-[13px] top-3 w-0.5 origin-top bg-[#359462]" initial={{ height: 0 }} animate={{ height: `${(Math.min(stage, steps.length - 1) / (steps.length - 1)) * 100}%` }} style={{ maxHeight: "calc(100% - 24px)" }} transition={{ duration: 0.5 }} />
            {steps.map((s, i) => {
              const reached = i <= stage;
              const active = i === stage && !(demo && i === steps.length - 1);
              const waiting = !demo && i === 1 && stage >= 1;
              return (
                <li key={s.title} className="relative">
                  <span
                    className={cn(
                      "absolute -left-9 top-0 flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                      reached ? (waiting ? "border-[#f59e0b] bg-[#f59e0b] text-white" : "border-[#359462] bg-[#359462] text-white") : "border-neutral-200 bg-white text-neutral-300",
                    )}
                  >
                    {waiting ? <Clock className="size-3.5" /> : reached && !active ? <Check className="size-3.5" strokeWidth={3} /> : active ? <LoaderCircle className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <p className={cn("text-[14px] font-semibold", reached ? "text-neutral-950" : "text-neutral-400")}>{s.title}</p>
                  <p className={cn("text-[12px]", reached ? "text-neutral-500" : "text-neutral-300")}>{s.sub}</p>
                </li>
              );
            })}
          </ol>

          <AnimatePresence>
            {done && p.ref && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl bg-neutral-50 p-4">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-neutral-500">Reference</span>
                  <button onClick={() => navigator.clipboard?.writeText(p.ref ?? "")} className="inline-flex items-center gap-1 font-mono font-semibold text-neutral-900">
                    {p.ref} <Copy className="size-3 text-neutral-400" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="text-neutral-500">Status</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#2f7c53]">
                    <BadgeCheck className="size-3.5" /> Paid (demo)
                  </span>
                </div>
                <p className="mt-3 text-[11.5px] leading-[1.5] text-[#96681c]">This is a demo payout: the points left your wallet, but no money was sent. Real payouts need a payout provider (Dodo Payments only takes payments in).</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!demo && <p className="mt-6 rounded-2xl bg-neutral-50 p-4 text-[12.5px] leading-[1.5] text-neutral-600">You'll see the UPI reference (UTR) here once it's paid. Changed your mind? Cancel the request any time before it's processed.</p>}

          <button onClick={onClose} disabled={demo && !done} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[14px] font-semibold text-white disabled:opacity-40">
            {demo && !done ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {demo && !done ? "Processing…" : "Done"}
          </button>
        </motion.div>
      </motion.div>
    </Portal>
  );
}

export function Withdraw({ r, ask, onPaid }: { r: RewardsView; ask: ReturnType<typeof usePin>["ask"]; onPaid: (p: PayoutResult) => void }) {
  const rate = r.rules.points_per_rupee;
  const min = r.rules.min_cash_points;
  const step = r.rules.cash_step_points;
  const max = Math.floor(r.points.balance / step) * step;
  const can = max >= min;
  const demo = r.rules.payouts === "demo";
  const [points, setPoints] = useState(() => Math.max(min, Math.min(max, min)));
  const [upi, setUpi] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upiOk = UPI.test(upi.trim());
  const rupee = (pts: number) => `₹${(pts / rate).toLocaleString("en-IN")}`;
  const cash = r.redemptions.filter((x) => x.kind === "cash").slice(0, 4);

  const submit = async () => {
    setError(null);
    const pin = await ask(r.learner_id, r.has_pin, `Withdraw ${rupee(points)} to ${upi.trim()}`);
    if (!pin) return;
    setBusy(true);
    try {
      const res = await api.redeem({ learner_id: r.learner_id, pin, kind: "cash", points, upi_id: upi.trim() });
      onPaid({ redemption: res.redemption, mode: res.payout?.mode ?? r.rules.payouts, ref: res.payout?.ref ?? res.redemption.payout_ref });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[18px] font-medium tracking-[-0.02em] text-neutral-950">Withdraw to UPI</p>
            {demo ? <DemoBadge /> : <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-600">Paid by the Layerflow team</span>}
          </div>
          <p className="mt-1 text-[13px] leading-[1.5] text-neutral-500">
            Turn points into rupees: {rate * 10} points = ₹10. Withdraw from {min.toLocaleString("en-IN")} points ({rupee(min)}), in steps of {rupee(step)}.
          </p>

          {!can ? (
            <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-4 text-[13px] text-neutral-600">
              <Wallet className="mb-1.5 size-5 text-neutral-400" />
              You have {r.points.balance.toLocaleString("en-IN")} points ({r.points.inr}). You need {(min - r.points.balance).toLocaleString("en-IN")} more to withdraw — about {Math.ceil((min - r.points.balance) / r.rules.points_per_day)} more streak days, or one confirmed critical bug.
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-semibold text-neutral-600">Amount</span>
                  <span className="text-[12px] text-neutral-500">
                    {points.toLocaleString("en-IN")} of {r.points.balance.toLocaleString("en-IN")} points
                  </span>
                </div>
                <p className="text-[40px] font-medium leading-tight tracking-[-0.04em] text-neutral-950 tabular-nums">{rupee(points)}</p>
                <input type="range" min={min} max={max} step={step} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-full accent-[#359462]" aria-label="Points to withdraw" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[min, min * 2.5, min * 5, max]
                    .map((v) => Math.round(v / step) * step)
                    .filter((v, i, a) => v >= min && v <= max && a.indexOf(v) === i)
                    .map((v) => (
                      <button key={v} type="button" onClick={() => setPoints(v)} className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", points === v ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 text-neutral-700 hover:border-neutral-950")}>
                        {v === max ? `Max · ${rupee(v)}` : rupee(v)}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <span className="text-[12px] font-semibold text-neutral-600">Send to</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2.5 rounded-2xl border-2 border-neutral-950 px-3 py-2.5">
                    <Smartphone className="size-4 text-neutral-900" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-neutral-950">UPI</span>
                      <span className="block text-[11px] text-neutral-500">GPay · PhonePe · Paytm</span>
                    </span>
                  </div>
                  <div className="flex cursor-not-allowed items-center gap-2.5 rounded-2xl border-2 border-dashed border-neutral-200 px-3 py-2.5 opacity-60">
                    <Building2 className="size-4 text-neutral-500" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-neutral-700">Bank transfer</span>
                      <span className="block text-[11px] text-neutral-500">coming soon</span>
                    </span>
                  </div>
                </div>
                <label className="mt-2 flex h-12 items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 focus-within:border-neutral-950">
                  <input value={upi} onChange={(e) => setUpi(e.target.value.replace(/\s/g, ""))} placeholder="yourname@okbank" autoComplete="off" spellCheck={false} aria-label="UPI ID" className="min-w-0 flex-1 bg-transparent font-mono text-[14px] outline-none placeholder:font-sans placeholder:text-neutral-400" />
                  {upi && (upiOk ? <BadgeCheck className="size-4 shrink-0 text-[#359462]" /> : <span className="shrink-0 text-[11px] font-semibold text-neutral-400">name@bank</span>)}
                </label>
              </div>

              <div className="space-y-1.5 rounded-2xl bg-neutral-50 px-4 py-3 text-[12.5px]">
                {[
                  ["Amount", rupee(points)],
                  ["Points used", points.toLocaleString("en-IN")],
                  ["Fee", "₹0"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-neutral-500">{k}</span>
                    <span className="font-semibold tabular-nums text-neutral-800">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-[13.5px]">
                  <span className="font-semibold text-neutral-800">You get</span>
                  <span className="font-bold tabular-nums text-neutral-950">{rupee(points)}</span>
                </div>
              </div>

              {error && <p className="rounded-xl bg-[#c64e27]/10 px-3 py-2 text-[12.5px] font-medium text-[#a8401f]">{error}</p>}
              <button onClick={submit} disabled={busy || !upiOk} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#359462] text-[14.5px] font-semibold text-white transition-opacity hover:bg-[#2c7a51] disabled:opacity-40">
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />} Withdraw {rupee(points)}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-neutral-400">
                <ShieldCheck className="size-3.5" /> Confirmed with your wallet PIN
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-neutral-50 p-4">
            <p className="text-[13px] font-semibold text-neutral-900">How withdrawals work</p>
            <ol className="mt-2 space-y-2 text-[12.5px] leading-[1.5] text-neutral-600">
              <li className="flex gap-2">
                <span className="font-mono text-neutral-400">1.</span> Choose an amount and your UPI ID, then confirm with your wallet PIN.
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-neutral-400">2.</span> The points leave your wallet straight away.
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-neutral-400">3.</span>
                {demo ? (
                  <span>
                    The payout completes in the app with a reference number. <b className="text-[#96681c]">Demo mode: no real money is sent</b> — real payouts need a payout provider, because Dodo Payments only takes payments in.
                  </span>
                ) : (
                  <span>The Layerflow team checks it and sends the money to your UPI — usually within 3 working days. You'll see the UPI reference (UTR) here.</span>
                )}
              </li>
            </ol>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Recent withdrawals</p>
            <div className="space-y-2">
              {cash.map((x) => (
                <div key={x.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 px-3 py-2.5">
                  <CircleDollarSign className={cn("size-5 shrink-0", x.status === "paid" ? "text-[#359462]" : "text-neutral-400")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-neutral-900">
                      {x.inr} → {x.upi}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {timeAgo(x.created_at)}
                      {x.payout_ref ? ` · ref ${x.payout_ref}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold", x.status === "paid" ? "bg-[#359462]/15 text-[#2f7c53]" : x.status === "requested" || x.status === "approved" ? "bg-[#f59e0b]/15 text-[#96681c]" : "bg-neutral-100 text-neutral-500")}>
                    {x.status === "paid" ? (x.payout_ref?.startsWith("DEMO") ? "paid · demo" : "paid") : x.status}
                  </span>
                </div>
              ))}
              {!cash.length && <p className="text-[12.5px] text-neutral-500">No withdrawals yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
