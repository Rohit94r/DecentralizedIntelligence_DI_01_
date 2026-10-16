"use client";

/**
 * Rewards — the LeetCode-style streak, the points it earns, and what points
 * buy. Solve one problem a day (or get a bug-bounty report confirmed) and the
 * day counts: 100 points per streak day, 100 points = ₹10. Cash out over UPI
 * or redeem Layerflow goodies; both are protected by a wallet PIN.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ArrowRight, Bug, Check, Flame, Gift, History, IndianRupee, LoaderCircle, PackageCheck, Sparkles, Target, Truck, Wallet, X, Zap } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { Portal } from "@/components/app/Portal";
import { ActivityMap } from "@/components/app/ActivityMap";
import { usePin } from "@/components/rewards/PinDialog";
import { PayoutTracker, Withdraw, type PayoutResult } from "@/components/rewards/Withdraw";
import { api, refreshPoints, timeAgo, type Goodie, type Redemption, type RewardsView, type Shipping } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { cn } from "@/lib/utils";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

const STATUS: Record<Redemption["status"], { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-neutral-100 text-neutral-700" },
  approved: { label: "Approved", cls: "bg-sky-100 text-sky-800" },
  paid: { label: "Paid", cls: "bg-[#359462]/15 text-[#2f7c53]" },
  shipped: { label: "Shipped", cls: "bg-[#5e2ac4]/12 text-[#5e2ac4]" },
  delivered: { label: "Delivered", cls: "bg-[#359462]/15 text-[#2f7c53]" },
  rejected: { label: "Rejected · points returned", cls: "bg-[#c64e27]/12 text-[#a8401f]" },
  cancelled: { label: "Cancelled · points returned", cls: "bg-neutral-100 text-neutral-500" },
};

const LEDGER_ICON = { streak_day: Flame, bounty: Bug, redeem: Gift, refund: History, adjust: Sparkles } as const;

function StreakCard({ r }: { r: RewardsView }) {
  const s = r.streak;
  const pct = Math.min(100, Math.round((s.current / s.next_milestone) * 100));
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Your streak</SectionLabel>
          <div className="mt-2 flex items-end gap-2">
            <span className={cn("mb-1 flex size-11 items-center justify-center rounded-2xl", s.today_done ? "bg-[#f59e0b]/15 text-[#e8792b]" : "bg-neutral-100 text-neutral-400")}>
              <Flame className={cn("size-6", s.today_done && "fill-[#f59e0b]/30")} />
            </span>
            <span className="text-[56px] font-medium leading-[0.9] tracking-[-0.05em] text-neutral-950 tabular-nums">
              <NumberFlow value={s.current} />
            </span>
            <span className="mb-1.5 text-[14px] font-medium text-neutral-500">day{s.current === 1 ? "" : "s"}</span>
          </div>
          <p className={cn("mt-2 text-[13px] font-semibold", s.today_done ? "text-[#2f7c53]" : s.at_risk ? "text-[#c64e27]" : "text-neutral-600")}>
            {s.today_done ? "✓ Today is done — see you tomorrow." : s.at_risk ? `Solve one problem today or your ${s.current}-day streak resets at midnight.` : "Solve one problem today to start a streak."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-neutral-400">longest</p>
          <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-neutral-900">{s.longest}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {s.last7.map((d) => {
          const isToday = d.day === s.today;
          return (
            <div key={d.day} className="flex flex-col items-center gap-1">
              <span className={cn("text-[10.5px] font-semibold", isToday ? "text-neutral-900" : "text-neutral-400")}>{WEEKDAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 text-[13px]",
                  d.done ? "border-[#f59e0b] bg-[#f59e0b] text-white" : isToday ? "border-dashed border-[#f59e0b] text-[#f59e0b]" : "border-neutral-200 text-neutral-300",
                )}
              >
                {d.done ? <Check className="size-4" strokeWidth={3} /> : isToday ? "?" : "·"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="font-medium text-neutral-600">Next milestone: {s.next_milestone}-day streak</span>
          <span className="tabular-nums text-neutral-500">
            {s.current}/{s.next_milestone}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <motion.div className="h-full rounded-full bg-[#f59e0b]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }} />
        </div>
      </div>

      {!s.today_done && (
        <Link href={`/challenge/${r.today_pick.challenge_id}`} className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-neutral-950 px-4 py-3 text-white transition-transform hover:-translate-y-0.5">
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#bbf451]">Today's pick · +{r.rules.points_per_day} points</span>
            <span className="block truncate text-[14px] font-semibold">{r.today_pick.title}</span>
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      )}
    </Card>
  );
}

function WalletCard({ r }: { r: RewardsView }) {
  const p = r.points;
  return (
    <Card className="relative overflow-hidden !bg-neutral-950 !border-neutral-900 text-white">
      <div className="flex items-center gap-2 text-white/60">
        <Wallet className="size-4" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Wallet</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <Zap className="size-7 self-center fill-[#bbf451] text-[#bbf451]" />
        <span className="text-[48px] font-medium leading-none tracking-[-0.05em] tabular-nums">
          <NumberFlow value={p.balance} />
        </span>
        <span className="text-[13px] text-white/50">points</span>
      </div>
      <p className="mt-1 text-[15px] font-semibold text-[#bbf451]">= {p.inr}</p>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ["Streak days", p.streak],
          ["Bug bounty", p.bounty],
          ["Redeemed", p.redeemed],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl bg-white/[0.07] px-2 py-2.5">
            <p className="text-[16px] font-semibold tabular-nums">{(v as number).toLocaleString("en-IN")}</p>
            <p className="text-[10.5px] text-white/50">{k as string}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11.5px] leading-[1.5] text-white/50">
        {r.rules.points_per_day} points for every streak day · {r.rules.points_per_rupee} points = ₹1 · cash out from {r.rules.min_cash_points.toLocaleString("en-IN")} points
      </p>
    </Card>
  );
}

function HowItWorks({ r }: { r: RewardsView }) {
  const steps = [
    { icon: Target, title: "Solve one a day", body: r.rules.day_counts_when },
    { icon: Flame, title: `+${r.rules.points_per_day} points per streak day`, body: "Every day you keep the streak adds 100 points. Miss a day and the streak restarts — your points stay." },
    { icon: Bug, title: "Hunt bugs for more", body: "Confirmed bug-bounty reports pay 120–3,000 points each, by severity." },
    { icon: IndianRupee, title: `${r.rules.points_per_rupee * 10} points = ₹10`, body: "Spend them on goodies, or cash out to UPI once you have 1,000 points (₹100)." },
  ];
  return (
    <Card tint="green">
      <SectionLabel className="!text-[#2f7c53]">How it works</SectionLabel>
      <div className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#2f7c53]">
              <s.icon className="size-4" />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-[#151515]">{s.title}</p>
              <p className="text-[12px] leading-[1.45] text-[#33473a] dark:text-neutral-300">{s.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function StreakMap({ r }: { r: RewardsView }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel>Streak map</SectionLabel>
        <span className="text-[12px] text-neutral-500">
          Current <b className="text-neutral-900">{r.streak.current}</b> · longest <b className="text-neutral-900">{r.streak.longest}</b> day{r.streak.longest === 1 ? "" : "s"}
        </span>
      </div>
      <ActivityMap days={r.calendar} today={r.streak.today} />
    </Card>
  );
}

/** The product photo (public/goodies), or the emoji when an item has no photo yet. */
function GoodieImage({ g, className }: { g: Pick<Goodie, "image" | "emoji" | "name">; className?: string }) {
  return g.image ? (
    <img src={g.image} alt={g.name} loading="lazy" decoding="async" className={cn("object-cover", className)} />
  ) : (
    <span className={cn("flex items-center justify-center bg-neutral-100 text-6xl", className)}>{g.emoji}</span>
  );
}

