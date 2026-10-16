"use client";

/**
 * The hunting ground: a file tree and a read-only code view where every line
 * is clickable. The line you pick is what your report points at; bugs you've
 * already confirmed are painted in their severity colour.
 */
import React, { useMemo } from "react";
import { FileCode2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlight } from "./highlight";

export interface ViewerFile {
  path: string;
  language: string;
  content: string;
}

export interface FoundMark {
  file: string;
  line: number;
  color: string;
  title: string;
}

const LINE_H = 22;

export function FileTree({ files, active, onPick, found }: { files: ViewerFile[]; active: string; onPick: (p: string) => void; found: FoundMark[] }) {
  return (
    <nav className="space-y-0.5" aria-label="Files">
      {files.map((f) => {
        const n = found.filter((x) => x.file === f.path).length;
        const depth = f.path.split("/").length - 1;
        return (
          <button
            key={f.path}
            onClick={() => onPick(f.path)}
            className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-mono text-[12px] transition-colors", active === f.path ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100")}
            style={{ paddingLeft: 10 + depth * 10 }}
          >
            {f.language === "markdown" ? <FileText className="size-3.5 shrink-0 opacity-60" /> : <FileCode2 className="size-3.5 shrink-0 opacity-60" />}
            <span className="min-w-0 flex-1 truncate">{f.path}</span>
            {n > 0 && <span className={cn("rounded-full px-1.5 text-[10px] font-bold", active === f.path ? "bg-[#bbf451] text-black" : "bg-[#359462]/15 text-[#2f7c53]")}>{n}✓</span>}
          </button>
        );
      })}
    </nav>
  );
}

export function CodeViewer({ file, selected, onLine, found }: { file: ViewerFile; selected: number | null; onLine: (n: number) => void; found: FoundMark[] }) {
  const lines = useMemo(() => {
    const ls = file.content.replace(/\r\n/g, "\n").split("\n");
    if (ls[ls.length - 1] === "") ls.pop();
    return ls;
  }, [file.content]);
  const marks = new Map(found.filter((f) => f.file === file.path).map((f) => [f.line, f]));
  const longest = Math.max(40, ...lines.map((l) => l.length + 4));
  return (
    <div className="lf-editor overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-[0_16px_40px_-16px_rgba(16,15,25,0.35)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
        <span className="truncate font-mono text-[12px] text-neutral-400">{file.path}</span>
        <span className="shrink-0 text-[11px] text-neutral-500">{lines.length} lines · click a line to report it</span>
      </div>
      <div className="max-h-[36rem] overflow-auto">
        <div className="relative py-3" style={{ minWidth: `calc(${longest}ch + 4rem)` }}>
          {lines.map((l, i) => {
            const n = i + 1;
            const mark = marks.get(n);
            const isSel = selected === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onLine(n)}
                title={mark ? `Found: ${mark.title}` : `Report line ${n}`}
                className={cn("group flex w-full text-left font-mono text-[12.5px] transition-colors", isSel ? "bg-[#bbf451]/15" : mark ? "" : "hover:bg-white/[0.05]")}
                style={{ height: LINE_H, lineHeight: `${LINE_H}px`, backgroundColor: mark && !isSel ? mark.color + "22" : undefined }}
              >
                <span
                  className={cn("sticky left-0 w-12 shrink-0 select-none border-r border-white/5 bg-neutral-950 pr-3 text-right tabular-nums", isSel ? "font-bold text-[#bbf451]" : mark ? "font-bold" : "text-neutral-600 group-hover:text-neutral-300")}
                  style={mark && !isSel ? { color: mark.color } : undefined}
                >
                  {n}
                </span>
                <span className="whitespace-pre pl-4" dangerouslySetInnerHTML={{ __html: highlight(l, file.language) }} />
                {mark && <span className="ml-3 shrink-0 self-center rounded-full px-1.5 font-sans text-[10px] font-bold leading-[16px] text-white" style={{ backgroundColor: mark.color }}>found</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
