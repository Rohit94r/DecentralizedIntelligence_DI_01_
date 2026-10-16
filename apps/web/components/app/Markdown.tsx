"use client";

/**
 * A deliberately tiny Markdown renderer for chat replies and community posts:
 * paragraphs, **bold**, `inline code`, ```fenced code```, and simple lists.
 * Everything is rendered as text nodes — no HTML from users or models.
 */
import React from "react";
import { cn } from "@/lib/utils";
import { highlightLine } from "@/lib/python";

function inline(text: string, key: string, codeClass: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}-${i++}`} className="font-semibold">{t.slice(2, -2)}</strong>);
    else
      out.push(
        <code key={`${key}-${i++}`} className={cn("rounded-md px-1.5 py-px font-mono text-[0.88em]", codeClass)}>
          {t.slice(1, -1)}
        </code>,
      );
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className, tone = "light" }: { text: string; className?: string; tone?: "light" | "dark" }) {
  const codeInline = tone === "dark" ? "bg-white/10 text-[#bbf451]" : "bg-neutral-100 text-[#0570b0]";
  const blocks: React.ReactNode[] = [];
  const parts = text.split(/(```[\w-]*\n?[\s\S]*?```)/g);
  parts.forEach((part, pi) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```[\w-]*\n?/, "").replace(/```$/, "").replace(/\n$/, "");
      blocks.push(
        <pre key={`c${pi}`} className={cn("lf-editor my-2 overflow-x-auto rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-[1.6]", tone === "dark" ? "border-white/10 bg-black/40" : "border-neutral-200 bg-neutral-50")}>
          <code>
            {code.split(/\r?\n/).map((l, i) => (
              // highlightLine escapes every character of the source before wrapping tokens in spans
              <div key={i} dangerouslySetInnerHTML={{ __html: highlightLine(l) }} />
            ))}
          </code>
        </pre>,
      );
      return;
    }
    const lines = part.split(/\r?\n/);
    let list: { ordered: boolean; items: string[] } | null = null;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length) blocks.push(<p key={`p${pi}-${blocks.length}`} className="my-1.5 first:mt-0 last:mb-0">{inline(para.join(" "), `p${pi}-${blocks.length}`, codeInline)}</p>);
      para = [];
    };
    const flushList = () => {
      if (!list) return;
      const L = list;
      const Tag = L.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={`l${pi}-${blocks.length}`} className={cn("my-1.5 space-y-1 pl-5", L.ordered ? "list-decimal" : "list-disc")}>
          {L.items.map((it, i) => (
            <li key={i}>{inline(it, `li${pi}-${i}`, codeInline)}</li>
          ))}
        </Tag>,
      );
      list = null;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      const ul = line.match(/^\s*[-*•]\s+(.*)$/);
      if (ol || ul) {
        flushPara();
        const ordered = !!ol;
        if (!list || list.ordered !== ordered) {
          flushList();
          list = { ordered, items: [] };
        }
        list.items.push((ol ? ol[2] : ul![1]).trim());
      } else if (!line.trim()) {
        flushPara();
        flushList();
      } else {
        flushList();
        para.push(line.trim());
      }
    }
    flushPara();
    flushList();
  });
  return <div className={cn("text-[13.5px] leading-[1.6] wrap-break-word", className)}>{blocks}</div>;
}