function GoodieCard({ g, balance, onRedeem, i }: { g: Goodie; balance: number; onRedeem: () => void; i: number }) {
  const pct = Math.min(100, Math.round((balance / g.points) * 100));
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-26px_rgba(16,15,25,0.45)]"
    >
      <button type="button" onClick={onRedeem} disabled={!g.affordable} className="relative block aspect-[4/3] overflow-hidden bg-[#dfdcd9] disabled:cursor-default" aria-label={`${g.name} — ${g.affordable ? "redeem" : "not enough points yet"}`}>
        <GoodieImage g={g} className="size-full transition-transform duration-500 ease-out group-hover:scale-[1.045]" />
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-neutral-900 shadow-sm backdrop-blur">{g.inr}</span>
        {g.sizes && <span className="absolute left-3 top-3 rounded-full bg-neutral-950/80 px-2 py-0.5 text-[10.5px] font-semibold text-white">{`${g.sizes[0]}–${g.sizes[g.sizes.length - 1]}`}</span>}
        {g.affordable && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#bbf451] px-2.5 py-0.5 text-[11px] font-bold text-[#1a2e05] shadow-sm">
            <Check className="size-3" strokeWidth={3} /> You can redeem this
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[15.5px] font-semibold tracking-[-0.01em] text-neutral-950">{g.name}</p>
        <p className="mt-1 flex-1 text-[12.5px] leading-[1.5] text-neutral-600">{g.blurb}</p>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center gap-1 font-bold tabular-nums text-neutral-900">
              <Zap className="size-3.5 fill-[#bbf451] text-[#4d7c0f]" /> {g.points.toLocaleString("en-IN")} points
            </span>
            {!g.affordable && <span className="tabular-nums text-neutral-500">{pct}%</span>}
          </div>
          {!g.affordable && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#359462] to-[#bbf451]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }} />
            </div>
          )}
          {g.affordable ? (
            <button onClick={onRedeem} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-neutral-950 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-800">
              <Gift className="size-3.5" /> Redeem
            </button>
          ) : (
            <p className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-neutral-100 text-[12.5px] font-semibold text-neutral-500">
              <Flame className="size-3.5" /> {(g.points - balance).toLocaleString("en-IN")} points to go
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function GoodieSheet({ g, onClose, onConfirm, busy, error }: { g: Goodie; onClose: () => void; onConfirm: (size: string | undefined, ship: Shipping) => void; busy: boolean; error: string | null }) {
  const [size, setSize] = useState<string | undefined>(g.sizes?.[1]);
  const [ship, setShip] = useState<Shipping>({ name: "", phone: "", address: "", city: "", pincode: "" });
  const field = (k: keyof Shipping, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="text-[11.5px] font-semibold text-neutral-600">{label}</span>
      <input value={ship[k]} onChange={(e) => setShip((s) => ({ ...s, [k]: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13.5px] outline-none focus:border-neutral-950" {...props} />
    </label>
  );
  return (
    <Portal>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-neutral-950/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
        <motion.form
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(size, ship);
          }}
          className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        >
          <div className="relative -mx-6 -mt-6 mb-5 overflow-hidden bg-[#dfdcd9] sm:rounded-t-3xl">
            <GoodieImage g={g} className="aspect-[16/9] w-full" />
            <button type="button" onClick={onClose} className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow-sm hover:bg-white" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-w-0">
            <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{g.name}</p>
            <p className="mt-0.5 text-[13px] text-neutral-500">
              {g.points.toLocaleString("en-IN")} points · worth {g.inr} · free delivery in India
            </p>
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-neutral-600">{g.blurb}</p>
          </div>
          {g.sizes && (
            <div className="mt-5">
              <p className="text-[11.5px] font-semibold text-neutral-600">Size</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.sizes.map((s) => (
                  <button key={s} type="button" onClick={() => setSize(s)} className={cn("h-9 min-w-11 rounded-xl border px-3 text-[13px] font-semibold", size === s ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 text-neutral-700")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("name", "Deliver to (name)", { autoComplete: "name", required: true })}</div>
            {field("phone", "Mobile number", { inputMode: "tel", autoComplete: "tel", placeholder: "10 digits", required: true })}
            {field("pincode", "PIN code", { inputMode: "numeric", autoComplete: "postal-code", placeholder: "6 digits", required: true })}
            <div className="sm:col-span-2">{field("address", "Address", { autoComplete: "street-address", placeholder: "House / flat, street, area", required: true })}</div>
            <div className="sm:col-span-2">{field("city", "City", { autoComplete: "address-level2", required: true })}</div>
          </div>
          <p className="mt-3 text-[11.5px] leading-[1.5] text-neutral-500">Your address is only shown to the Layerflow team who packs the order — everywhere else it appears as just your first name and city.</p>
          {error && <p className="mt-3 rounded-xl bg-[#c64e27]/10 px-3 py-2 text-[12.5px] font-medium text-[#a8401f]">{error}</p>}
          <button disabled={busy} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[14px] font-semibold text-white disabled:opacity-50">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Gift className="size-4" />} Redeem for {g.points.toLocaleString("en-IN")} points
          </button>
        </motion.form>
      </motion.div>
    </Portal>
  );
}

export default function RewardsPage() {
  const [learner] = useLearner();
  const [r, setR] = useState<RewardsView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"goodies" | "cash">("goodies");
  const [sheet, setSheet] = useState<Goodie | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [payout, setPayout] = useState<PayoutResult | null>(null);
  const pin = usePin();

  const load = useCallback(() => {
    if (!learner) return;
    api
      .rewards(learner)
      .then((x) => {
        setR(x);
        setErr(null);
      })
      .catch((e) => setErr((e as Error).message));
  }, [learner]);
  useEffect(() => load(), [load]);

  const done = (msg: string) => {
    setToast(msg);
    setSheet(null);
    load();
    refreshPoints();
    setTimeout(() => setToast(null), 6000);
  };

  const paid = (p: PayoutResult) => {
    setPayout(p);
    load();
    refreshPoints();
  };

  const redeemGoodie = async (size: string | undefined, ship: Shipping) => {
    if (!r || !sheet) return;
    setSheetErr(null);
    const p = await pin.ask(r.learner_id, r.has_pin, `Redeem ${sheet.name}`);
    if (!p) return;
    setBusy(true);
    try {
      const res = await api.redeem({ learner_id: r.learner_id, pin: p, kind: "goodie", item_id: sheet.id, size, shipping: ship });
      done(res.message);
      (await import("canvas-confetti")).default({ particleCount: 110, spread: 75, origin: { y: 0.5 } });
    } catch (e) {
      setSheetErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (x: Redemption) => {
    if (!r) return;
    const p = await pin.ask(r.learner_id, r.has_pin, "Cancel this request?");
    if (!p) return;
    try {
      await api.cancelRedemption(x.id, r.learner_id, p);
      done("Cancelled — your points are back.");
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const ledger = useMemo(() => r?.ledger ?? [], [r]);

  return (
    <AppShell title="Rewards" subtitle="Keep the streak · earn points · redeem them">
      <PageHeading title="Rewards" body="Solve at least one problem a day to keep your streak. Each streak day gives you 100 points, and 100 points are worth ₹10. Spend them on goodies or withdraw them to UPI." />
      {err && <Card className="mb-4 text-[13px] text-[#a8401f]">{err}</Card>}
      {!r ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
            <StreakCard r={r} />
            <WalletCard r={r} />
            <HowItWorks r={r} />
          </div>
          <StreakMap r={r} />

          {/* redeem */}
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[22px] font-medium tracking-[-0.03em] text-neutral-950">Redeem</p>
                <p className="text-[13px] text-neutral-500">
                  You have <b className="text-neutral-900">{r.points.balance.toLocaleString("en-IN")} points</b> ({r.points.inr}).
                </p>
              </div>
              <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
                {(
                  [
                    ["goodies", "Goodies", Gift],
                    ["cash", "Withdraw (UPI)", IndianRupee],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button key={k} onClick={() => setTab(k)} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors", tab === k ? "bg-neutral-950 text-white" : "text-neutral-600 hover:text-neutral-950")}>
                    <Icon className="size-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {tab === "goodies" ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {r.goodies.map((g, i) => (
                      <GoodieCard
                        key={g.id}
                        i={i}
                        g={g}
                        balance={r.points.balance}
                        onRedeem={() => {
                          setSheetErr(null);
                          setSheet(g);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Withdraw r={r} ask={pin.ask} onPaid={paid} />
                )}
              </motion.div>
            </AnimatePresence>
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <SectionLabel>Your requests</SectionLabel>
              <div className="mt-3 divide-y divide-neutral-100">
                {r.redemptions.map((x) => (
                  <div key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                    {x.item_image ? (
                      <img src={x.item_image} alt="" loading="lazy" className="size-10 shrink-0 rounded-2xl bg-[#dfdcd9] object-cover" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-xl">{x.kind === "cash" ? "💸" : (x.item_emoji ?? "🎁")}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-neutral-900">
                        {x.kind === "cash" ? `${x.inr} to ${x.upi}` : `${x.item_name}${x.size ? ` · ${x.size}` : ""}`}
                      </p>
                      <p className="truncate text-[11.5px] text-neutral-500">
                        {x.points.toLocaleString("en-IN")} points · {timeAgo(x.created_at)}
                        {x.ship_to ? ` · ${x.ship_to}` : ""}
                        {x.payout_ref ? ` · ${x.kind === "cash" ? "UTR" : "tracking"} ${x.payout_ref}` : ""}
                      </p>
                      {x.note && <p className="text-[11.5px] text-neutral-500">{x.note}</p>}
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", STATUS[x.status].cls)}>
                      {x.status === "shipped" && <Truck className="size-3" />}
                      {(x.status === "paid" || x.status === "delivered") && <PackageCheck className="size-3" />}
                      {STATUS[x.status].label}
                    </span>
                    {x.status === "requested" && (
                      <button onClick={() => cancel(x)} className="text-[11.5px] font-semibold text-neutral-500 hover:text-[#a8401f]">
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
                {!r.redemptions.length && <p className="py-3 text-[13px] text-neutral-500">Nothing redeemed yet — your first goodie is {Math.max(0, 1500 - r.points.balance).toLocaleString("en-IN")} points away.</p>}
              </div>
            </Card>
            <Card>
              <SectionLabel>Points history</SectionLabel>
              <div className="mt-3 max-h-[26rem] divide-y divide-neutral-100 overflow-y-auto">
                {ledger.map((l) => {
                  const Icon = LEDGER_ICON[l.kind];
                  return (
                    <div key={l.id} className="flex items-center gap-3 py-2.5">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", l.delta > 0 ? "bg-[#359462]/10 text-[#2f7c53]" : "bg-neutral-100 text-neutral-500")}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-neutral-800">{l.note}</p>
                        <p className="text-[11px] text-neutral-400">{timeAgo(l.created_at)}</p>
                      </div>
                      <span className={cn("text-[13.5px] font-bold tabular-nums", l.delta > 0 ? "text-[#2f7c53]" : "text-neutral-500")}>
                        {l.delta > 0 ? "+" : "−"}
                        {Math.abs(l.delta).toLocaleString("en-IN")}
                      </span>
                    </div>
                  );
                })}
                {!ledger.length && (
                  <p className="py-3 text-[13px] text-neutral-500">
                    No points yet. <Link href="/practice" className="font-semibold underline">Solve your first problem</Link> to start a streak.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <AnimatePresence>{sheet && <GoodieSheet key={sheet.id} g={sheet} onClose={() => setSheet(null)} onConfirm={redeemGoodie} busy={busy} error={sheetErr} />}</AnimatePresence>
      <AnimatePresence>{payout && <PayoutTracker key={payout.redemption.id} p={payout} onClose={() => setPayout(null)} />}</AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-24 left-1/2 z-[85] w-[min(92vw,30rem)] -translate-x-1/2 rounded-2xl bg-neutral-950 px-4 py-3 text-[13.5px] font-medium text-white shadow-2xl">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      {pin.dialog}
    </AppShell>
  );
}
