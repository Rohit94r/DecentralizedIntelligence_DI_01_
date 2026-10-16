"use client";

/**
 * The Layerflow landing page — section for section the reference layout
 * (floating pill navbar, illustrated hero + dark app mockup, video stat cards,
 * pastel bento features, tabbed app showcase, live table, CTA, partner card,
 * footer), carrying Layerflow's product and its real numbers.
 */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { ArrowUpRight, CheckCircle2, Lightbulb, ShieldCheck, Bug, Timer, CircleAlert } from "lucide-react";
import { Navbar } from "./Navbar";
import { Button } from "./ui/button";
import { AnimatedList } from "./ui/animated-list";
import { Globe } from "./ui/globe";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { CTA11 } from "./ui/cta-11";
import { Footer } from "./footer";
import AppShowcase from "./landing/AppShowcase";
import { DashboardPreview } from "./landing/DashboardPreview";
import { HintWheelBox } from "./landing/HintWheelBox";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { api, timeAgo } from "@/lib/api";

const FEED_STYLE = [
  { icon: "🧩", color: "#c64e27" },
  { icon: "💡", color: "#0ea5e9" },
  { icon: "✅", color: "#359462" },
  { icon: "🛡️", color: "#8b5cf6" },
  { icon: "⏱️", color: "#f59e0b" },
];

