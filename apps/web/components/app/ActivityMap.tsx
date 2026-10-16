"use client";

/**
 * A GitHub-style contribution map: one square per day for the last year,
 * darker green = more solves that day. Columns are weeks (Sunday at the top);
 * on small screens it scrolls and starts at the most recent week.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

export interface MapDay {
  day: string;
  count: number;
  future?: boolean;
}

const LEVELS = ["bg-[#ebedf0] dark:bg-[#1f2328]", "bg-[#9be9a8] dark:bg-[#0e4429]", "bg-[#40c463] dark:bg-[#006d32]", "bg-[#30a14e] dark:bg-[#26a641]", "bg-[#216e39] dark:bg-[#39d353]"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);

function label(d: MapDay, unit: string): string {
  const date = new Date(`${d.day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return d.count ? `${d.count} ${unit}${d.count === 1 ? "" : "s"} on ${date}` : `No ${unit}s on ${date}`;
}

export function ActivityMap({ days, today, unit = "solve", className }: { days: MapDay[]; today?: string; unit?: string; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const weeks = useMemo(() => {
    const out: MapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);
  // a month name above the first week that starts in it — skipped if it would crowd the previous label
  const months = useMemo(() => {
    let last = -10;
    return weeks.map((w, i) => {
      const m = Number(w[0].day.slice(5, 7)) - 1;
      const prev = i ? Number(weeks[i - 1][0].day.slice(5, 7)) - 1 : -1;
      if (m === prev || i - last < 3) return "";
      if (i === 0 && Number(w[0].day.slice(8, 10)) > 14) return "";
      last = i;
      return MONTHS[m];
    });
  }, [weeks]);
  const total = days.reduce((n, d) => n + d.count, 0);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [days.length]);

  return (
    <div className={className}>
      <div ref={scroller} className="overflow-x-auto pb-1">
        {/* one grid: a label column, then one column per week that shares the width — squares grow to fill the card */}
        <div className="grid min-w-[620px] gap-[3px]" style={{ gridTemplateColumns: `26px repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {months.map((m, i) =>
            m ? (
              <span key={`m${i}`} className="whitespace-nowrap pb-1 text-[10.5px] leading-none text-neutral-500" style={{ gridColumn: i + 2, gridRow: 1 }}>
                {m}
              </span>
            ) : null,
          )}
          {WEEKDAYS.map((d, i) =>
            d ? (
              <span key={`w${i}`} className="self-center text-[10px] leading-none text-neutral-400" style={{ gridColumn: 1, gridRow: i + 2 }}>
                {d}
              </span>
            ) : null,
          )}
          {days.map((d, i) => (
            <span
              key={d.day}
              title={d.future ? undefined : label(d, unit)}
              style={{ gridColumn: Math.floor(i / 7) + 2, gridRow: (i % 7) + 2 }}
              className={cn("aspect-square w-full rounded-[2px]", d.future ? "bg-transparent" : LEVELS[level(d.count)], d.day === today && "outline outline-offset-1 outline-neutral-400")}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-neutral-500">
        <span>
          {total} {unit}
          {total === 1 ? "" : "s"} in the last year
        </span>
        <span className="flex items-center gap-[3px]">
          Less
          {LEVELS.map((c) => (
            <span key={c} className={cn("mx-px size-[11px] rounded-[2px]", c)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
