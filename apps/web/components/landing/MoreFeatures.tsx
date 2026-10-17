"use client";

/**
 * Landing section: everything past practice — Bug Bounty, the daily streak,
 * goodies and UPI payouts (Razorpay), Website Analyse, the repo
 * debugger, company programs and the three languages. Same pastel bento as
 * the feature boxes above; every box links to the real page.
 */
import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, CircleCheck, Flame, Lock, TriangleAlert } from "lucide-react";
import { TechLogo } from "@/components/app/Logo";

const TITLE = "text-[22px] font-medium leading-[1.08] tracking-[-0.04em] sm:text-[28px] sm:leading-[1.05] sm:tracking-[-0.045em]";
const BODY = "mt-3 max-w-[420px] text-[13.5px] font-medium leading-[1.42] tracking-[-0.02em] text-[#6D6878] sm:text-[15px] sm:leading-[1.45] sm:tracking-[-0.025em]";

function Box({ href, tint, accent, accentDark, title, body, className, children, i }: { href: string; tint: string; accent: string; accentDark: string; title: string; body: string; className?: string; children: React.ReactNode; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: (i % 3) * 0.08 }} className={className}>
      <Link href={href} className={`group flex h-full flex-col overflow-hidden rounded-3xl border px-6 py-6 transition-transform hover:-translate-y-1 sm:px-8 sm:py-7 ${tint}`}>
        <h3 className={`flex items-start justify-between gap-3 dark:!text-[var(--accent-dark)] ${TITLE}`} style={{ color: accent, ["--accent-dark" as string]: accentDark }}>
          {title}
          <ArrowUpRight className="mt-1 size-5 shrink-0 opacity-40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
        </h3>
        <p className={BODY}>{body}</p>
        <div className="mt-5 flex min-h-0 flex-1 flex-col justify-end">{children}</div>
      </Link>
    </motion.div>
  );
}

/* ── mocks: small, quiet pictures of the real screens ── */

function BountyMock() {
  const programs = [
    ["shopkart", "ShopKart", "online shop API", "Beginner", "1 / 5"],
    ["campusconnect", "CampusConnect", "student portal", "Intermediate", "0 / 5"],
    ["paylite", "PayLite", "UPI-style wallet", "Advanced", "0 / 6"],
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-2">
        {programs.map(([id, name, sub, level, found], k) => (
          <motion.div key={id} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + k * 0.12 }} className="flex items-center gap-2.5 rounded-2xl border border-[#f0d9b8] bg-white/90 px-3 py-2">
            <img src={`/brands/${id}.svg`} alt="" className="size-8 rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-neutral-900">{name}</span>
              <span className="block truncate text-[10.5px] text-neutral-500">{sub}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[10px] font-semibold text-[#96681c]">{level}</span>
              <span className="block text-[10px] text-neutral-400">{found} found</span>
            </span>
          </motion.div>
        ))}
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-[#111318] py-2 font-mono text-[10.5px] leading-[19px] text-[#c3c7cd]">
        {[
          [30, '@app.get("/search")'],
          [31, "def search():"],
          [32, '    q = request.args.get("q", "")'],
          [33, "    rows = db.query(f\"SELECT … LIKE '%{q}%'\")"],
          [34, "    return jsonify(results=rows)"],
        ].map(([n, l]) => (
          <div key={n} className={`flex whitespace-pre pr-3 ${n === 33 ? "bg-[#c64e27]/25 text-white" : ""}`}>
            <span className="flex w-5 shrink-0 items-center justify-center">{n === 33 && <span className="size-2 rounded-full bg-[#ef4444]" />}</span>
            <span className="w-6 shrink-0 text-right text-[#5b616b]">{n}</span>
            <span className="pl-3">{l}</span>
          </div>
        ))}
        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.8 }} className="mx-3 mb-1 mt-2 flex items-center gap-2 rounded-xl bg-[#eeffe8] px-3 py-2 font-sans text-[11.5px] text-[#2f7c53]">
          <CircleCheck className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-semibold">Confirmed · SQL injection</span>
          <span className="font-bold">+1,000 pts</span>
        </motion.div>
      </div>
    </div>
  );
}

