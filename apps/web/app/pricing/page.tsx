"use client";

/**
 * Plans & billing — Free, Pro (₹349 · $4 a month) and Custom.
 *
 *   • your plan today: what you've used of the Free limits, or until when Pro runs
 *   • Go Pro: Razorpay's checkout opens right here (UPI, cards, netbanking,
 *     wallets); the server verifies the payment before Pro switches on. Pro is
 *     prepaid — each payment adds 30 days, nothing is debited automatically
 *   • the in-app demo checkout when this server has no Razorpay keys
 *   • "Talk to us" for the Custom plan
 */
import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, CircleCheck, CircleX, Crown, LoaderCircle, Lock, Send } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { DemoCheckoutSheet, PaymentsBadge } from "@/components/payments/Checkout";
import { CurrencySwitch, FALLBACK_PLANS, PlanCards } from "@/components/plans/PlanCards";
import { api, money, refreshPoints, type Currency, type DemoCheckout, type PlansView } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { PaymentCancelled, payWithRazorpay } from "@/lib/razorpay";
import { cn } from "@/lib/utils";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-3">
      <p className="text-[12px] text-neutral-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-neutral-900">
        {used}
        <span className="text-[12px] font-medium text-neutral-400">{limit === null ? " · unlimited" : ` of ${limit}`}</span>
      </p>
      {limit !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div className={cn("h-full rounded-full", pct >= 100 ? "bg-[#c64e27]" : "bg-[#359462]")} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function YourPlan({ view }: { view: PlansView }) {
  const me = view.me!;
  const sub = me.subscription;
  const limits = view.limits[me.plan];
  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {me.plan === "pro" ? <Crown className="size-5 text-[#b7791f]" /> : <BadgeCheck className="size-5 text-neutral-400" />}
            <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{me.plan === "pro" ? "You're on Pro" : "You're on Free"}</p>
            {sub?.provider === "demo" && me.plan === "pro" && <span className="rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#96681c]">demo payment</span>}
          </div>
          <p className="mt-1 text-[13px] leading-[1.5] text-neutral-600">
            {me.plan === "pro" && sub
              ? `Pro until ${date(sub.current_period_end)}. Nothing is debited automatically — pay again any time to add another month.`
              : "Daily limits reset at midnight. Earning points and cashing out work the same on every plan."}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:w-[34rem]">
          <Meter label="Chat with Priya today" used={me.usage.chat ?? 0} limit={me.limits_on ? limits.chat_per_day : null} />
          <Meter label="Mentoring calls today" used={me.usage.mentor ?? 0} limit={me.limits_on ? limits.mentor_per_day : null} />
          <Meter label="Analyses today" used={me.usage.analyse ?? 0} limit={me.limits_on ? limits.analyses_per_day : null} />
        </div>
      </div>
    </Card>
  );
}

