"use client";

/**
 * Plans & billing — Free, Pro ($4 · ₹349 a month) and Custom.
 *
 *   • your plan today: what you've used of the Free limits, or when Pro renews
 *   • Go Pro: Dodo's hosted checkout in rupees or dollars (the in-app demo
 *     checkout when this server can't take real payments); Dodo sends you back
 *     here and the payment is checked with Dodo before Pro switches on
 *   • stop / restart renewing (wallet PIN), and "Talk to us" for the Custom plan
 */
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, CircleCheck, CircleX, Crown, LoaderCircle, Lock, Send } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { DodoCheckoutSheet } from "@/components/payments/DodoCheckout";
import { CurrencySwitch, FALLBACK_PLANS, PlanCards } from "@/components/plans/PlanCards";
import { usePin } from "@/components/rewards/PinDialog";
import { api, money, refreshPoints, type Currency, type DemoCheckout, type PlansView } from "@/lib/api";
import { useLearner } from "@/lib/learner";
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

function YourPlan({ view, onChanged }: { view: PlansView; onChanged: () => void }) {
  const me = view.me!;
  const pin = usePin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sub = me.subscription;
  const limits = view.limits[me.plan];
  const renew = async (on: boolean) => {
    setError(null);
    const p = await pin.ask(me.learner_id, me.has_pin, on ? "Turn renewal back on" : "Stop renewing Pro");
    if (!p) return;
    setBusy(true);
    try {
      await api.setRenewal(me.learner_id, p, on);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
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
              ? sub.cancel_at_period_end
                ? `Pro stays on until ${date(sub.current_period_end)}, then you're back on Free. Nothing more will be charged.`
                : `${sub.price} a month · renews on ${date(sub.current_period_end)}.`
              : "Daily limits reset at midnight. Earning points and cashing out work the same on every plan."}
          </p>
          {me.plan === "pro" && sub?.can_manage && (
            <button onClick={() => renew(sub.cancel_at_period_end)} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-neutral-700 hover:border-neutral-950 disabled:opacity-50">
              {busy && <LoaderCircle className="size-3.5 animate-spin" />}
              {sub.cancel_at_period_end ? "Keep Pro — turn renewal back on" : "Stop renewing"}
            </button>
          )}
          {error && <p className="mt-2 text-[12.5px] text-[#a8401f]">{error}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:w-[34rem]">
          <Meter label="Chat with Priya today" used={me.usage.chat ?? 0} limit={me.limits_on ? limits.chat_per_day : null} />
          <Meter label="Mentoring calls today" used={me.usage.mentor ?? 0} limit={me.limits_on ? limits.mentor_per_day : null} />
          <Meter label="Analyses today" used={me.usage.analyse ?? 0} limit={me.limits_on ? limits.analyses_per_day : null} />
        </div>
      </div>
      {pin.dialog}
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
  ["Which currency will I pay in?", "Pick rupees for ₹349 a month (UPI or cards, for India) or dollars for $4 a month (cards, anywhere). Dodo Payments shows the final amount before you pay."],
  ["How do I cancel?", "Press “Stop renewing” on this page. Pro stays on until the month you paid for ends, and nothing more is charged."],
  ["Who handles the payment?", "Dodo Payments, on their own secure page. Layerflow never sees your card or UPI details."],
];

function PricingInner() {
  const [learner] = useLearner();
  const search = useSearchParams();
  const router = useRouter();
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

  // back from Dodo's hosted checkout: ?payment=<ours>&payment_id=<dodo>&status=…
  useEffect(() => {
    const ours = search.get("payment");
    if (!ours) return;
    const dodoId = search.get("payment_id");
    const clear = () => router.replace("/pricing");
    if (search.get("cancelled")) {
      setNotice({ ok: false, text: "Checkout cancelled — nothing was charged." });
      clear();
      return;
    }
    (dodoId ? api.syncPayment(ours, dodoId) : api.syncCheckout(ours))
      .then((r) => {
        setNotice(r.status === "succeeded" ? { ok: true, text: "Payment received — welcome to Pro!" } : { ok: false, text: `The payment is ${r.status}. If money left your account, Pro switches on as soon as Dodo confirms it.` });
        load();
      })
      .catch((e) => setNotice({ ok: false, text: (e as Error).message }))
      .finally(clear);
  }, [search, router, load]);

  const goPro = async () => {
    if (!learner) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.proCheckout(learner, currency, window.location.origin);
      if (r.checkout_url) window.location.href = r.checkout_url;
      else if (r.demo_checkout) {
        setDemo(r.demo_checkout);
        setBusy(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const me = view?.me ?? null;
  const live = view ? view.checkout[currency] === "dodo" : true;

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

      {me && view && <YourPlan view={view} onChanged={load} />}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <CurrencySwitch currency={currency} onChange={setCurrency} />
        <p className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
          <Lock className="size-3.5" /> Checkout by <img src="/logos/dodopayments.svg" alt="" className="size-4" /> <b className="font-semibold text-neutral-700">Dodo Payments</b>
          {!live && <span className="rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#96681c]">demo — nothing is charged</span>}
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
          if (me?.plan === "pro" && !me.subscription?.cancel_at_period_end)
            return (
              <span className={cn(btn, "bg-white/10 text-white")}>
                <Crown className="size-4" /> Your plan
              </span>
            );
          return (
            <button onClick={goPro} disabled={busy || !learner} className={cn(btn, "bg-[#bbf451] text-[#1a2e05] hover:bg-[#a8e23a]")}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Crown className="size-4" />}
              {p.price ? `Go Pro · ${money(p.price[currency], currency)} / month` : p.cta}
            </button>
          );
        }}
      />
      {error && <p className="mt-3 rounded-2xl bg-[#fdeee8] px-4 py-3 text-[13px] text-[#a8401f]">{error}</p>}
      {live && view?.checkout.live && <p className="mt-3 text-center text-[12px] text-neutral-500">You'll pay on Dodo Payments' secure page, then come straight back here.</p>}

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
        <DodoCheckoutSheet
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

export default function PricingPage() {
  return (
    <Suspense>
      <PricingInner />
    </Suspense>
  );
}