function StreakMock() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div>
      <div className="flex items-end gap-2">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-neutral-900">13</span>
        <span className="pb-1.5 text-[13px] font-medium text-neutral-500">day streak</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d, k) => (
          <motion.div key={k} initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 + k * 0.08 }} className="flex flex-col items-center gap-1">
            <span className={`flex size-8 items-center justify-center rounded-full ${k < 6 ? "bg-[#f59e0b] text-white" : "border-2 border-dashed border-[#f0c76e] text-[#d9a440]"}`}>
              <Flame className="size-4" />
            </span>
            <span className="text-[10px] font-medium text-neutral-400">{d}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/80 px-3.5 py-2.5 text-[12px]">
        <span className="text-neutral-600">Each streak day</span>
        <span className="font-semibold text-neutral-900">+100 pts = ₹10</span>
      </div>
    </div>
  );
}

function RedeemMock() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {["cap", "mug", "tshirt"].map((g, k) => (
          <motion.img key={g} src={`/goodies/${g}.webp`} alt="" initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + k * 0.1 }} className="aspect-[4/3] w-full rounded-xl bg-[#dfdcd9] object-cover" />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-white/85 px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold text-neutral-900">Withdraw ₹200 to UPI</span>
          <span className="block truncate font-mono text-[10.5px] text-neutral-500">khushi.s@okaxis</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10.5px] text-neutral-600">
          <img src="/logos/razorpay.svg" alt="" className="size-3.5" /> Razorpay
        </span>
      </div>
    </div>
  );
}

