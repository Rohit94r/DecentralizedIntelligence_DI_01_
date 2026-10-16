"use client";

/**
 * The current pseudonymous learner. No accounts, no real names — just an id
 * kept in localStorage (or ?learner= in the URL, which wins so judges can
 * open /dashboard?learner=riya directly).
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "layerflow-learner";
const EVENT = "layerflow-learner-change";
export const DEMO_LEARNERS = ["rohan", "riya", "khushi"];

function freshGuest(): string {
  return `guest-${Math.random().toString(36).slice(2, 6)}`;
}

export function sanitizeLearner(id: string): string {
  return id.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
}

export function getLearner(): string {
  if (typeof window === "undefined") return "guest";
  const fromUrl = new URLSearchParams(window.location.search).get("learner");
  if (fromUrl && sanitizeLearner(fromUrl).length >= 2) {
    const id = sanitizeLearner(fromUrl);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
    return id;
  }
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && stored.length >= 2) return stored;
    const g = freshGuest();
    localStorage.setItem(KEY, g);
    return g;
  } catch {
    return "guest";
  }
}

export function setLearner(id: string): void {
  const clean = sanitizeLearner(id);
  if (clean.length < 2) return;
  try {
    localStorage.setItem(KEY, clean);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: clean }));
}

export function useLearner(): [string | null, (id: string) => void] {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage after mount
    setId(getLearner());
    const on = (e: Event) => setId((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = useCallback((x: string) => setLearner(x), []);
  return [id, set];
}
