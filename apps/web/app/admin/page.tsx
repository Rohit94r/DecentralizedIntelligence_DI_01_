"use client";

/**
 * Admin desk — the human side of rewards. Razorpay takes money in but
 * can't pay learners out, so cash-outs are paid here by a person over UPI
 * (and marked paid with the UTR), goodies are packed and shipped, and reports
 * on Layerflow-owned hosted programs are triaged. Protected by
 * LAYERFLOW_ADMIN_TOKEN when it's set; open (and loudly labelled) when not.
 */
import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CreditCard, IndianRupee, KeyRound, LoaderCircle, PackageCheck, ShieldAlert, Truck, X } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, PageHeading } from "@/components/app/bits";
import { SEVERITY_STYLE, SeverityChip, StatusPill } from "@/components/bounty/bits";
import { api, timeAgo, type AdminRedemption, type BountyReport, type BountySeverity, type PaymentsStatus, type PlanLead, type RedemptionStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const FILTERS: [string, string][] = [
  ["requested", "Waiting"],
  ["approved", "Approved"],
  ["shipped", "Shipped"],
  ["", "All"],
];

const ACTION: Record<RedemptionStatus, { label: string; cls: string; Icon: typeof Check }> = {
  approved: { label: "Approve", cls: "bg-sky-600 text-white", Icon: Check },
  paid: { label: "Mark paid", cls: "bg-[#359462] text-white", Icon: CreditCard },
  shipped: { label: "Mark shipped", cls: "bg-[#5e2ac4] text-white", Icon: Truck },
  delivered: { label: "Delivered", cls: "bg-[#359462] text-white", Icon: PackageCheck },
  rejected: { label: "Reject & refund", cls: "border border-[#c64e27]/40 text-[#a8401f]", Icon: X },
  requested: { label: "", cls: "", Icon: Check },
  cancelled: { label: "", cls: "", Icon: Check },
};

function RedemptionRow({ r, onDone }: { r: AdminRedemption; onDone: () => void }) {
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (status: RedemptionStatus) => {
    setBusy(true);
    setErr(null);
    try {
      await api.adminUpdateRedemption(r.id, { status, payout_ref: ref.trim() || undefined, note: note.trim() || undefined });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const needsRef = r.next.some((s) => s === "paid" || s === "shipped");
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neutral-200/80 bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        {r.item_image ? (
          <img src={r.item_image} alt="" loading="lazy" className="size-11 shrink-0 rounded-2xl bg-[#dfdcd9] object-cover" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">{r.kind === "cash" ? "💸" : (r.item_emoji ?? "🎁")}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-neutral-950">
            {r.kind === "cash" ? `${r.inr} cash-out` : `${r.item_name}${r.size ? ` · size ${r.size}` : ""}`} <span className="font-normal text-neutral-500">· {r.learner_id}</span>
          </p>
          <p className="text-[11.5px] text-neutral-500">
            {r.id} · {r.points.toLocaleString("en-IN")} points · {timeAgo(r.created_at)}
            {r.payout_ref ? ` · ref ${r.payout_ref}` : ""}
          </p>
          {r.kind === "cash" ? (
            <p className="mt-1.5 inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-2 py-1 font-mono text-[12.5px] text-neutral-900">
              UPI: {r.upi_id}
              <button onClick={() => navigator.clipboard?.writeText(r.upi_id ?? "")} className="font-sans text-[11px] font-semibold text-neutral-500 hover:text-neutral-900">
                copy
              </button>
            </p>
          ) : (
            r.shipping && (
              <p className="mt-1.5 rounded-lg bg-neutral-100 px-2 py-1 text-[12px] leading-[1.5] text-neutral-800">
                {r.shipping.name} · {r.shipping.phone}
                <br />
                {r.shipping.address}, {r.shipping.city} {r.shipping.pincode}
              </p>
            )
          )}
          {r.note && <p className="mt-1 text-[11.5px] italic text-neutral-500">{r.note}</p>}
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", r.status === "requested" ? "bg-[#f59e0b]/15 text-[#96681c]" : "bg-neutral-100 text-neutral-600")}>{r.status}</span>
      </div>
      {r.next.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {needsRef && <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={r.kind === "cash" ? "UPI reference (UTR) — required to mark paid" : "Courier + tracking number"} className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-[12.5px] outline-none focus:border-neutral-950" />}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the learner (optional)" className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-[12.5px] outline-none focus:border-neutral-950" />
          </div>
          {err && <p className="text-[12px] font-medium text-[#a8401f]">{err}</p>}
          <div className="flex flex-wrap gap-1.5">
            {r.next.map((s) => {
              const a = ACTION[s];
              return (
                <button key={s} disabled={busy} onClick={() => act(s)} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50", a.cls)}>
                  {busy ? <LoaderCircle className="size-3 animate-spin" /> : <a.Icon className="size-3" />} {a.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ReportRow({ r, onDone }: { r: BountyReport; onDone: () => void }) {
  const [sev, setSev] = useState<BountySeverity>((r.severity as BountySeverity) ?? "medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (status: "valid" | "needs_info" | "duplicate" | "invalid") => {
    setBusy(true);
    setErr(null);
    try {
      await api.adminTriage(r.id, { status, final_severity: status === "valid" ? sev : undefined });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={r.status} />
        <SeverityChip severity={r.severity} />
        <span className="text-[11.5px] text-neutral-500">
          {r.company} · {r.program_title} · by {r.reporter_name} · {timeAgo(r.created_at)}
        </span>
      </div>
      <p className="mt-2 text-[14px] font-semibold text-neutral-950">{r.title}</p>
      <p className="mt-1 whitespace-pre-line text-[12.5px] leading-[1.5] text-neutral-700">{r.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(["critical", "high", "medium", "low"] as const).map((s) => (
          <button key={s} onClick={() => setSev(s)} className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-bold", sev === s ? "text-white" : "border-neutral-200 text-neutral-600")} style={sev === s ? { backgroundColor: SEVERITY_STYLE[s].color, borderColor: SEVERITY_STYLE[s].color } : undefined}>
            {SEVERITY_STYLE[s].label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-neutral-200" />
        <button disabled={busy} onClick={() => act("valid")} className="rounded-full bg-[#359462] px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50">
          Confirm
        </button>
        {(["needs_info", "duplicate", "invalid"] as const).map((s) => (
          <button key={s} disabled={busy} onClick={() => act(s)} className="rounded-full border border-neutral-200 px-3 py-1 text-[12px] font-semibold text-neutral-700 disabled:opacity-50">
            {s === "needs_info" ? "Needs info" : s === "duplicate" ? "Duplicate" : "Not valid"}
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-[12px] font-medium text-[#a8401f]">{err}</p>}
    </div>
  );
}

const LEAD_STATUS = ["new", "contacted", "won", "lost"] as const;

function LeadRow({ l, onDone }: { l: PlanLead; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const set = async (status: PlanLead["status"]) => {
    setBusy(true);
    await api.adminLeadStatus(l.id, status).catch(() => {});
    setBusy(false);
    onDone();
  };
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-neutral-950">
            {l.organisation} <span className="font-normal capitalize text-neutral-500">· {l.kind}{l.seats ? ` · ${l.seats.toLocaleString("en-IN")} people` : ""}</span>
          </p>
          <p className="text-[12.5px] text-neutral-600">
            {l.name} ·{" "}
            <a href={`mailto:${l.email}`} className="font-medium text-neutral-900 underline underline-offset-2">
              {l.email}
            </a>{" "}
            · {timeAgo(l.created_at)}
          </p>
          {l.message && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.5] text-neutral-700">{l.message}</p>}
        </div>
        <div className="inline-flex rounded-full border border-neutral-200 bg-white p-0.5">
          {LEAD_STATUS.map((k) => (
            <button key={k} disabled={busy} onClick={() => set(k)} className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold capitalize", l.status === k ? "bg-neutral-950 text-white" : "text-neutral-500 hover:text-neutral-900")}>
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState<{ ok: boolean; open: boolean; payouts: "demo" | "manual"; payments: PaymentsStatus } | null>(null);
  const [token, setToken] = useState("");
  const [filter, setFilter] = useState("requested");
  const [rows, setRows] = useState<AdminRedemption[] | null>(null);
  const [reports, setReports] = useState<BountyReport[]>([]);
  const [leads, setLeads] = useState<PlanLead[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .adminStatus()
      .then((s) => {
        setStatus(s);
        if (!s.ok) return;
        api
          .adminRedemptions(filter || undefined)
          .then((r) => setRows(r.redemptions))
          .catch((e) => setErr((e as Error).message));
        api
          .adminReports()
          .then((r) => setReports(r.reports))
          .catch(() => {});
        api
          .adminLeads()
          .then((r) => setLeads(r.leads))
          .catch(() => {});
      })
      .catch((e) => setErr((e as Error).message));
  }, [filter]);
  useEffect(() => load(), [load]);

  const saveToken = () => {
    try {
      localStorage.setItem("layerflow-admin-token", token);
    } catch {
      /* ignore */
    }
    load();
  };

  return (
    <AppShell title="Admin desk" subtitle="Pay cash-outs · ship goodies · triage reports">
      <PageHeading eyebrow="Admin" title="The admin desk." accent="Where points become rupees." body="Cash-outs are paid by a person over UPI — Razorpay Checkout only takes payments in (sending money out needs RazorpayX). Goodies are packed and shipped from here too. Rejecting a request returns the points automatically." />

      {status?.open && (
        <Card tint="orange" className="mb-5 flex items-start gap-3 !p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#c64e27]" />
          <p className="text-[13px] leading-[1.5] text-[#6b3a1f] dark:text-neutral-300">
            <b>Open demo mode.</b> LAYERFLOW_ADMIN_TOKEN isn't set, so anyone who can open this page can approve payouts. Set it in <code className="font-mono">.env</code> before real money moves.
          </p>
        </Card>
      )}
      {status && !status.ok && (
        <Card className="mb-5 max-w-md">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-neutral-500" />
            <p className="text-[14px] font-semibold text-neutral-950">Admin token</p>
          </div>
          <p className="mt-1 text-[12.5px] text-neutral-500">Enter the LAYERFLOW_ADMIN_TOKEN from the server's .env. It's kept in this browser only.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveToken();
            }}
            className="mt-3 flex gap-2"
          >
            <input value={token} onChange={(e) => setToken(e.target.value)} type="password" className="h-10 min-w-0 flex-1 rounded-full border border-neutral-200 bg-white px-4 text-[13px] outline-none focus:border-neutral-950" />
            <button className="h-10 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white">Unlock</button>
          </form>
        </Card>
      )}
      {err && <Card className="mb-5 text-[13px] text-[#a8401f]">{err}</Card>}

      {status?.ok && (
        <div className="space-y-6">
          <Card className="flex flex-wrap items-center gap-3 !p-4">
            <CreditCard className="size-5 text-neutral-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-neutral-950">Razorpay {status.payments.mode ? `· ${status.payments.mode} mode` : ""}</p>
              <p className="text-[12.5px] text-neutral-500">{status.payments.message}</p>
            </div>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", status.payments.ready ? "bg-[#359462]/15 text-[#2f7c53]" : "bg-neutral-100 text-neutral-600")}>{status.payments.ready ? "ready" : "not ready"}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", status.payments.webhook ? "bg-[#359462]/15 text-[#2f7c53]" : "bg-neutral-100 text-neutral-600")}>webhook {status.payments.webhook ? "verified" : "not set"}</span>
          </Card>
          <Card className="flex flex-wrap items-center gap-3 !p-4">
            <IndianRupee className="size-5 text-neutral-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-neutral-950">Payouts · {status.payouts === "demo" ? "demo mode" : "manual (UPI by the team)"}</p>
              <p className="text-[12.5px] text-neutral-500">
                {status.payouts === "demo"
                  ? "Withdrawals complete in the app with a DEMO reference and no real money moves. Set LAYERFLOW_PAYOUTS=manual in .env to pay real cash-outs from this desk."
                  : "Withdrawals wait here: pay each one over UPI, then mark it paid with the UTR."}
              </p>
            </div>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", status.payouts === "demo" ? "bg-[#f59e0b]/15 text-[#96681c]" : "bg-[#359462]/15 text-[#2f7c53]")}>{status.payouts}</span>
          </Card>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[20px] font-medium tracking-[-0.03em] text-neutral-950">Redemptions</p>
              <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
                {FILTERS.map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-3.5 py-1 text-[12.5px] font-semibold", filter === k ? "bg-neutral-950 text-white" : "text-neutral-600")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <AnimatePresence>{rows?.map((r) => <RedemptionRow key={r.id} r={r} onDone={load} />)}</AnimatePresence>
              {rows && !rows.length && <Card className="text-[13px] text-neutral-500">Nothing here. 🎉</Card>}
              {!rows && <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />}
            </div>
          </section>

          <section>
            <SectionLabel className="mb-2">Reports waiting on hosted programs</SectionLabel>
            <div className="space-y-3">
              {reports.map((r) => (
                <ReportRow key={r.id} r={r} onDone={load} />
              ))}
              {!reports.length && <Card className="text-[13px] text-neutral-500">No reports waiting.</Card>}
            </div>
          </section>

          <section>
            <SectionLabel className="mb-2">Custom plan requests · colleges and companies</SectionLabel>
            <div className="space-y-3">
              {leads.map((l) => (
                <LeadRow key={l.id} l={l} onDone={load} />
              ))}
              {!leads.length && <Card className="text-[13px] text-neutral-500">No requests yet — they arrive from “Talk to us” on the Pricing page.</Card>}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
