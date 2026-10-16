"use client";

/**
 * Site-wide UI language (English / हिन्दी / मराठी). Persisted to
 * localStorage and read only after mount, so the server-rendered HTML and the
 * first client render match (no hydration warning).
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICTIONARIES, EN, type Dictionary, type UiLanguage } from "./translations";

const STORAGE_KEY = "debug-dojo-ui-lang";

interface I18nContextValue {
  lang: UiLanguage;
  setLang: (lang: UiLanguage) => void;
  /** Full dictionary for the current language, English-filled where a key is missing. */
  dict: Dictionary;
  /** Dot-path lookup with {var} interpolation; falls back to English, then to the key. */
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolve(dict: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" && key in node ? (node as Record<string, unknown>)[key] : undefined), dict);
}

function deepMerge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object" || Array.isArray(base)) return (over as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge((base as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe bootstrap
      if (stored === "en" || stored === "hi" || stored === "mr") setLangState(stored);
    } catch {
      /* locked-down browser: English is fine */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: UiLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* persistence is a convenience */
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = deepMerge(EN, DICTIONARIES[lang]);
    const t = (path: string, vars?: Record<string, string | number>) => {
      const leaf = resolve(dict, path) ?? resolve(EN, path);
      if (typeof leaf !== "string") return path;
      return vars ? leaf.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : leaf;
    };
    return { lang, setLang, dict, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n() called outside <I18nProvider> — check app/layout.tsx");
  return ctx;
}
