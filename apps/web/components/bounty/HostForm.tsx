"use client";

/**
 * "Host a program" — a company (or an open-source maintainer) lists what
 * hunters may test, what's off-limits and what each severity pays. The free
 * Community plan pays reputation; Starter and Growth unlock a pool of reward
 * points and are paid through Dodo Payments' hosted checkout.
 */
import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Building2, CreditCard, Globe, LoaderCircle, ShieldCheck } from "lucide-react";
import { Card } from "@/components/app/bits";
import { usePin } from "@/components/rewards/PinDialog";
import { DodoBadge, DodoCheckoutSheet } from "@/components/payments/DodoCheckout";
import { api, type BountyPlan, type BountySeverity, type DemoCheckout, type PaymentsStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SEVERITY_STYLE } from "./bits";

export function HostForm({ plans, learner, onCreated }: { plans: BountyPlan[]; learner: string | null; onCreated: (id: string) => void }) {
  const [kind, setKind] = useState<"company" | "open_source">("company");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [repo, setRepo] = useState("");
  const [website, setWebsite] = useState("");
  const [scope, setScope] = useState("");
  const [outScope, setOutScope] = useState("Denial of service\nSocial engineering of staff\nOther customers' real data");
  const [rewards, setRewards] = useState<Record<BountySeverity, number>>({ critical: 2000, high: 1000, medium: 400, low: 150 });
  const [plan, setPlan] = useState<BountyPlan["id"]>("community");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<PaymentsStatus | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [demo, setDemo] = useState<DemoCheckout | null>(null);
  const pin = usePin();

  useEffect(() => {
    api.paymentsStatus().then(setPay).catch(() => {});
  }, []);
  useEffect(() => {
    if (learner)
      api
        .rewardsSummary(learner)
        .then((s) => setHasPin(s.has_pin))
        .catch(() => {});
  }, [learner]);

  const chosen = plans.find((p) => p.id === plan)!;
  const paid = chosen.price_inr > 0;
  const lines = (s: string) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

  const submit = async () => {
    if (!learner) return;
    setError(null);
    const p = await pin.ask(learner, hasPin, paid ? `Post the program and pay ₹${chosen.price_inr.toLocaleString("en-IN")}` : "Post the program");
    if (!p) return;
    setHasPin(true);
    setBusy(true);
    try {
      const r = await api.createProgram({
        owner_id: learner,
        pin: p,
        kind,
        company,
        title,
        summary,
        repo_url: repo.trim() || null,
        website: website.trim() || null,
        scope: lines(scope),
        out_of_scope: lines(outScope),
        rewards,
        plan,
        return_base: window.location.origin,
      });
      if (r.checkout_url) window.location.href = r.checkout_url;
      else if (r.demo_checkout) setDemo(r.demo_checkout);
      else onCreated(r.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const input = "h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-[14px] outline-none placeholder:text-neutral-400 focus:border-neutral-950";
  const area = "w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[13.5px] leading-[1.5] outline-none placeholder:text-neutral-400 focus:border-neutral-950";
  const label = "text-[12px] font-semibold text-neutral-700";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <p className="text-[20px] font-medium tracking-[-0.03em] text-neutral-950">Host a bug-bounty program</p>
        <p className="mt-1 text-[13px] leading-[1.5] text-neutral-500">Tell hunters what to test and what each kind of bug is worth. You triage the reports; confirmed bugs pay points from your plan's pool.</p>
        <div className="mt-5 inline-flex rounded-full border border-neutral-200 bg-white p-1">
          {(
            [
              ["company", "Company", Building2],
              ["open_source", "Open source", Globe],
            ] as const
          ).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold", kind === k ? "bg-neutral-950 text-white" : "text-neutral-600")}>
              <Icon className="size-3.5" /> {l}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{kind === "company" ? "Company" : "Project"}</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={kind === "company" ? "Acme Labs" : "my-awesome-lib"} className={cn(input, "mt-1")} />
          </label>
          <label className="block">
            <span className={label}>Program title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acme customer portal" className={cn(input, "mt-1")} />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>What will hunters test?</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Our customer portal and its REST API: sign-up, orders, invoices and file uploads." className={cn(area, "mt-1")} />
          </label>
          <label className="block">
            <span className={label}>GitHub repository {kind === "open_source" ? "" : "(optional)"}</span>
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/owner/repo" className={cn(input, "mt-1 font-mono text-[13px]")} />
          </label>
          <label className="block">
            <span className={label}>Website to test {kind === "company" ? "" : "(optional)"}</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://staging.acme.com" className={cn(input, "mt-1 font-mono text-[13px]")} />
          </label>
          <label className="block">
            <span className={label}>In scope · one per line</span>
            <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={4} placeholder={"staging.acme.com\napi.acme.com/v2\nThe iOS app"} className={cn(area, "mt-1")} />
          </label>
          <label className="block">
            <span className={label}>Out of scope · one per line</span>
            <textarea value={outScope} onChange={(e) => setOutScope(e.target.value)} rows={4} className={cn(area, "mt-1")} />
          </label>
        </div>
        <p className={cn(label, "mt-5")}>Rewards per confirmed bug (points · 100 = ₹10)</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["critical", "high", "medium", "low"] as const).map((s) => (
            <label key={s} className="rounded-2xl border border-neutral-200 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: SEVERITY_STYLE[s].color }}>
                <span className="size-1.5 rounded-full" style={{ backgroundColor: SEVERITY_STYLE[s].color }} /> {SEVERITY_STYLE[s].label}
              </span>
              <input type="number" min={0} max={50000} step={50} value={rewards[s]} onChange={(e) => setRewards((r) => ({ ...r, [s]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} className="mt-0.5 w-full bg-transparent text-[18px] font-semibold tabular-nums text-neutral-950 outline-none" />
              <span className="text-[10.5px] text-neutral-400">= ₹{(rewards[s] / 10).toLocaleString("en-IN")}</span>
            </label>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <p className="text-[12px] font-semibold text-neutral-700">Plan</p>
        {plans.map((p, i) => (
          <motion.button
            key={p.id}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => setPlan(p.id)}
            className={cn("block w-full rounded-3xl border-2 p-5 text-left transition-colors", plan === p.id ? "border-neutral-950 bg-white" : "border-neutral-200/80 bg-white hover:border-neutral-400")}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[16px] font-semibold tracking-[-0.02em] text-neutral-950">{p.name}</span>
              <span className="text-[20px] font-semibold tabular-nums tracking-[-0.03em] text-neutral-950">{p.price_inr ? `₹${p.price_inr.toLocaleString("en-IN")}` : "Free"}</span>
            </div>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-[1.45] text-neutral-600">
              {p.perks.map((x) => (
                <li key={x}>• {x}</li>
              ))}
            </ul>
          </motion.button>
        ))}
        {paid && (
          <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-3">
            <DodoBadge label="Checkout by" />
            <p className="mt-2 text-[12.5px] leading-[1.5] text-neutral-600">
              {!pay
                ? "Checking payments…"
                : pay.checkout === "demo"
                  ? "Pay with UPI or a card in Dodo's checkout. This server runs it in demo mode, so nothing is charged."
                  : `Pay with UPI or a card on Dodo's secure checkout page. ${pay.message}`}
            </p>
          </div>
        )}
        {error && <p className="rounded-2xl bg-[#c64e27]/10 px-4 py-3 text-[12.5px] font-medium text-[#a8401f]">{error}</p>}
        <button onClick={submit} disabled={busy || !learner || (paid && pay !== null && pay.checkout !== "demo" && !pay.ready)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[14px] font-semibold text-white disabled:opacity-40">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : paid ? <CreditCard className="size-4" /> : <ShieldCheck className="size-4" />}
          {paid ? `Continue to payment · ₹${chosen.price_inr.toLocaleString("en-IN")}` : "Post the program"}
        </button>
        <p className="text-[11.5px] leading-[1.5] text-neutral-500">
          You'll triage reports from the program page with your wallet PIN. You can't report on — or approve reports for — your own account. Hunters are told to test only what you list in scope.
        </p>
      </div>
      {pin.dialog}
      {demo && learner && (
        <DodoCheckoutSheet
          checkout={demo}
          ownerId={learner}
          onClose={() => {
            setDemo(null);
            onCreated(demo.program_id);
          }}
          onPaid={() => onCreated(demo.program_id)}
        />
      )}
    </div>
  );
}
