"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Copy, HeartPulse, Loader2, Play, RefreshCcw, ShieldCheck, Skull, XCircle } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app/AppShell";
import { Card, OutcomeChip, PageHeading, TagBadge } from "@/components/app/bits";
import { CodeEditor } from "@/components/app/CodeEditor";
import { api, type Challenge, type HostileProgram, type LearnerView, type Outcome, type SubmitResult } from "@/lib/api";
import { cn } from "@/lib/utils";

const JUDGE = ["last-k-total", "count-passes", "first-n-squares", "middle-three"];
const GOOD = "def last_k_total(marks, k):\n    if k >= len(marks):\n        return sum(marks)\n    return sum(marks[len(marks) - k:])\n";

function TryIt({ id }: { id: string }) {
  const [c, setC] = useState<Challenge | null>(null);
  const [r, setR] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.challenge(id).then(setC).catch(() => {});
  }, [id]);
  const run = async () => {
    if (!c) return;
    setBusy(true);
    try {
      setR(await api.submit("judge", c.id, c.starter));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[13px] font-semibold text-neutral-950">{id}</p>
          <p className="font-mono text-[11.5px] text-[#0570b0]">{c?.signature}</p>
        </div>
        <button onClick={run} disabled={busy || !c} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Try it
        </button>
      </div>
      <p className="mt-2 text-[12.5px] leading-5 text-neutral-600">{c?.description}</p>
      <p className="mt-1 text-[11px] text-neutral-400">Submits the beginner&apos;s buggy starter as learner “judge”.</p>
      {r && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1">
            {r.visible.map((v) => (
              <OutcomeChip key={"v" + v.test} outcome={v.outcome} className="text-[10px]" />
            ))}
            <span className="mx-1 text-neutral-300">|</span>
            {r.hidden.map((h) => (
              <span key={"h" + h.test} className={`out-${h.outcome as Outcome} rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold`}>
                h{h.test}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">{r.mistake_tags.map((t) => <TagBadge key={t} tag={t} />)}</div>
          <p className="rounded-xl bg-neutral-50 px-3 py-2 text-[12.5px] leading-5 text-neutral-800">{r.explanation}</p>
          <Link href={`/challenge/${id}?learner=judge`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-neutral-600 hover:text-neutral-950">
            Open in the workspace (Line Map, hints, replay) <ArrowRight className="size-3" />
          </Link>
        </motion.div>
      )}
    </Card>
  );
}

function BreakIt() {
  const [programs, setPrograms] = useState<HostileProgram[]>([]);
  const [sel, setSel] = useState(0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ r: SubmitResult; health: boolean; good: boolean; ms: number } | null>(null);
  useEffect(() => {
    api
      .redteam()
      .then((x) => {
        const all = [...x.programs, ...x.escapes];
        setPrograms(all);
        setCode(all[0]?.code ?? "");
      })
      .catch(() => {});
  }, []);
  const p = programs[sel];
  const run = async () => {
    setBusy(true);
    setRes(null);
    const t0 = Date.now();
    try {
      const r = await api.submit("judge_redteam", "last-k-total", code);
      const ms = Date.now() - t0;
      const health = await api.health().then((h) => h.ok).catch(() => false);
      const g = await api.submit("judge_redteam_good", "last-k-total", GOOD);
      const good = [...g.visible, ...g.hidden].every((x) => x.outcome === "passed");
      setRes({ r, health, good, ms });
    } finally {
      setBusy(false);
    }
  };
  const passedAny = res ? [...res.r.visible, ...res.r.hidden].some((x) => x.outcome === "passed") : false;
  return (
    <Card tint="orange">
      <div className="flex items-center gap-2">
        <Skull className="size-4 text-[#c64e27]" />
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Break it</h3>
        <span className="ml-auto font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#c64e27]">{programs.length} hostile programs</span>
      </div>
      <p className="mt-2 text-[13px] text-[#6D6878]">Pick one of the statement&apos;s hostile programs (or edit it), throw it at the sandbox, and watch: never passed, honest label, server still up, the next good submission still passes.</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {programs.map((x, i) => (
          <button
            key={x.id}
            onClick={() => {
              setSel(i);
              setCode(x.code);
              setRes(null);
            }}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", i === sel ? "border-[#c64e27] bg-[#c64e27] text-white" : "border-[#f0d9b8] bg-white text-[#a8401f] hover:border-[#c64e27]")}
          >
            {x.id < 100 ? `#${x.id}` : "escape"} {x.name}
          </button>
        ))}
      </div>
      {p && <p className="mt-3 text-[12px] text-[#7a5a44]"><span className="font-semibold">{p.category}</span> — {p.why}</p>}
      <div className="mt-3">
        <CodeEditor value={code} onChange={setCode} minLines={5} />
      </div>
      <button onClick={run} disabled={busy || !code} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-[#c64e27] px-5 text-[13px] font-semibold text-white hover:bg-[#a8401f] disabled:opacity-50">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Skull className="size-3.5" />} {busy ? "Attacking the sandbox…" : "Run it against the sandbox"}
      </button>
      {res && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2 rounded-2xl bg-white/85 p-4">
          {[
            { ok: !passedAny, t: passedAny ? "A test PASSED — not contained" : `Contained — no test passed (${res.ms} ms)` },
            { ok: true, t: `Label: ${[...new Set([...res.r.visible, ...res.r.hidden].map((x) => x.outcome))].join(", ")}${res.r.debug?.detail ? ` · ${res.r.debug.detail}` : ""}` },
            { ok: res.health, t: res.health ? "GET /api/health → 200 — the server is up" : "health check FAILED" },
            { ok: res.good, t: res.good ? "The next known-good submission still passes" : "next good submission did NOT pass" },
          ].map((row, i) => (
            <p key={i} className="flex items-center gap-2 text-[13px] text-neutral-800">
              {row.ok ? <CheckCircle2 className="size-4 shrink-0 text-[#359462]" /> : <XCircle className="size-4 shrink-0 text-[#c64e27]" />} {row.t}
            </p>
          ))}
          <p className="pt-1 font-mono text-[11.5px] text-neutral-500">visible test 1 got: {res.r.visible[0]?.got}</p>
        </motion.div>
      )}
    </Card>
  );
}

function Curl({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl bg-neutral-950 px-3 py-2.5 pr-10 font-mono text-[11.5px] leading-5 text-neutral-100">{cmd}</pre>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(cmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="absolute right-2 top-2 rounded-md p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
        title="Copy"
      >
        {copied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

export default function JudgesPage() {
  const [health, setHealth] = useState<{ ok: boolean; llm: string | null } | null>(null);
  const [story, setStory] = useState<LearnerView | null>(null);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    const poll = () => api.health().then((h) => setHealth({ ok: h.ok, llm: h.llm })).catch(() => setHealth({ ok: false, llm: null }));
    poll();
    const id = setInterval(poll, 5000);
    api.learner("riya").then(setStory).catch(() => {});
    return () => clearInterval(id);
  }, []);

  return (
    <AppShell title="Judges" subtitle="verify everything in 15 minutes" wide>
      <PageHeading eyebrow="For the judges" title="Verify every claim yourself." body="Everything below runs against the live product. Nothing is mocked: the same /api/submit, /api/hint and /api/learner endpoints your scripts call." />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-neutral-200/80 bg-white px-5 py-4">
        <HeartPulse className={cn("size-5", health?.ok ? "text-[#359462]" : "text-[#c64e27]")} />
        <span className="text-[14px] font-semibold text-neutral-900">{health === null ? "Checking…" : health.ok ? "API reachable · sandbox ready" : "API unreachable"}</span>
        <span className="text-[12.5px] text-neutral-500">{health?.llm ? `LLM tier: ${health.llm}` : "Deterministic tier — no API key required"}</span>
        <span className="ml-auto font-mono text-[12px] text-neutral-500">{origin}</span>
        <button
          onClick={async () => {
            if (!confirm("Reset the demo data (yash, riya, khushi) to its seeded state?")) return;
            setResetting(true);
            await api.reset().catch(() => {});
            setResetting(false);
            api.learner("riya").then(setStory).catch(() => {});
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-[12.5px] font-semibold text-neutral-700 hover:border-neutral-950"
        >
          {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />} Reset demo data
        </button>
      </div>

      <SectionLabel className="mb-3">1 · The four judge challenges — one click each</SectionLabel>
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {JUDGE.map((id) => (
          <TryIt key={id} id={id} />
        ))}
      </div>

      <div className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <SectionLabel className="mb-3">2 · Red team — live</SectionLabel>
          <BreakIt />
        </div>
        <div className="space-y-5">
          <div>
            <SectionLabel className="mb-3">3 · The recurrence story — learner “riya”</SectionLabel>
            <Card tint="green">
              {story ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {story.recurring_mistakes.map((t) => (
                      <TagBadge key={t} tag={t} />
                    ))}
                    {story.one_off_mistakes.map((t) => (
                      <TagBadge key={t} tag={t} className="opacity-60" />
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-[#4b6b55]">Recurring = the same tag in ≥ 2 different challenges. Faded = one-off, never flagged.</p>
                  <motion.div initial={{ rotateX: -70, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 15, delay: 0.3 }} style={{ transformPerspective: 800 }} className="mt-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#359462]">Why this next → {story.next_challenge.challenge_id}</p>
                    <p className="mt-1.5 text-[13.5px] leading-5 text-neutral-800">{story.next_challenge.reason}</p>
                  </motion.div>
                  <Link href="/dashboard?learner=riya" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#2f7c53] hover:underline">
                    Open riya&apos;s dashboard <ArrowRight className="size-3" />
                  </Link>
                </>
              ) : (
                <p className="text-sm text-neutral-500">Loading…</p>
              )}
            </Card>
          </div>
          <div>
            <SectionLabel className="mb-3">4 · How we run your code safely</SectionLabel>
            <Card>
              <div className="grid gap-2 font-mono text-[11.5px]">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <span className="font-semibold text-neutral-900">API process</span> — hidden tests in MEMORY only · compares results · labels outcomes
                </div>
                <div className="text-center text-neutral-400">▼ sends code + INPUTS only (never an expected value)</div>
                <div className="rounded-xl border border-[#ddd0ff] bg-[#f2eeff] px-3 py-2">
                  <span className="font-semibold text-[#5e2ac4]">Runner process</span> — fresh per submission · env = {"{}"} · node --permission (no host files, no child processes)
                  <div className="mt-1.5 rounded-lg border border-[#cfe9c8] bg-[#eeffe8] px-2.5 py-1.5">
                    <span className="font-semibold text-[#2f7c53]">Worker thread · Pyodide (WebAssembly)</span> — AST policy · restricted built-ins · import allowlist · 256 KB stdout cap · 1 MB scratch disk
                  </div>
                </div>
                <div className="text-center text-neutral-400">▲ returns only what the learner&apos;s code did · watchdog: wall clock + memory → kill & replace</div>
              </div>
              <ul className="mt-3 space-y-1 text-[12.5px] text-neutral-700">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#359462]" /> Hidden tests live in the parent&apos;s memory; the child never receives an expected value.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#359462]" /> WebAssembly has no real filesystem, no fork, no sockets; the JS bridge is unregistered.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#359462]" /> Node&apos;s permission model + an empty environment; POSIX hosts also get ulimit + process-group kill.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#359462]" /> Per-test wall clock → interrupt → hard terminate; memory watchdog; the server never runs learner code.</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>

      <SectionLabel className="mb-3">5 · The endpoints — call them yourself</SectionLabel>
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="font-mono text-[12.5px] font-semibold text-neutral-900">POST /api/submit</p>
          <p className="mb-2 mt-1 text-[12px] text-neutral-500">hidden[] carries only {"{test, outcome}"}</p>
          <Curl cmd={`curl -s ${origin}/api/submit -H 'content-type: application/json' -d '{"learner_id":"judge","challenge_id":"last-k-total","code":"def last_k_total(marks, k):\\n    total = 0\\n    for i in range(len(marks) - k, len(marks)):\\n        total += marks[i]\\n    return total\\n"}'`} />
        </Card>
        <Card>
          <p className="font-mono text-[12.5px] font-semibold text-neutral-900">POST /api/hint</p>
          <p className="mb-2 mt-1 text-[12px] text-neutral-500">one rung per call — even when asked for the answer</p>
          <Curl cmd={`curl -s ${origin}/api/hint -H 'content-type: application/json' -d '{"submission_id":"s_0001","message":"just give me the answer"}'`} />
        </Card>
        <Card>
          <p className="font-mono text-[12.5px] font-semibold text-neutral-900">GET /api/learner/{"{id}"}</p>
          <p className="mb-2 mt-1 text-[12px] text-neutral-500">recurring mistakes · mastery · next challenge + reason</p>
          <Curl cmd={`curl -s ${origin}/api/learner/riya`} />
        </Card>
      </div>

      <SectionLabel className="mb-3">6 · The paper trail</SectionLabel>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { href: "/ledger", t: "Hint Ledger", d: "Every prompt and response, with the guardrail's rejection count." },
          { href: "/taxonomy", t: "Mistake taxonomy", d: "Hand-in #3: each category, its detection rule, an example and its unit test." },
          { href: "/dashboard?learner=riya", t: "A learner's arc", d: "Mastery moving with the evidence, recurring vs one-off, the next challenge and why." },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="group rounded-3xl border border-neutral-200/80 bg-white p-5 transition-all hover:border-neutral-950">
            <p className="flex items-center justify-between text-[15px] font-semibold text-neutral-950">
              {x.t} <ArrowRight className="size-4 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-950" />
            </p>
            <p className="mt-1 text-[12.5px] leading-5 text-neutral-500">{x.d}</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-[12px] text-neutral-400">
        Self-test harness: <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono">npm run harness</code> (or <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono">npm run harness -- --url {origin}</code>) runs the red team, the 12 labels, secrecy, hint leakage, the scripted learner and the explanation sheet.
      </p>
    </AppShell>
  );
}
