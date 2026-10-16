"use client";

/** Landing section: Mentoring, Repo Analyse and Community — "never learn alone". */
import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, EyeOff, Hand, MicOff, PhoneOff, Sparkles, VideoOff } from "lucide-react";

function MeetMock() {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#202124] p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-[#3c4043] shadow-[inset_0_0_0_2px_#8ab4f8]">
          <img src="/people/priya.jpg" alt="" className="h-full w-full object-cover" />
          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center gap-[2px] rounded-full bg-[#1a73e8]">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="w-[2px] rounded-full bg-white" animate={{ height: [3, 8, 4, 7, 3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </span>
          <span className="absolute bottom-1 left-1.5 text-[9px] font-medium text-white">Priya</span>
        </div>
        <div className="relative flex aspect-video items-center justify-center rounded-lg bg-[#3c4043]">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#7b5ea7] text-sm font-medium text-white">R</span>
          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-[#202124]/70">
            <MicOff className="size-2.5 text-white" />
          </span>
          <span className="absolute bottom-1 left-1.5 text-[9px] font-medium text-white">Rohan (You)</span>
        </div>
      </div>
      <div className="mx-auto mt-2 max-w-[90%] rounded bg-black/70 px-2 py-1 text-center text-[9.5px] leading-tight text-white">Look closely — step 3, on line 4. That's where it goes off track…</div>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-[#ea4335]">
          <MicOff className="size-3 text-white" />
        </span>
        <span className="flex size-6 items-center justify-center rounded-full bg-[#ea4335]">
          <VideoOff className="size-3 text-white" />
        </span>
        <span className="flex h-6 items-center gap-1 rounded-full bg-[#bbf451] px-2 text-[9.5px] font-bold text-black">
          <Sparkles className="size-2.5" /> Summarise
        </span>
        <span className="flex size-6 items-center justify-center rounded-full bg-[#3c4043]">
          <Hand className="size-3 text-white" />
        </span>
        <span className="flex h-6 w-8 items-center justify-center rounded-full bg-[#ea4335]">
          <PhoneOff className="size-3 text-white" />
        </span>
      </div>
    </div>
  );
}

function RepoMock() {
  const layers = [
    ["Screens (UI)", true],
    ["API / routes", true],
    ["Logic (services)", false],
    ["Data access", true],
  ] as const;
  return (
    <div className="rounded-2xl border border-[#cfe9c8] bg-white/80 p-3">
      <div className="flex items-center gap-3">
        <div className="relative size-14">
          <svg viewBox="0 0 40 40" className="size-full -rotate-90">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#eef2e6" strokeWidth="4" />
            <motion.circle cx="20" cy="20" r="16" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeDasharray={100.5} initial={{ strokeDashoffset: 100.5 }} whileInView={{ strokeDashoffset: 100.5 * 0.38 }} viewport={{ once: true }} transition={{ duration: 1.2 }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-neutral-900">62</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-neutral-900">your-name/todo-app</p>
          <p className="text-[10.5px] text-neutral-500">Fix first: secrets file committed</p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {layers.map(([l, ok], i) => (
          <motion.div key={l} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.12 }} className={`flex items-center justify-between rounded-lg border px-2 py-1 text-[10.5px] font-semibold ${ok ? "border-[#cfe9c8] bg-[#eeffe8] text-[#2f7c53]" : "border-dashed border-[#f3c8b8] bg-[#fdeee8] text-[#a8401f]"}`}>
            {l} <span>{ok ? "✓" : "missing"}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CommunityMock() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-[#c6dafc] bg-white/90 p-3">
        <div className="flex items-center gap-2">
          <img src="/people/james.jpg" alt="" className="size-6 rounded-full object-cover" />
          <span className="text-[11px] font-semibold text-neutral-900">James Wilson</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#e8f0fe] px-1.5 text-[9px] font-bold text-[#1967d2]">
            <BadgeCheck className="size-2.5" /> Teacher
          </span>
          <span className="ml-auto text-[9.5px] font-bold text-[#2f7c53]">✓ accepted</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-[1.4] text-neutral-600">“More than 40” and “40 or more” agree on every mark except one: 40 itself…</p>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white/90 p-3">
        <p className="text-[11px] font-semibold text-neutral-900">Here's how I solved Sum of Digits</p>
        <div className="mt-1.5 select-none font-mono text-[10px] leading-[1.5] text-neutral-500 blur-[4px]">
          def sum_of_digits(n):
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;total = 0 …
        </div>
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-neutral-700">
          <EyeOff className="size-3" /> solve it first to unlock
        </div>
      </div>
    </div>
  );
}

export function LearnTogether() {
  const cards = [
    {
      href: "/mentoring",
      title: "Mentoring",
      accent: "#1a73e8",
      tint: "border-[#c6dafc]/80 bg-[#eef4ff]",
      body: "Join a Google-Meet-style call with Priya. She explains your mistake out loud — then “Summarise” plays an animated replay of your own code, stopping where it breaks.",
      mock: <MeetMock />,
    },
    {
      href: "/repo",
      title: "Repo Analyse",
      accent: "#359462",
      tint: "border-[#cfe9c8]/80 bg-[#eeffe8]",
      body: "Paste your GitHub project. Get a health score, the layers you're missing, what to fix first and why — and the shape to aim for so it can scale.",
      mock: <RepoMock />,
    },
    {
      href: "/community",
      title: "Community",
      accent: "#7B35F0",
      tint: "border-[#ddd0ff]/70 bg-[#f2eeff]",
      body: "Ask classmates, share tips, get answers from teachers with a badge. Full solutions stay blurred until you've solved the problem yourself.",
      mock: <CommunityMock />,
    },
  ];
  return (
    <section id="together" className="bg-neutral-50 py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-600">
            <img src="/people/priya.jpg" alt="" className="size-4 rounded-full object-cover" /> Meet Priya, your AI mentor
          </span>
          <h2 className="mt-4 text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl md:text-5xl">Never learn alone.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600 sm:text-lg">A mentor who talks you through your bug, a reviewer for your real projects, and a class that helps each other — all with the same rule: we point, you fix.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div key={c.href} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <Link href={c.href} className={`group flex h-full flex-col rounded-3xl border p-5 transition-transform hover:-translate-y-1 sm:p-6 ${c.tint}`}>
                <div className="min-h-[190px]">{c.mock}</div>
                <h3 className="mt-5 flex items-center justify-between text-[24px] font-medium tracking-[-0.04em]" style={{ color: c.accent }}>
                  {c.title}
                  <ArrowUpRight className="size-5 opacity-50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </h3>
                <p className="mt-2 text-[14px] font-medium leading-[1.5] tracking-[-0.02em] text-[#6D6878]">{c.body}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
