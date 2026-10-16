"use client";

/**
 * The showcase widgets — same shapes, sizes and pastel tints as the reference
 * bento widgets, carrying Debug Dojo's content.
 */
import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { heatmapData, masteryBoard, streakData } from "./landingData";

const LEVEL_COLORS = ["#eef2e6", "#cbe8b0", "#94cd59", "#5fae45", "#359462"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

export function BentoHeatmapWidget() {
  return (
    <div className="rounded-3xl border border-[#f0d9b8]/70 bg-[#fff2df] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Consistency</h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#c64e27]">52 weeks</span>
      </div>
      <div className="mt-5 flex gap-2">
        <div className="flex flex-col justify-between py-0.5">
          {["M", null, "W", null, "F", null].map((label, i) => (
            <span key={i} className="flex h-[11px] items-center font-poppins text-[8px] font-medium text-[#b08968]">
              {label || ""}
            </span>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between gap-[3px] pr-1">
            {MONTH_LABELS.map((label) => (
              <span key={label} className="font-poppins text-[8px] font-medium text-[#b08968]">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px]">
            {heatmapData.map((week, wi) => (
              <div key={wi} className="flex flex-1 flex-col gap-[3px]">
                {week.map((level, di) => (
                  <div key={di} className="aspect-square w-full rounded-[2px]" style={{ backgroundColor: LEVEL_COLORS[level] }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-1.5 font-poppins text-[9px] font-medium text-[#b08968]">
        <span>Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <span key={i} className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: color }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" className={className}>
      <path d="M12 2c.6 2.4-.6 3.6-1.5 5C9.5 8.6 8 10 8 12.5c0 2.2 1.5 3.9 3.5 4-1-1-1.4-2-1-3.2.7-2 2.4-3.2 3-5.3.5 1 .4 2-.3 3 .6 0 1 .3 1.3.7C15.7 13.2 16 14.6 16 16c0 2-1.2 3-2.8 3.4-.4.1-.6.5-.3.8 2.7.3 5.3-1.6 5.3-4.6 0-3.7-3.4-8-6.2-13.6z" />
    </svg>
  );
}

export function BentoMasteryBoardWidget() {
  return (
    <div className="rounded-3xl border border-[#ddd0ff]/70 bg-[#f2eeff] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Mastery board</h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#5e2ac4]">Pseudonymous</span>
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        {masteryBoard.map((user) => {
          const isFirst = user.rank === 1;
          return (
            <div key={user.rank} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${isFirst ? "border border-[#bbf451]/60 bg-white shadow-sm" : "bg-white/70"}`}>
              <span className={`w-5 text-center font-poppins text-sm font-bold ${isFirst ? "text-[#5e2ac4]" : "text-neutral-400"}`}>{user.rank}</span>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: user.color }}>
                {user.initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-poppins text-sm font-semibold text-neutral-900">{user.name}</p>
                <p className="font-poppins text-[11px] text-neutral-500">
                  {user.mastery}% mastery · {user.cleared} cleared
                </p>
              </div>
              <div className="flex items-center gap-1">
                <FlameIcon className="shrink-0" />
                <span className="font-poppins text-sm font-bold text-neutral-800">{user.streak}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${on ? "bg-[#359462]" : "bg-neutral-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function BentoSettingsWidget() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [level, setLevel] = useState("easy");
  const [hintDelay, setHintDelay] = useState(30);
  const [slowReplay, setSlowReplay] = useState(true);
  const [showLineMap, setShowLineMap] = useState(true);
  const theme = mounted && resolvedTheme === "dark" ? "Dark" : "Light";

  return (
    <div className="rounded-3xl border border-[#bbf451]/40 bg-[#fffbe8] px-6 py-6 shadow-sm">
      <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Your dojo</h3>
      <div className="mt-6 flex flex-col gap-5">
        <div>
          <p className="font-poppins text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Theme</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {["Light", "Dark"].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t.toLowerCase())}
                className={`cursor-pointer rounded-xl px-3 py-2 font-poppins text-sm font-medium transition-all ${theme === t ? "bg-[#151515] text-white shadow-sm" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="font-poppins text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Starting level</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["easy", "medium", "hard"].map((s) => (
              <button
                key={s}
                onClick={() => setLevel(s)}
                className={`cursor-pointer rounded-xl px-2 py-2 font-poppins text-sm font-medium capitalize transition-all ${level === s ? "bg-[#359462] text-white shadow-sm" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-poppins text-sm font-medium text-neutral-800">Think before a hint</p>
            <p className="font-poppins text-[11px] text-neutral-500">{hintDelay} seconds of struggle first</p>
          </div>
          <input type="range" min="0" max="120" step="10" value={hintDelay} onChange={(e) => setHintDelay(Number(e.target.value))} className="w-32 cursor-pointer accent-[#359462]" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-poppins text-sm font-medium text-neutral-800">Slow-motion replay</p>
            <p className="font-poppins text-[11px] text-neutral-500">Step through one line at a time</p>
          </div>
          <Toggle on={slowReplay} onChange={setSlowReplay} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-poppins text-sm font-medium text-neutral-800">Line Map</p>
            <p className="font-poppins text-[11px] text-neutral-500">Point at the line, not the fix</p>
          </div>
          <Toggle on={showLineMap} onChange={setShowLineMap} />
        </div>
      </div>
    </div>
  );
}

export function BentoStreakWidget() {
  const { currentStreak, longestStreak, weeklyGoalPercent } = streakData;
  return (
    <div className="flex flex-col rounded-3xl border border-[#fde1a8]/80 bg-[#fff6e3] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">Streak</h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#f59e0b]">Come back tomorrow</span>
      </div>
      <div className="mt-5 flex items-end gap-3">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="#f59e0b">
          <path d="M12 2c.6 2.4-.6 3.6-1.5 5C9.5 8.6 8 10 8 12.5c0 2.2 1.5 3.9 3.5 4-1-1-1.4-2-1-3.2.7-2 2.4-3.2 3-5.3.5 1 .4 2-.3 3 .6 0 1 .3 1.3.7C15.7 13.2 16 14.6 16 16c0 2-1.2 3-2.8 3.4-.4.1-.6.5-.3.8 2.7.3 5.3-1.6 5.3-4.6 0-3.7-3.4-8-6.2-13.6z" />
        </svg>
        <span className="font-instrumental text-6xl leading-none text-neutral-900">{currentStreak}</span>
        <span className="mb-1 font-poppins text-sm font-medium text-neutral-600">days</span>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <div className="flex items-center justify-between font-poppins text-xs text-neutral-500">
          <span>Weekly goal</span>
          <span className="font-semibold text-neutral-800">{weeklyGoalPercent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#fde1a8]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#c64e27]" style={{ width: `${weeklyGoalPercent}%` }} />
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3">
        <p className="font-poppins text-[11px] uppercase tracking-[0.14em] text-neutral-400">Tomorrow&apos;s nudge</p>
        <p className="mt-1 font-poppins text-xs text-neutral-700">
          You keep hitting <span className="font-semibold text-[#c64e27]">boundary_comparison</span>. One 5-minute challenge is waiting.
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
        <span className="font-poppins text-xs text-neutral-500">Longest streak</span>
        <span className="font-poppins text-sm font-bold text-neutral-900">{longestStreak} days</span>
      </div>
    </div>
  );
}

/** The ring widget: tests passing, animated like the reference's session timer. */
export function BentoRingWidget() {
  const [passed, setPassed] = useState(6);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const TOTAL = 9;
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);
  const run = () => {
    if (running) return;
    setRunning(true);
    setPassed(0);
    let n = 0;
    timer.current = setInterval(() => {
      n++;
      setPassed(n);
      if (n >= TOTAL) {
        if (timer.current) clearInterval(timer.current);
        setRunning(false);
      }
    }, 160);
  };
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - passed / TOTAL);
  return (
    <div className="flex flex-col items-center rounded-3xl border border-[#cfe9c8]/80 bg-[#eeffe8] px-6 py-6 shadow-sm">
      <div className="flex w-full items-center justify-between">
        <span className="font-poppins text-[10px] font-semibold uppercase tracking-[0.2em] text-[#359462]">Submission</span>
        <span className="rounded-full bg-white/80 px-3 py-1 font-poppins text-[10px] font-medium text-neutral-600 shadow-sm">last-k-total</span>
      </div>
      <div className="relative mt-5 flex items-center justify-center">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#359462"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dashoffset 0.25s linear" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="font-instrumental text-5xl leading-none text-neutral-900">
            {passed}/{TOTAL}
          </span>
          <span className="mt-1.5 font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">{running ? "running" : passed === TOTAL ? "all passed" : "tests passing"}</span>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={run}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#359462] px-5 py-2 font-poppins text-sm font-medium text-white shadow-sm transition-all hover:bg-[#2c7a51] active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4v16l13-8z" />
          </svg>
          Run the fix
        </button>
        <button
          onClick={() => setPassed(6)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#359462]/40 bg-white/70 px-5 py-2 font-poppins text-sm font-medium text-[#359462] transition-all hover:bg-white active:scale-95"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
