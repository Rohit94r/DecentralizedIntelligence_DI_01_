/**
 * A square logo tile: a real logo when we have one, otherwise the first
 * letter on a colour picked from the name (the way most apps show a company
 * without a logo). TechLogo looks the name up in lib/logos.
 */
import React from "react";
import { logoFor } from "@/lib/logos";
import { cn } from "@/lib/utils";

const MONO = ["#1f2937", "#0f766e", "#4338ca", "#9333ea", "#be123c", "#b45309", "#15803d", "#0369a1"];

function monoColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MONO[h % MONO.length];
}

export function LogoTile({ src, name, size = 44, dark = false, full = false, className }: { src?: string | null; name: string; size?: number; dark?: boolean; full?: boolean; className?: string }) {
  const radius = Math.round(size * 0.26);
  if (!src)
    return (
      <span className={cn("flex shrink-0 items-center justify-center font-semibold text-white", className)} style={{ width: size, height: size, borderRadius: radius, backgroundColor: monoColor(name), fontSize: Math.round(size * 0.42) }} aria-hidden>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  // a brand mark that already has its own background fills the tile
  if (full) return <img src={src} alt="" width={size} height={size} className={cn("shrink-0 object-cover", className)} style={{ width: size, height: size, borderRadius: radius }} />;
  return (
    <span className={cn("flex shrink-0 items-center justify-center border", dark ? "border-neutral-800 bg-neutral-900" : "border-neutral-200/80 bg-white", className)} style={{ width: size, height: size, borderRadius: radius }}>
      <img src={src} alt="" className="object-contain" style={{ width: Math.round(size * 0.56), height: Math.round(size * 0.56) }} />
    </span>
  );
}

export function TechLogo({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const l = logoFor(name);
  if (!l) return null;
  if (l.dark)
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[4px] bg-neutral-900", className)} style={{ width: size, height: size }}>
        <img src={l.src} alt="" style={{ width: Math.round(size * 0.72), height: Math.round(size * 0.72) }} />
      </span>
    );
  return <img src={l.src} alt="" className={cn("shrink-0 object-contain dark:rounded-[3px] dark:bg-white dark:p-px", className)} style={{ width: size, height: size }} />;
}