function ContactForm({ learner }: { learner: string | null }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [kind, setKind] = useState<"college" | "company" | "other">("college");
  const [seats, setSeats] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const field = "h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-[14px] outline-none placeholder:text-neutral-400 focus:border-neutral-950";
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await api.contactSales({ name, email, organisation: org, kind, seats: seats ? Number(seats) : null, message: message.trim() || null, learner_id: learner });
      setDone(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card tint="purple">
      <div id="custom" className="grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-[22px] font-medium tracking-[-0.03em] text-[#5e2ac4] dark:text-[#b69cff]">Custom plan — talk to us</p>
          <p className="mt-2 text-[13.5px] leading-[1.55] text-[#6D6878]">For a college, a bootcamp or a company. Tell us how many people and what you need — Pro for a whole class, a private bug-bounty program, problems for your syllabus — and we'll come back with a price within two working days.</p>
          <ul className="mt-4 space-y-1.5 text-[13px] text-[#6D6878]">
            {["One invoice in rupees for the whole group", "A setup call, then a direct line to us", "Start small — one class or one team is fine"].map((x) => (
              <li key={x} className="flex gap-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-[#5e2ac4] dark:text-[#b69cff]" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center rounded-2xl bg-white/80 p-6 text-center">
              <CircleCheck className="size-8 text-[#359462]" />
              <p className="mt-2 text-[15px] font-semibold text-neutral-950">Request sent</p>
              <p className="mt-1 text-[13px] text-neutral-600">{done}</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="grid gap-2.5 sm:grid-cols-2"
            >
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className={field} />
              <input value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="Work email" type="email" autoComplete="email" className={field} />
              <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="College or company" autoComplete="organization" className={field} />
              <input value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="How many people?" inputMode="numeric" className={field} />
              <div className="flex gap-1.5 sm:col-span-2">
                {(["college", "company", "other"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setKind(k)} className={cn("flex-1 rounded-2xl border px-3 py-2 text-[13px] font-semibold capitalize", kind === k ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600")}>
                    {k}
                  </button>
                ))}
              </div>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="What do you need? (optional)" className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none placeholder:text-neutral-400 focus:border-neutral-950 sm:col-span-2" />
              {error && <p className="text-[12.5px] text-[#a8401f] sm:col-span-2">{error}</p>}
              <button disabled={busy || !name.trim() || !email || !org.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#5e2ac4] text-[14px] font-semibold text-white disabled:opacity-40 sm:col-span-2">
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Send request
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

const FAQ = [
  ["Do I need Pro to earn money?", "No. Streak points, bug-bounty points, goodies and UPI withdrawals work exactly the same on Free."],
  ["Is there an auto-debit?", "No. Each payment adds 30 days of Pro. When the time runs out you're simply back on Free — nothing is charged unless you pay again."],
  ["Which currency will I pay in?", "Rupees: ₹349 a month with UPI, cards, netbanking or a wallet. Dollars: $4 a month with an international card. Razorpay shows the final amount before you pay."],
  ["Who handles the payment?", "Razorpay, in its own secure window. Layerflow never sees your card, UPI or bank details — and Pro switches on only after the payment is verified."],
];

export default function PricingPage() {
  const [learner] = useLearner();
  const [view, setView] = useState<PlansView | null>(null);
  const [currency, setCurrency] = useState<Currency>("INR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [demo, setDemo] = useState<DemoCheckout | null>(null);

  const load = useCallback(() => {
    api
      .plans(learner)
      .then(setView)
      .catch(() => {});
    refreshPoints();
  }, [learner]);
  useEffect(load, [load]);

  const goPro = async () => {
    if (!learner) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const r = await api.proCheckout(learner, currency);
      if (r.razorpay) {
        const status = await payWithRazorpay(r.payment, r.razorpay, { name: learner });
        setNotice(status === "succeeded" ? { ok: true, text: "Payment received — welcome to Pro!" } : { ok: false, text: `The payment is ${status}. Pro switches on as soon as your bank confirms it.` });
        load();
      } else if (r.demo_checkout) setDemo(r.demo_checkout);
    } catch (e) {
      if (e instanceof PaymentCancelled) setNotice({ ok: false, text: e.message });
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const me = view?.me ?? null;
  const real = view ? view.checkout.mode === "razorpay" : true;

  return (
    <AppShell title="Pricing" subtitle="Free · Pro · Custom">
      <PageHeading title="Plans" body="Start free and go Pro when you want more: unlimited time with Priya, unlimited Repo & Website Analyse and every practice bug-bounty program. Colleges and companies get a plan made for them." />

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("mb-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-medium", notice.ok ? "bg-[#eeffe8] text-[#2f7c53]" : "bg-[#fdeee8] text-[#a8401f]")}>
            {notice.ok ? <CircleCheck className="size-4 shrink-0" /> : <CircleX className="size-4 shrink-0" />} {notice.text}
            <button onClick={() => setNotice(null)} className="ml-auto text-[12px] font-semibold opacity-70 hover:opacity-100">
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {me && view && <YourPlan view={view} />}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <CurrencySwitch currency={currency} onChange={setCurrency} />
        <p className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
          <Lock className="size-3.5" /> <PaymentsBadge label="Checkout by" />
          {!real && <span className="rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#96681c]">demo — nothing is charged</span>}
        </p>
      </div>

      <PlanCards
        plans={view?.plans ?? FALLBACK_PLANS}
        currency={currency}
        current={me?.plan}
        cta={(p) => {
          const btn = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-50";
          if (p.id === "free")
            return (
              <span className={cn(btn, "border border-neutral-200 text-neutral-500")}>
                {me?.plan === "free" ? "Your plan" : "Included in Pro"}
              </span>
            );
          if (p.id === "custom")
            return (
              <a href="#custom" className={cn(btn, "bg-[#5e2ac4] text-white hover:bg-[#4f22a8]")}>
                Talk to us <ArrowRight className="size-4" />
              </a>
            );
          const price = p.price ? money(p.price[currency], currency) : "";
          return (
            <button onClick={goPro} disabled={busy || !learner} className={cn(btn, "bg-[#bbf451] text-[#1a2e05] hover:bg-[#a8e23a]")}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Crown className="size-4" />}
              {me?.plan === "pro" ? `Add a month · ${price}` : `Go Pro · ${price} / month`}
            </button>
          );
        }}
      />
      {error && <p className="mt-3 rounded-2xl bg-[#fdeee8] px-4 py-3 text-[13px] text-[#a8401f]">{error}</p>}
      {real && view?.checkout.live && <p className="mt-3 text-center text-[12px] text-neutral-500">Razorpay opens right here — UPI, cards, netbanking or wallets. Pro switches on the moment the payment is verified.</p>}

      <div className="mt-8">
        <ContactForm learner={learner} />
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {FAQ.map(([q, a]) => (
          <Card key={q}>
            <p className="text-[14px] font-semibold text-neutral-950">{q}</p>
            <p className="mt-1 text-[13px] leading-[1.55] text-neutral-600">{a}</p>
          </Card>
        ))}
      </div>

      {demo && learner && (
        <DemoCheckoutSheet
          checkout={demo}
          ownerId={learner}
          doneText="You're on Pro — no daily limits."
          continueLabel="Back to Layerflow"
          onClose={() => setDemo(null)}
          onPaid={() => {
            setDemo(null);
            setNotice({ ok: true, text: "Welcome to Pro! (demo payment — nothing was charged)" });
            load();
          }}
        />
      )}
    </AppShell>
  );
}
