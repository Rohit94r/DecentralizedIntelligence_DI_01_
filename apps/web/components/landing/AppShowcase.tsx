"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { BentoHeatmapWidget, BentoMasteryBoardWidget, BentoRingWidget, BentoSettingsWidget, BentoStreakWidget } from "./BentoWidgets";
import { mistakeTags, progressStats, weeklyPractice } from "./landingData";

const TABS = [
  { id: "practice", label: "Practice" },
  { id: "mistakes", label: "Mistakes" },
  { id: "learners", label: "Learners" },
  { id: "progress", label: "Progress" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function PracticeTab() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <BentoRingWidget />
      <BentoSettingsWidget />
    </div>
  );
}

function MistakesTab() {
  const total = mistakeTags.reduce((sum, t) => sum + t.count, 0);
  return (
    <div className="rounded-3xl border border-[#ddd0ff]/70 bg-[#faf9f6] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Mistake taxonomy</h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#5e2ac4]">{mistakeTags.length} categories</span>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {mistakeTags.map((tag) => {
          const pct = Math.round((tag.count / total) * 100);
          return (
            <div key={tag.name} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate font-mono text-[13px] font-semibold text-neutral-900">{tag.name}</span>
                  <span className="font-poppins text-xs font-medium text-neutral-500">{tag.count} diagnoses</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tag.color }} />
                </div>
              </div>
              <span className="font-poppins text-xs font-medium text-neutral-400">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LearnersTab() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <BentoMasteryBoardWidget />
      <BentoStreakWidget />
    </div>
  );
}

function ProgressTab() {
  const maxBar = Math.max(...weeklyPractice.map((d) => d.attempts));
  const stats = [
    { label: "Hostile contained", value: progressStats.hostile, color: "#5e2ac4" },
    { label: "Labels exact", value: progressStats.labels, color: "#c64e27" },
    { label: "Hidden leaks", value: String(progressStats.leaks), color: "#359462" },
    { label: "Recurring found", value: String(progressStats.recurring), color: "#5fae45" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3 shadow-sm">
            <p className="font-poppins text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{s.label}</p>
            <p className="mt-1 font-instrumental text-3xl leading-none" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
      <BentoHeatmapWidget />
      <div className="rounded-3xl border border-[#f0d9b8]/70 bg-[#fff2df] px-6 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Weekly practice</h3>
          <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#c64e27]">This week</span>
        </div>
        <div className="mt-5 flex h-32 items-end justify-between gap-2">
          {weeklyPractice.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-poppins text-[9px] font-medium text-neutral-500">{d.attempts}</span>
              <div className="flex h-24 w-full items-end">
                <div className="w-full rounded-t-lg" style={{ height: `${(d.attempts / maxBar) * 100}%`, backgroundColor: d.day === "Sat" ? "#c64e27" : "#359462" }} />
              </div>
              <span className="font-poppins text-[10px] font-medium text-neutral-500">{d.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  practice: <PracticeTab />,
  mistakes: <MistakesTab />,
  learners: <LearnersTab />,
  progress: <ProgressTab />,
};

export default function AppShowcase() {
  const { t } = useI18n();
  const [active, setActive] = useState<TabId>("practice");
  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[22px] border border-neutral-200/80 bg-[#fffdf7] shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
      <div className="flex items-center gap-3 border-b border-neutral-200/70 bg-[#faf9f6] px-5 py-3.5">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#c64e27]" />
          <span className="h-3 w-3 rounded-full bg-[#f0b429]" />
          <span className="h-3 w-3 rounded-full bg-[#359462]" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-4 py-1.5 shadow-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94cd59" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="font-poppins text-xs font-medium text-neutral-700">localhost:3000 · {t("common.brand")}</span>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5e2ac4] text-[10px] font-bold text-white">R</div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200/70 bg-white px-4 pt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`relative shrink-0 cursor-pointer rounded-t-xl px-5 py-2.5 font-poppins text-sm font-medium transition-all ${active === tab.id ? "text-[#151515]" : "text-neutral-400 hover:text-neutral-600"}`}
          >
            {tab.label}
            {active === tab.id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#5e2ac4]" />}
          </button>
        ))}
      </div>
      <div className="bg-[#fdfcf9] p-5 sm:p-7">{TAB_CONTENT[active]}</div>
    </div>
  );
}
