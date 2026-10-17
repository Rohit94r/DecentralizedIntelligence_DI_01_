"use client";

/**
 * The frame for every app page — the reference chat page's shell: a white
 * 19rem sidebar with small-caps section labels, a translucent 57px header,
 * and a neutral-50 canvas.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bug, BookOpenText, Crown, Flame, FolderTree, Gavel, Gift, LayoutDashboard, ListChecks, Menu, MessagesSquare, ShieldCheck, Video, X, Check, Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { DEMO_LEARNERS, sanitizeLearner, useLearner } from "@/lib/learner";
import { api, type RewardsSummary } from "@/lib/api";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400", className)}>{children}</p>;
}

const NAV: { section?: string; items: { href: string; key: string; Icon: typeof ListChecks; also?: string[] }[] }[] = [
  {
    items: [
      { href: "/practice", key: "app.practice", Icon: ListChecks, also: ["/challenge"] },
      { href: "/mentoring", key: "app.mentoring", Icon: Video },
      { href: "/bounty", key: "app.bounty", Icon: Bug, also: ["/bounty/", "/bug-factory"] },
      { href: "/dashboard", key: "app.dashboard", Icon: LayoutDashboard },
    ],
  },
  {
    section: "app.learnBuild",
    items: [
      { href: "/repo", key: "app.repo", Icon: FolderTree },
      { href: "/taxonomy", key: "app.taxonomy", Icon: BookOpenText },
      { href: "/judges", key: "app.judges", Icon: Gavel },
    ],
  },
  {
    section: "app.learnTogether",
    items: [
      { href: "/community", key: "app.community", Icon: MessagesSquare },
      { href: "/rewards", key: "app.rewards", Icon: Gift },
    ],
  },
  {
    section: "app.more",
    items: [
      { href: "/admin", key: "app.admin", Icon: ShieldCheck },
      { href: "/pricing", key: "app.pricing", Icon: Crown },
    ],
  },
];

/** 🔥 streak · ⚡ points in the header — refreshes on navigation, on focus, and when a page says points changed. */
function StreakChip({ learner }: { learner: string }) {
  const path = usePathname();
  const [s, setS] = useState<RewardsSummary | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .rewardsSummary(learner)
        .then((r) => alive && setS(r))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    window.addEventListener("layerflow-points-refresh", load);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("layerflow-points-refresh", load);
      window.removeEventListener("focus", load);
    };
  }, [learner, path]);
  if (!s) return null;
  return (
    <span className="flex items-center gap-1.5">
    {s.plan === "pro" && (
      <Link href="/pricing" title="You're on Pro" className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-2.5 py-1 text-[11.5px] font-bold text-[#bbf451]">
        <Crown className="size-3.5" /> Pro
      </Link>
    )}
    <Link
      href="/rewards"
      title={s.today_done ? `${s.streak}-day streak — today is done` : s.at_risk ? `Solve one problem today to keep your ${s.streak}-day streak` : "Solve a problem to start a streak"}
      className="flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-2.5 py-1 text-[12px] font-semibold text-neutral-700 transition-colors hover:border-neutral-950"
    >
      <span className={cn("inline-flex items-center gap-0.5 tabular-nums", s.today_done ? "text-[#e8792b]" : "text-neutral-400")}>
        <Flame className={cn("size-3.5", s.today_done && "fill-[#f59e0b]/40", s.at_risk && "animate-pulse text-[#e8792b]")} />
        {s.streak}
      </span>
      <span className="h-3 w-px bg-neutral-200" />
      <span className="inline-flex items-center gap-0.5 tabular-nums text-neutral-800">
        <Zap className="size-3.5 fill-[#bbf451] text-[#4d7c0f]" />
        {s.points.toLocaleString("en-IN")}
      </span>
    </Link>
    </span>
  );
}

function LearnerPicker() {
  const { t } = useI18n();
  const [learner, setLearner] = useLearner();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [known, setKnown] = useState<string[]>(DEMO_LEARNERS);
  useEffect(() => {
    api
      .learners()
      .then((r) => setKnown([...new Set([...DEMO_LEARNERS, ...r.learners.map((l) => l.id).filter((id) => !/^(harness|judge_|scripted_learner)/.test(id))])].slice(0, 8)))
      .catch(() => {});
  }, [learner]);
  const all = learner && !known.includes(learner) ? [learner, ...known] : known;
  return (
    <section>
      <div className="mb-2.5 flex items-baseline gap-2 px-1">
        <SectionLabel>{t("app.learner")}</SectionLabel>
        <span className="ml-auto text-[10.5px] text-neutral-400">{t("app.pseudonymous")}</span>
      </div>
      <div className="space-y-0.5">
        {all.map((id) => (
          <button
            key={id}
            onClick={() => setLearner(id)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors",
              id === learner ? "bg-neutral-100" : "hover:bg-neutral-50",
            )}
          >
            <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold uppercase text-white", id === learner ? "bg-[#359462]" : "bg-neutral-300")}>
              {id.slice(0, 1)}
            </div>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-900">{id}</span>
            {id === learner && <Check className="size-3.5 text-[#359462]" />}
          </button>
        ))}
      </div>
      {adding ? (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const id = sanitizeLearner(draft);
            if (id.length >= 2) setLearner(id);
            setAdding(false);
            setDraft("");
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. ninja42"
            className="h-9 min-w-0 flex-1 rounded-full border border-neutral-200 bg-white px-3.5 text-[13px] outline-none focus:border-neutral-400"
          />
          <button className="h-9 rounded-full bg-neutral-950 px-3 text-[12px] font-semibold text-white">OK</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-neutral-300 py-2 text-[12px] font-medium text-neutral-500 transition-colors hover:border-neutral-950 hover:text-neutral-950">
          <Plus className="size-3.5" /> {t("app.newLearner")}
        </button>
      )}
    </section>
  );
}

