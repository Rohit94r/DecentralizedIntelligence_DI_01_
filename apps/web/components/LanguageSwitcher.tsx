"use client";

/**
 * The one language control. Sits in the landing navbar pill and in the app
 * header; `variant` adapts it to each without duplicating the menu logic.
 */
import React, { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { UI_LANGUAGE_OPTIONS } from "@/lib/i18n/translations";

export function LanguageSwitcher({ variant = "light", className }: { variant?: "light" | "chat"; className?: string }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = UI_LANGUAGE_OPTIONS.find((o) => o.value === lang) ?? UI_LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change language / भाषा बदलें / भाषा बदला"
        className={cn(
          "flex items-center gap-1.5 rounded-full text-sm font-semibold transition-colors",
          variant === "light" ? "px-3 py-2 text-black/80 hover:bg-black/5" : "px-2.5 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
        )}
      >
        <Languages className="size-4 shrink-0" />
        <span className={variant === "chat" ? "text-[12.5px]" : undefined}>{current.nativeLabel}</span>
      </button>

      {open && (
        <div role="listbox" className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[9rem] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 py-1.5 shadow-xl shadow-black/10 backdrop-blur-2xl">
          {UI_LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === lang}
              onClick={() => {
                setLang(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm font-medium transition-colors",
                opt.value === lang ? "text-neutral-950" : "text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <span>{opt.nativeLabel}</span>
              {opt.value === lang && <Check className="size-3.5 shrink-0 text-[#359462]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
