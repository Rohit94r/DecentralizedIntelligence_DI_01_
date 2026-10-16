"use client";

/**
 * The program directory on the Bug Bounty page: programs hosted here (reports
 * are filed and triaged on Layerflow) and real public programs elsewhere
 * (linked out — hunters report on that company's own platform).
 */
import React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { LogoTile } from "@/components/app/Logo";
import type { HostedProgram } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface ExternalProgram {
  name: string;
  program: string;
  logo: string;
  url: string;
  via: string;
  covers: string;
  kind: "company" | "open_source";
  /** the logo file is already a coloured tile */
  full?: boolean;
}

/** Real, public programs. No reward figures — they change; each program's own page has the current table. */
export const EXTERNAL_PROGRAMS: ExternalProgram[] = [
  { name: "Google", program: "Google Bug Hunters", logo: "/logos/google.svg", url: "https://bughunters.google.com/", via: "bughunters.google.com", covers: "Google, Android, Chrome and Google Cloud", kind: "company" },
  { name: "Meta", program: "Meta Bug Bounty", logo: "/logos/meta.svg", url: "https://bugbounty.meta.com/", via: "bugbounty.meta.com", covers: "Facebook, Instagram, WhatsApp and Messenger", kind: "company" },
  { name: "GitHub", program: "GitHub Security Bug Bounty", logo: "/logos/github.svg", url: "https://bounty.github.com/", via: "HackerOne", covers: "github.com, the GitHub API and GitHub's apps", kind: "company" },
  { name: "Eternal (Zomato)", program: "Eternal on HackerOne", logo: "/brands/zomato.svg", full: true, url: "https://hackerone.com/eternal", via: "HackerOne", covers: "Zomato, Blinkit and the group's other apps", kind: "company" },
  { name: "GitLab", program: "GitLab on HackerOne", logo: "/logos/gitlab.svg", url: "https://hackerone.com/gitlab", via: "HackerOne", covers: "GitLab — the code is public, so you can read it before you test", kind: "open_source" },
  { name: "Nextcloud", program: "Nextcloud on HackerOne", logo: "/logos/nextcloud.svg", url: "https://hackerone.com/nextcloud", via: "HackerOne", covers: "The self-hosted file sync and collaboration server and its apps", kind: "open_source" },
  { name: "Mozilla", program: "Mozilla Bug Bounty", logo: "/logos/firefoxbrowser.svg", url: "https://www.mozilla.org/en-US/security/bug-bounty/", via: "mozilla.org", covers: "Firefox and Mozilla's web services", kind: "open_source" },
];

/** "QuickBite (demo company)" → { name: "QuickBite", demo: true } */
export function companyName(company: string): { name: string; demo: boolean } {
  const demo = /\(demo( company)?\)/i.test(company);
  return { name: company.replace(/\s*\((demo( company)?|open source)\)\s*/i, "").trim(), demo };
}

function Head({ cols }: { cols: string[] }) {
  return (
    <div className="hidden grid-cols-[minmax(0,1fr)_150px_170px_28px] gap-4 border-b border-neutral-100 px-5 py-2.5 text-[11px] font-medium text-neutral-400 md:grid">
      {cols.map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </div>
  );
}

function HostedRow({ p }: { p: HostedProgram }) {
  const { name, demo } = companyName(p.company);
  return (
    <Link href={`/bounty/${p.id}`} className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 px-5 py-4 hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_150px_170px_28px] md:gap-4">
      <div className="col-span-2 flex min-w-0 items-center gap-3.5 md:col-span-1">
        <LogoTile src={p.logo} name={name} size={40} full={!!p.logo} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-semibold text-neutral-950">
            {name}
            {demo && <span className="rounded border border-neutral-200 px-1.5 py-px text-[10px] font-medium text-neutral-500">demo company</span>}
            {p.status === "awaiting_payment" && <span className="rounded bg-[#f59e0b]/15 px-1.5 py-px text-[10px] font-semibold text-[#96681c]">waiting for payment</span>}
          </p>
          <p className="truncate text-[12.5px] text-neutral-500">{p.title.replace(/^[^—]+—\s*/, "")}</p>
        </div>
      </div>
      <p className="col-start-2 text-[12px] text-neutral-600 md:col-start-auto">
        <span className="font-medium text-neutral-800">Hosted here</span>
        <span className="block text-[11.5px] text-neutral-400">
          {p.stats.valid} confirmed · {p.stats.hunters} hunter{p.stats.hunters === 1 ? "" : "s"}
        </span>
      </p>
      <p className="col-start-2 text-[12px] md:col-start-auto">
        <span className="font-semibold tabular-nums text-neutral-900">{p.pays_points ? `Up to ${p.rewards.critical.toLocaleString("en-IN")} pts` : "Thanks + hall of fame"}</span>
        <span className="block text-[11.5px] text-neutral-400">{p.pays_points ? `${p.points_left.toLocaleString("en-IN")} pts left in the pool` : "no points pool"}</span>
      </p>
      <ChevronRight className="hidden size-4 text-neutral-300 group-hover:text-neutral-700 md:block" />
    </Link>
  );
}

function ExternalRow({ x }: { x: ExternalProgram }) {
  return (
    <a href={x.url} target="_blank" rel="noopener noreferrer" className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 px-5 py-4 hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_150px_170px_28px] md:gap-4">
      <div className="col-span-2 flex min-w-0 items-center gap-3.5 md:col-span-1">
        <LogoTile src={x.logo} name={x.name} size={40} full={x.full} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-neutral-950">{x.program}</p>
          <p className="truncate text-[12.5px] text-neutral-500">{x.covers}</p>
        </div>
      </div>
      <p className="col-start-2 text-[12px] text-neutral-600 md:col-start-auto">
        <span className="font-medium text-neutral-800">{x.via === "HackerOne" ? "On HackerOne" : "Own site"}</span>
        <span className="block truncate text-[11.5px] text-neutral-400">{x.via === "HackerOne" ? "report there" : x.via}</span>
      </p>
      <p className="col-start-2 text-[12px] md:col-start-auto">
        <span className="font-semibold text-neutral-900">Cash bounties</span>
        <span className="block text-[11.5px] text-neutral-400">amounts on their page</span>
      </p>
      <ArrowUpRight className="hidden size-4 text-neutral-300 group-hover:text-neutral-700 md:block" />
    </a>
  );
}

export function DirectorySection({ title, note, hosted, external, empty }: { title: string; note: string; hosted: HostedProgram[]; external: ExternalProgram[]; empty: string }) {
  return (
    <section>
      <div className="mb-3">
        <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{title}</p>
        <p className="text-[12.5px] text-neutral-500">{note}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
        <Head cols={["Program", "Where you report", "Rewards", ""]} />
        <div className={cn("divide-y divide-neutral-100")}>
          {hosted.map((p) => (
            <HostedRow key={p.id} p={p} />
          ))}
          {!hosted.length && <p className="px-5 py-4 text-[12.5px] text-neutral-500">{empty}</p>}
          {external.length > 0 && <p className="bg-neutral-50 px-5 py-2 text-[11px] font-medium text-neutral-500">Public programs on other platforms</p>}
          {external.map((x) => (
            <ExternalRow key={x.url} x={x} />
          ))}
        </div>
      </div>
    </section>
  );
}
