"use client";

/**
 * A dependency-free code editor: a transparent <textarea> over a highlighted
 * <pre>, sharing one font and line-height so they stay aligned. The Line Map
 * (OB1) paints the culprit line and sweeps an annotation in beside it; the
 * Replay (OB2) paints the line of the current step; Bug Factory makes every
 * line clickable.
 */
import React, { useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { highlightLine } from "@/lib/python";

export interface EditorProps {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  culpritLine?: number | null;
  culpritNote?: string | null;
  confidence?: string | null;
  replayLine?: number | null;
  onLineClick?: (line: number) => void;
  markedLines?: Record<number, "right" | "wrong">;
  minLines?: number;
  className?: string;
}

const LINE_H = 22;

export function CodeEditor({ value, onChange, readOnly, culpritLine, culpritNote, confidence, replayLine, onLineClick, markedLines = {}, minLines = 8, className }: EditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const lines = useMemo(() => value.replace(/\r\n/g, "\n").split("\n"), [value]);
  const rows = Math.max(minLines, lines.length + 1);
  const longest = Math.max(30, ...lines.map((l) => l.length + 4));

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || !onChange) return;
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      el.form?.requestSubmit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const next = value.slice(0, s) + "    " + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
    } else if (e.key === "Enter") {
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const current = value.slice(lineStart, s);
      const indent = current.match(/^\s*/)?.[0] ?? "";
      const extra = /:\s*$/.test(current) ? "    " : "";
      e.preventDefault();
      const insert = "\n" + indent + extra;
      onChange(value.slice(0, s) + insert + value.slice(end));
      requestAnimationFrame(() => el.setSelectionRange(s + insert.length, s + insert.length));
    }
  };

  return (
    <div className={cn("lf-editor overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-[0_16px_40px_-16px_rgba(16,15,25,0.35)]", className)}>
      {/* Line Map strip: where to look, never what to write */}
      <AnimatePresence initial={false}>
        {culpritLine && culpritNote && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden border-b border-[#fb923c]/25 bg-[#fb923c]/10"
          >
            <p className="flex items-start gap-2 px-4 py-2 font-sans text-[12px] leading-[18px] text-[#fdba74]">
              <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-[#fb923c]" />
              <span>
                <span className="font-semibold text-[#fed7aa]">Line {culpritLine}</span>
                {confidence ? ` · ${confidence}` : ""} — {culpritNote}
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex max-h-[34rem] overflow-auto">
        {/* gutter */}
        <div className="sticky left-0 z-10 shrink-0 select-none border-r border-white/5 bg-neutral-950 py-3 text-right" style={{ minHeight: rows * LINE_H + 24 }}>
          {Array.from({ length: rows }, (_, i) => {
            const n = i + 1;
            const mark = markedLines[n];
            const isCulprit = culpritLine === n;
            const content = (
              <span
                className={cn(
                  "block h-[22px] px-3 font-mono text-[12px] leading-[22px] tabular-nums",
                  isCulprit ? "font-bold text-[#fb923c]" : replayLine === n ? "font-bold text-[#bbf451]" : "text-neutral-600",
                  mark === "right" && "bg-[#359462]/30 text-white",
                  mark === "wrong" && "bg-[#c64e27]/25 text-[#ff9b77] line-through",
                )}
              >
                {n <= lines.length ? n : ""}
              </span>
            );
            return onLineClick && n <= lines.length ? (
              <button key={n} type="button" onClick={() => onLineClick(n)} className="block w-full text-right hover:bg-white/10" title={`Line ${n}`}>
                {content}
              </button>
            ) : (
              <React.Fragment key={n}>{content}</React.Fragment>
            );
          })}
        </div>

        {/* code */}
        <div className="relative flex-1" style={{ minWidth: `calc(${longest}ch + 2rem)`, minHeight: rows * LINE_H + 24 }}>
          <pre aria-hidden className="pointer-events-none absolute inset-0 px-4 py-3">
            {lines.map((l, i) => {
              const n = i + 1;
              return (
                <div
                  key={i}
                  className={cn("relative h-[22px] -mx-4 px-4", culpritLine === n && "culprit-line", replayLine === n && culpritLine !== n && "replay-line", onLineClick && "hover:bg-white/5")}
                >
                  <span dangerouslySetInnerHTML={{ __html: highlightLine(l) }} />
                </div>
              );
            })}
          </pre>
          {onLineClick && readOnly ? (
            <div className="absolute inset-0 py-3">
              {lines.map((_, i) => (
                <button key={i} type="button" aria-label={`Line ${i + 1}`} onClick={() => onLineClick(i + 1)} className="block h-[22px] w-full cursor-pointer hover:bg-white/[0.04]" />
              ))}
            </div>
          ) : (
            <textarea
              ref={ta}
              value={value}
              readOnly={readOnly}
              onChange={(e) => onChange?.(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              wrap="off"
              rows={rows}
              aria-label="Your Python code"
              className="absolute inset-0 h-full w-full overflow-hidden bg-transparent px-4 py-3 font-mono"
              style={{ lineHeight: `${LINE_H}px` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