function NotificationCard({ name, description, icon, color, time }: { name: string; description: string; icon: string; color: string; time: string }) {
  return (
    <figure
      className={cn(
        "relative mx-auto w-full cursor-pointer overflow-hidden rounded-2xl p-3",
        "transition-all duration-200 ease-in-out hover:scale-[103%]",
        "bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color }}>
          <span className="text-base">{icon}</span>
        </div>
        <div className="flex min-w-0 flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center gap-1 text-sm font-semibold text-neutral-900">
            <span className="truncate font-mono text-[13px]">{name}</span>
            <span className="text-neutral-300">·</span>
            <span className="shrink-0 text-[11px] font-medium text-neutral-400">{time}</span>
          </figcaption>
          <p className="truncate text-xs font-medium text-neutral-500">{description}</p>
        </div>
      </div>
    </figure>
  );
}

const HEAT_LEVELS = ["bg-[#f0e4d2]", "bg-[#f5c9a8]", "bg-[#e8956a]", "bg-[#d96a3a]", "bg-[#c64e27]"];
const LEVEL_ATTEMPTS = [0, 2, 4, 7, 11];

function buildContributionWeeks(weekCount = 14) {
  let seed = 42;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (weekCount - 1) * 7);
  const weeks: Array<Array<{ level: number; n: number; date: string } | null>> = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: Array<{ level: number; n: number; date: string } | null> = [];
    for (let day = 0; day < 7; day++) {
      if (cursor > end) week.push(null);
      else {
        const roll = next();
        let level = 0;
        if (roll > 0.35) level = 1;
        if (roll > 0.55) level = 2;
        if (roll > 0.75) level = 3;
        if (roll > 0.9) level = 4;
        if (day >= 1 && day <= 5 && level > 0 && next() > 0.5) level = Math.min(4, level + 1);
        week.push({ level, n: LEVEL_ATTEMPTS[level], date: cursor.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function ContributionGraph({ weeks }: { weeks: Array<Array<{ level: number; n: number; date: string } | null>> }) {
  const { t } = useI18n();
  const dayLabels = ["", "M", "", "W", "", "F", ""];
  return (
    <div className="mt-5 w-full">
      <TooltipProvider delayDuration={100}>
        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-[3px] pr-0.5">
            {dayLabels.map((label, i) => (
              <span key={i} className="flex h-[11px] w-3 items-center justify-end text-[8px] font-medium leading-none text-[#b08968]">
                {label}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 justify-between gap-[3px] overflow-hidden">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-rows-7 gap-[3px]">
                {week.map((cell, di) =>
                  cell ? (
                    <Tooltip key={di}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${cell.date}: ${cell.n} attempts`}
                          className={`h-[11px] w-[11px] rounded-[2px] transition-transform duration-150 hover:scale-125 hover:ring-1 hover:ring-[#c64e27]/40 focus:outline-none ${HEAT_LEVELS[cell.level]}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6} className="border-0 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white">
                        <span className="font-semibold">{cell.date}</span>
                        <span className="ml-1.5 text-neutral-300">{cell.n === 0 ? t("features.noPractice") : t("features.practiced", { n: cell.n })}</span>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={di} className="h-[11px] w-[11px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] font-medium text-[#b08968]">
        <span>{t("features.less")}</span>
        {HEAT_LEVELS.map((color, i) => (
          <span key={i} className={`h-[10px] w-[10px] rounded-[2px] ${color}`} />
        ))}
        <span>{t("features.more")}</span>
      </div>
    </div>
  );
}

type FeedItem = Awaited<ReturnType<typeof api.feed>>["items"][number];

const SAMPLE_ROWS: FeedItem[] = [
  { submission_id: "s_0142", learner_id: "rohan", challenge_id: "last-k-total", title: "Last K Total", passed: false, tags: ["unhandled_short_input"], hints: 2, duration_ms: 310, at: new Date(Date.now() - 120_000).toISOString() },
  { submission_id: "s_0141", learner_id: "meera", challenge_id: "count-passes", title: "Count Passes", passed: true, tags: [], hints: 0, duration_ms: 190, at: new Date(Date.now() - 400_000).toISOString() },
  { submission_id: "s_0140", learner_id: "kabir", challenge_id: "first-n-squares", title: "First N Squares", passed: false, tags: ["off_by_one"], hints: 1, duration_ms: 240, at: new Date(Date.now() - 900_000).toISOString() },
  { submission_id: "s_0139", learner_id: "rohan", challenge_id: "middle-three", title: "Middle Three", passed: false, tags: ["print_not_return"], hints: 0, duration_ms: 220, at: new Date(Date.now() - 1_800_000).toISOString() },
  { submission_id: "s_0138", learner_id: "meera", challenge_id: "grade-letter", title: "Grade Letter", passed: false, tags: ["boundary_comparison"], hints: 0, duration_ms: 205, at: new Date(Date.now() - 3_600_000).toISOString() },
];
const AVATAR = ["bg-purple-500", "bg-blue-500", "bg-orange-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"];

export const Hero = () => {
  const { t, dict, lang } = useI18n();
  const contributionWeeks = useMemo(() => buildContributionWeeks(14), []);
  const [rows, setRows] = useState<FeedItem[]>(SAMPLE_ROWS);
  const [live, setLive] = useState(false);
  const [stats, setStats] = useState({ contained: 15, labels: 12, leaks: 0 });

  useEffect(() => {
    api
      .feed()
      .then((f) => {
        if (f.items.length) {
          setRows(f.items.slice(0, 6));
          setLive(true);
        }
      })
      .catch(() => {});
    api
      .stats()
      .then((s) => setStats((x) => ({ ...x, contained: s.hostile_programs })))
      .catch(() => {});
  }, []);

  const globeConfig = useMemo(
    () => ({
      width: 800,
      height: 800,
      onRender: () => {},
      devicePixelRatio: 2,
      phi: 0,
      theta: 0.3,
      dark: 0,
      diffuse: 0.45,
      mapSamples: 16000,
      mapBrightness: 1.15,
      baseColor: [0.92, 0.9, 1] as [number, number, number],
      markerColor: [0.37, 0.16, 0.77] as [number, number, number],
      glowColor: [0.95, 0.93, 1] as [number, number, number],
      markers: [
        { location: [18.6298, 73.7997] as [number, number], size: 0.12 }, // Pune
        { location: [19.076, 72.8777] as [number, number], size: 0.08 },
        { location: [28.6139, 77.209] as [number, number], size: 0.07 },
        { location: [12.9716, 77.5946] as [number, number], size: 0.07 },
        { location: [51.5074, -0.1278] as [number, number], size: 0.06 },
        { location: [40.7128, -74.006] as [number, number], size: 0.06 },
        { location: [1.3521, 103.8198] as [number, number], size: 0.05 },
        { location: [35.6762, 139.6503] as [number, number], size: 0.05 },
      ],
    }),
    [],
  );

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-neutral-50 font-sans text-neutral-950">
      <Navbar />

      <section id="home" className="relative isolate overflow-hidden px-4 pb-14 pt-36 sm:min-h-[110vh] sm:pb-0 sm:pt-36">
        <div className="absolute inset-x-0 top-0 -z-10 h-screen overflow-hidden">
          <div className="h-full w-full bg-[url('/trendybg.png')] bg-cover bg-center" />
        </div>
        <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-white via-white/70 to-transparent" />
        {/* dark mode: the white headline needs a scrim over the bright sky */}
        <div className="absolute inset-x-0 top-0 -z-10 hidden h-screen bg-gradient-to-b from-black/75 via-black/45 to-black/10 dark:block" />

        <div className="mx-auto flex w-full max-w-7xl flex-col items-center text-center">
          <div className="pt-12 sm:pt-[15vh]">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-900/10 bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-700 backdrop-blur">
              <span className="size-1.5 rounded-full bg-[#359462]" /> DI-01 · Kurukshetra 2026 · Python
            </span>
            <h1
              className={cn(
                "mx-auto max-w-[22rem] text-[2.2rem] font-bold tracking-[-0.01em] text-black/90 sm:max-w-4xl sm:text-5xl sm:tracking-[-0.02em] md:text-7xl",
                lang === "en" ? "leading-[1.04] sm:leading-[0.92]" : "leading-[1.28] sm:leading-[1.15]",
              )}
            >
              {t("hero.headline")}
            </h1>
            <p className="mx-auto mt-4 max-w-[21rem] text-[13px] leading-6 text-black/80 sm:mt-6 sm:max-w-xl sm:text-base sm:leading-7 lg:text-lg">{t("hero.subhead")}</p>
            <div className="mx-auto mt-7 flex w-full max-w-[23rem] flex-col items-center justify-center gap-3 px-0 sm:mt-10 sm:w-auto sm:max-w-none sm:flex-row">
              <Button asChild size="lg" className="h-11 w-full rounded-full bg-neutral-950 px-8 text-sm font-semibold text-white hover:bg-neutral-800 sm:h-12 sm:w-auto sm:text-lg">
                <Link href="/practice">{t("hero.ctaPrimary")}</Link>
              </Button>
              <Button
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="h-11 w-full rounded-full border border-lime-500/70 bg-lime-300 px-8 text-sm font-semibold text-black transition-all duration-200 hover:bg-lime-400 sm:h-12 sm:w-auto sm:text-lg"
              >
                {t("hero.ctaSecondary")}
              </Button>
            </div>
          </div>
          <div className="mt-9 w-full max-w-6xl px-0 sm:mt-12 sm:px-4">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section id="stats" className="mt-16 overflow-hidden bg-neutral-50 sm:mt-20">
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 sm:gap-5 sm:py-10">
          <h1 className="max-w-sm text-center text-3xl font-medium leading-tight sm:max-w-lg sm:text-4xl md:text-5xl">{t("stats.heading")}</h1>
          <p className="text-center text-base text-neutral-600 sm:text-xl">{t("stats.subhead")}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-6 px-4 sm:gap-10 sm:px-0 lg:flex-row">
          {[
            { videoSrc: "/video1.webm", value: stats.contained, suffix: `/${stats.contained}`, description: t("stats.c1") },
            { videoSrc: "/video2.webm", value: stats.labels, suffix: "/12", description: t("stats.c2") },
            { videoSrc: "/video3.webm", value: stats.leaks, suffix: "", description: t("stats.c3") },
          ].map((card, index) => (
            <div key={index} className="mt-5 rounded-2xl bg-white p-2 shadow-md ring-1 ring-neutral-100 md:mt-0">
              <div className="h-[240px] w-80 max-w-80 overflow-hidden rounded-xl bg-neutral-100 px-2 py-2">
                <video src={card.videoSrc} className="h-full w-full rounded-xl object-cover" preload="auto" autoPlay muted loop playsInline />
              </div>
              <div className="px-4 py-3">
                <h2 className="text-xl font-semibold">
                  <NumberFlow value={card.value} className="inline-block tabular-nums" />
                  {card.suffix}
                </h2>
                <p className="whitespace-nowrap text-base font-medium text-neutral-500">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="my-10 overflow-hidden bg-neutral-50 py-10 md:my-20 md:py-20">
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 sm:gap-5 sm:px-6 sm:py-10 lg:px-8">
          <h1 className="max-w-sm text-center text-3xl font-medium leading-tight sm:max-w-lg sm:text-4xl md:text-5xl">{t("features.heading")}</h1>
          <p className="text-center text-base text-neutral-600 sm:text-xl">{t("features.subhead")}</p>
          <div className="mt-8 grid w-full max-w-7xl grid-cols-1 gap-5 px-5 sm:mt-10 sm:px-0 md:grid-cols-3">
            {/* 1 — safe runs */}
            <div className="grid h-full flex-col items-start justify-start overflow-hidden rounded-3xl border border-purple-300/50 bg-purple-100/60">
              <div>
                <video src="/firstbox.mp4" className="-mt-7 h-4/5 w-full scale-110 rounded-xl object-cover" preload="auto" autoPlay muted loop playsInline />
              </div>
              <div className="px-8 py-5">
                <div className="[&_h3]:leading-[1.18]">
                  <h3 className="text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                    <span className="block text-[#7B35F0]">{t("features.box1Title1")}</span>
                    <span className="block text-[#17152A]">{t("features.box1Title2")}</span>
                  </h3>
                </div>
                <p className="mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">{t("features.box1Body")}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["passed", "wrong_output", "runtime_error", "timeout"].map((o) => (
                    <span key={o} className={`out-${o} rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold`}>
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 2 — the hint ladder */}
            <HintWheelBox />

            {/* 3 — practice heatmap */}
            <div className="flex h-100 flex-col overflow-hidden rounded-3xl border border-[#f0d9b8]/70 bg-[#fff2df] px-6 py-6 sm:px-8 sm:py-7">
              <h3 className="max-w-xs text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                <span className="block text-[#c64e27]">{t("features.box3Title")}</span>
              </h3>
              <p className="mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">{t("features.box3Body")}</p>
              <div className="mt-5">
                <ContributionGraph weeks={contributionWeeks} />
              </div>
            </div>

            {/* 4 — live feed */}
            <div className="flex h-100 flex-col overflow-hidden rounded-3xl border border-[#cfe9c8]/80 bg-[#eeffe8] px-6 py-6 sm:px-8">
              <h3 className="max-w-xs text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                <span className="block text-[#359462]">{t("features.box4Title")}</span>
              </h3>
              <p className="mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">{t("features.box4Body")}</p>
              <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
                <AnimatedList delay={1800} className="gap-2.5">
                  {Array.from({ length: 8 }, () => dict.feed.map((item, i) => ({ ...item, ...FEED_STYLE[i % FEED_STYLE.length] })))
                    .flat()
                    .map((item, idx) => (
                      <NotificationCard {...item} key={idx} />
                    ))}
                </AnimatedList>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#eeffe8] to-transparent" />
              </div>
            </div>

            {/* 5 — anywhere, offline */}
            <div className="relative flex h-100 flex-col overflow-hidden rounded-3xl border border-[#ddd0ff]/70 bg-[#f2eeff] px-6 py-6 sm:px-8">
              <h3 className="relative z-10 max-w-xs text-[22px] font-medium leading-[1.08] tracking-[-0.04em] text-[#151515] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]">
                <span className="block text-[#5e2ac4]">{t("features.box5Title")}</span>
              </h3>
              <p className="relative z-10 mt-3 max-w-[360px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]">{t("features.box5Body")}</p>
              <div className="relative mt-2 min-h-0 flex-1">
                <Globe className="left-1/2 top-0 max-w-none -translate-x-1/2 scale-110" config={globeConfig} />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(94,42,196,0.12),transparent_55%)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-neutral-50 py-10 md:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl md:text-5xl">{t("showcase.heading")}</h2>
            <p className="mt-2 text-base text-neutral-600 sm:text-xl">{t("showcase.subhead")}</p>
          </div>
          <AppShowcase />
        </div>
      </section>

      <section id="preview" className="bg-neutral-50 py-16 md:py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-5 px-4 sm:px-6 lg:px-8">
          <h1 className="max-w-lg text-center text-3xl font-medium leading-tight sm:text-4xl md:text-5xl">{t("previewSection.heading")}</h1>
          <p className="max-w-lg text-center text-base text-neutral-600 sm:text-lg md:text-xl">{t("previewSection.subhead")}</p>
          <div className="mt-5 w-full overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-sm sm:p-4">
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-100 hover:bg-transparent">
                  <TableHead className="pl-4 font-bold text-neutral-600">{t("previewSection.tableUser")}</TableHead>
                  <TableHead className="font-bold text-neutral-600">{t("previewSection.tableActivity")}</TableHead>
                  <TableHead className="font-bold text-neutral-600">{t("previewSection.tableDuration")}</TableHead>
                  <TableHead className="font-bold text-neutral-600">{t("previewSection.tableHints")}</TableHead>
                  <TableHead className="font-bold text-neutral-600">{t("previewSection.tableTime")}</TableHead>
                  <TableHead className="pr-4 text-right font-bold text-neutral-600">{t("previewSection.tableStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.submission_id + idx} className="border-neutral-100/50 transition-colors hover:bg-neutral-50/50">
                    <TableCell className="py-3.5 pl-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold uppercase text-white shadow-sm ${AVATAR[idx % AVATAR.length]}`}>{row.learner_id.slice(0, 2)}</div>
                        <span className="text-sm font-bold text-neutral-900">{row.learner_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-neutral-600">
                      <div className="flex items-center gap-2">
                        {row.passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Bug className="h-4 w-4 shrink-0 text-orange-500" />}
                        <span>{row.title}</span>
                        {row.tags[0] && <span className="hidden rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10.5px] text-neutral-600 md:inline">{row.tags[0]}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-neutral-900">
                      <span className="inline-flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5 text-neutral-400" />
                        {(row.duration_ms / 1000).toFixed(2)}s
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-neutral-500">
                      <span className="flex items-center gap-1.5">
                        <Lightbulb className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
                        <span className="font-bold text-neutral-800">{row.hints}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-neutral-400">{timeAgo(row.at)}</TableCell>
                    <TableCell className="py-3.5 pr-4 text-right">
                      {row.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/50 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                          {t("previewSection.passed")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                          <CircleAlert className="h-3 w-3 shrink-0 text-amber-600" />
                          {t("previewSection.diagnosed")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="px-4 pb-1 pt-3 text-right text-[11px] text-neutral-400">{live ? "● live from this Layerflow database" : "sample rows — start the API to see live ones"}</p>
          </div>
        </div>
      </section>

      <CTA11 />

      <section className="bg-neutral-50 px-4 py-16 md:py-24">
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-sm">
          <div className="relative isolate min-h-[360px] bg-[url('/cta.jpeg')] bg-cover bg-center px-6 py-8 sm:px-10 sm:py-10 md:min-h-[390px] md:px-12">
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.82)_44%,rgba(255,255,255,0.28)_72%,rgba(255,255,255,0.05)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-black/10 to-transparent" />
            <div className="flex min-h-[300px] flex-col justify-between gap-10 md:min-h-[310px] md:flex-row md:items-center">
              <div className="max-w-[34rem]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900/10 bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-700 backdrop-blur">
                  <ShieldCheck className="size-3.5" /> {t("sponsor.badge")}
                </span>
                <h2 className="mt-5 max-w-lg text-3xl font-medium leading-tight text-neutral-950 sm:text-4xl md:text-5xl">{t("sponsor.heading")}</h2>
                <p className="mt-5 max-w-md text-sm font-medium leading-7 text-neutral-700 sm:text-base">{t("sponsor.body")}</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:max-w-xs">
                <Button asChild className="group h-12 justify-between rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800">
                  <Link href="/judges">
                    {t("sponsor.primary")}
                    <ArrowUpRight className="h-4 w-4 text-white/70 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="group h-12 justify-between rounded-full border-white/80 bg-white/80 px-5 text-sm font-semibold text-neutral-950 backdrop-blur hover:bg-white hover:text-black">
                  <Link href="/ledger">
                    {t("sponsor.secondary")}
                    <ArrowUpRight className="h-4 w-4 text-neutral-500 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Hero;