function SandboxStatus() {
  const { t } = useI18n();
  const [h, setH] = useState<{ ok: boolean; llm: string | null; ai?: string | null; warm?: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = () =>
      api
        .health()
        .then((r) => alive && setH({ ok: r.ok, llm: r.llm, ai: r.ai, warm: r.sandbox?.warm }))
        .catch(() => alive && setH({ ok: false, llm: null }));
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-400">
      <span className={cn("size-1.5 rounded-full", h === null ? "bg-neutral-300" : h.ok ? "bg-[#359462]" : "bg-[#c64e27]")} />
      <span className="tabular-nums">{h === null ? "…" : h.ok ? `${t("app.sandboxUp")}${h.warm !== undefined ? ` · ${h.warm} warm` : ""}${h.ai ? " · AI mentor on" : h.llm ? " · LLM tier on" : " · no API key needed"}` : t("app.sandboxDown")}</span>
    </div>
  );
}

export function AppShell({ title, subtitle, actions, children, wide = false }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [learner] = useLearner();

  return (
    <div className="flex min-h-svh bg-neutral-50 font-sans text-neutral-950 antialiased">
      {open && <div className="fixed inset-0 z-30 bg-neutral-950/20 backdrop-blur-[2px] md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[19rem] flex-col border-r border-neutral-200/70 bg-white transition-transform duration-200 ease-out md:sticky md:top-0 md:h-svh md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="group flex items-center gap-2.5">
            <Logo className="h-8" />
            <ArrowUpRight className="size-3.5 text-neutral-300 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-500" />
          </Link>
          <button onClick={() => setOpen(false)} className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 md:hidden">
            <X className="size-4" />
          </button>
        </div>
        <div className="scroll-fade flex-1 space-y-7 overflow-y-auto px-4 pb-6">
          <nav className="space-y-4">
            {NAV.map((group, gi) => (
              <div key={gi} className="space-y-0.5">
                {group.section && <SectionLabel className="mb-1.5 px-3">{t(group.section)}</SectionLabel>}
                {group.items.map(({ href, key, Icon, also }) => {
                  const active = path === href || !!also?.some((p) => path.startsWith(p));
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-semibold tracking-[-0.01em] transition-colors",
                        active ? "bg-[#bbf451] text-black" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950",
                      )}
                    >
                      <Icon className="size-4" />
                      {t(key)}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <LearnerPicker />
          <section>
            <SectionLabel className="mb-2.5 px-1">How your code runs</SectionLabel>
            <dl className="overflow-hidden rounded-2xl border border-neutral-200/70 text-[12px]">
              {[
                ["Runtime", "Pyodide · WebAssembly"],
                ["Process", "fresh per submission"],
                ["Host files", "none (permission model)"],
                ["Hidden tests", "API memory only"],
                ["Hints", "prose-only, validated"],
                ["Mentor & chat", "same no-code guardrail"],
              ].map(([k, v], i) => (
                <div key={k} className={cn("flex items-center justify-between gap-3 px-3.5 py-2", i % 2 ? "bg-neutral-50/70" : "bg-white")}>
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="text-right font-semibold tracking-[-0.01em] text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <div className="border-t border-neutral-100 px-5 py-4">
          <SandboxStatus />
        </div>
      </aside>

      <div className="relative isolate flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[57px] shrink-0 items-center justify-between border-b border-neutral-200/70 bg-neutral-50/70 px-5 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} className="flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 md:hidden">
              <Menu className="size-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">{title}</p>
              {subtitle && <p className="hidden truncate text-[11px] text-neutral-400 sm:block">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {actions}
            {learner && <StreakChip learner={learner} />}
            {learner && (
              <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3 py-1 text-[12px] font-semibold text-neutral-700 hover:border-neutral-950 sm:flex">
                <span className="size-1.5 rounded-full bg-[#359462]" />
                {learner}
              </Link>
            )}
            <LanguageSwitcher variant="chat" />
            <ThemeToggle variant="chat" />
          </div>
        </header>
        <main className={cn("mx-auto w-full flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-24", wide ? "max-w-[90rem]" : "max-w-6xl")}>{children}</main>
      </div>
      <ChatWidget />
    </div>
  );
}