function SiteMock() {
  const scores = [
    ["Security", 73, "#5aa832"],
    ["Speed", 94, "#359462"],
    ["SEO", 84, "#5aa832"],
    ["Access", 94, "#359462"],
  ] as const;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-full border border-[#c6dafc] bg-white/90 px-3.5 py-2 text-[12px] text-neutral-700">
        <Lock className="size-3.5 text-[#2f7c53]" /> python.org
        <span className="ml-auto rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10.5px] font-semibold text-white">Analyse</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {scores.map(([k, v, c], i) => (
          <div key={k} className="rounded-xl bg-white/85 px-2 py-2">
            <p className="text-[9.5px] font-medium text-neutral-500">{k}</p>
            <p className="text-[18px] font-semibold leading-tight tabular-nums" style={{ color: c }}>
              {v}
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
              <motion.div className="h-full rounded-full" style={{ backgroundColor: c }} initial={{ width: 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1, duration: 0.8 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-lg border border-[#fde1a8] bg-[#fff6e3] px-2 py-0.5 text-[11px] font-medium text-[#96681c]">
          <TechLogo name="jQuery" size={12} /> jQuery 1.8.2 <TriangleAlert className="size-3" />
        </span>
        {["nginx", "Font Awesome"].map((n) => (
          <span key={n} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700">
            <TechLogo name={n} size={12} /> {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function DebuggerMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#23262d] bg-[#111318]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 font-mono text-[10px] text-[#8b919a]">
        src / routes / <b className="font-semibold text-white">files.js</b>
        <span className="ml-auto rounded bg-[#c64e27]/25 px-1.5 text-[9.5px] font-semibold text-[#fca5a5]">High risk</span>
      </div>
      <div className="py-1.5 font-mono text-[10.5px] leading-[19px] text-[#c3c7cd]">
        {[
          [11, 'router.get("/download", (req, res) => {'],
          [12, "  const name = req.query.file;"],
          [13, "  res.sendFile(path.join(DIR, name));"],
          [14, "});"],
        ].map(([n, l]) => (
          <div key={n} className={`flex whitespace-pre pr-3 ${n === 13 ? "bg-[#c64e27]/25 text-white" : ""}`}>
            <span className="flex w-5 shrink-0 items-center justify-center">{n === 13 && <span className="size-2 rounded-full bg-[#ef4444]" />}</span>
            <span className="w-6 shrink-0 text-right text-[#5b616b]">{n}</span>
            <span className="pl-3">{l}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-white/10 px-3 py-2 text-[11px] text-[#d4d7dc]">
        <b className="text-white">Path traversal.</b> <span className="text-[#9aa0a8]">Keep only the file name — path.basename(name).</span>
      </p>
    </div>
  );
}

function HostMock() {
  const plans = [
    ["Community", "Free", false],
    ["Starter", "₹1,999", true],
    ["Growth", "₹4,999", false],
  ] as const;
  const logos = ["google", "meta", "github", "gitlab", "nextcloud", "firefoxbrowser"];
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="rounded-2xl border border-neutral-200 bg-white/90 p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {plans.map(([name, price, on]) => (
            <div key={name} className={`rounded-xl border-2 px-2 py-2 ${on ? "border-neutral-900" : "border-neutral-200"}`}>
              <p className="text-[11px] font-semibold text-neutral-900">{name}</p>
              <p className="text-[13px] font-semibold tabular-nums text-neutral-700">{price}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 text-[10.5px] text-neutral-500">
            <img src="/logos/razorpay.svg" alt="" className="size-3.5" /> Checkout by <b className="font-semibold text-neutral-800">Razorpay</b>
          </span>
          <span className="shrink-0 rounded-lg bg-[#3395FF] px-2.5 py-1 text-[11px] font-semibold text-white">Pay ₹1,999</span>
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white/90 p-3">
        <p className="text-[10.5px] font-medium text-neutral-500">And real public programs</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {logos.map((l) => (
            <span key={l} className="flex h-9 items-center justify-center rounded-lg border border-neutral-100 bg-[#ffffff]">
              <img src={`/logos/${l}.svg`} alt="" className="size-4.5" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LanguageMock() {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {["English", "हिन्दी", "मराठी"].map((l, k) => (
          <span key={l} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${k === 1 ? "bg-neutral-900 text-white dark:!bg-white dark:!text-neutral-900" : "border border-neutral-200 bg-white text-neutral-700"}`}>
            {l}
          </span>
        ))}
      </div>
      <div className="flex items-start gap-2 rounded-2xl bg-white/90 p-3">
        <img src="/people/priya.jpg" alt="" className="size-7 shrink-0 rounded-full object-cover" />
        <p className="text-[12.5px] leading-[1.5] text-neutral-700">लाइन 4 पर ध्यान दो — लूप एक क़दम पहले रुक जाता है।</p>
      </div>
    </div>
  );
}

export function MoreFeatures() {
  return (
    <section id="earn" className="bg-neutral-50 py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-600">
            <Flame className="size-3.5 text-[#f59e0b]" /> Beyond practice
          </span>
          <h2 className="mt-4 text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl md:text-5xl">Learn it. Prove it. Get rewarded.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600 sm:text-lg">Hunt real bugs, check real projects and websites, keep a daily streak — and turn your points into goodies or rupees.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Box i={0} className="md:col-span-2" href="/bounty" tint="border-[#f0d9b8]/70 bg-[#fff2df] lf-tint-orange" accent="#c64e27" accentDark="#f4895f" title="Bug Bounty" body="Practise on small apps with real bugs planted in them: click the line, name the bug, and it's confirmed in seconds. Then move on to company and open-source programs.">
            <BountyMock />
          </Box>
          <Box i={1} href="/rewards" tint="border-[#fde1a8]/80 bg-[#fff8e6] lf-tint-amber" accent="#b7791f" accentDark="#f5b942" title="Daily streak" body="Solve one problem a day to keep it alive. Every streak day pays 100 points.">
            <StreakMock />
          </Box>
          <Box i={2} href="/rewards" tint="border-[#ddd0ff]/70 bg-[#f2eeff] lf-tint-purple" accent="#5e2ac4" accentDark="#b69cff" title="Goodies or cash" body="100 points are ₹10. Spend them on Layerflow merch, or withdraw to UPI.">
            <RedeemMock />
          </Box>
          <Box i={3} href="/repo" tint="border-[#c6dafc]/80 bg-[#eef4ff] lf-tint-sky" accent="#1a73e8" accentDark="#6aa8ff" title="Check any website" body="No public repo? Paste a URL: security headers, speed, SEO and accessibility — plus what the site is built with.">
            <SiteMock />
          </Box>
          <Box i={4} href="/repo" tint="border-[#f3c8b8]/80 bg-[#fdeee8] lf-tint-orange" accent="#a8401f" accentDark="#f4895f" title="A debugger for your repo" body="50 bug rules read your GitHub project line by line — SQL injection, path traversal, leaked secrets — and pin each one with its fix.">
            <DebuggerMock />
          </Box>
          <Box i={5} className="md:col-span-2" href="/bounty" tint="border-[#cfe9c8]/80 bg-[#eeffe8] lf-tint-green" accent="#359462" accentDark="#5fd08f" title="Companies host programs too" body="Post what hunters may test and what each bug is worth, pay for a plan through Razorpay, and triage the reports yourself. Or follow the links to real public programs.">
            <HostMock />
          </Box>
          <Box i={6} href="/mentoring" tint="border-[#fbcfe8]/80 bg-[#fdf2f8] dark:border-white/10 dark:bg-white/[0.04]" accent="#be185d" accentDark="#f472b6" title="Speaks your language" body="The app, Priya's chat and the bug bounty walkthrough work in English, Hindi and Marathi.">
            <LanguageMock />
          </Box>
        </div>
      </div>
    </section>
  );
}
