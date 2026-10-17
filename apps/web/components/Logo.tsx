/**
 * The LayerFlow logo, redrawn as vector from the brand artwork: the lime mark
 * (an isometric wall and floor resting on a second layer) and the wordmark,
 * set in Inter Black like the original. The wordmark takes the current text
 * colour, so it follows dark mode; the mark stays lime everywhere.
 */
import React from "react";
import { cn } from "@/lib/utils";

export const BRAND_LIME = "#b8f708";
const WALL =
  "M5.59 37.92Q3.98 37.08 3.98 35.27L3.98 15.44Q3.98 13.63 5.53 12.69L24.76 0.94Q26.31 0 26.31 1.81L26.31 25.97L28.85 24.56Q30.44 23.67 32.07 24.44L53.65 34.64Q55.28 35.41 53.69 36.27L30.2 49.03Q28.62 49.9 27.01 49.06Z";
const LAYER =
  "M1.59 48.1Q0 49 1.61 49.84L26.88 63.15Q28.49 64 30.09 63.15L55.59 49.7Q57.2 48.85 55.61 47.97L50.01 44.82Q48.42 43.93 46.82 44.79L28.5 54.68L10.19 45.02Q8.58 44.18 7.01 45.07Z";

function Mark() {
  return (
    <>
      <path d={WALL} fill={BRAND_LIME} />
      <path d={LAYER} fill={BRAND_LIME} />
    </>
  );
}

/** The mark alone, for tight spots. Size it by height. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 57.2 64" aria-hidden className={cn("h-8 w-auto shrink-0", className)}>
      <Mark />
    </svg>
  );
}

/** Mark and wordmark, in the artwork's proportions. Size it by height. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 234.2 64" role="img" aria-label="LayerFlow" className={cn("h-8 w-auto shrink-0 text-neutral-950", className)}>
      <Mark />
      <text x="65.71" y="49.51" fontSize="32.46" fontWeight={900} textLength="168.44" lengthAdjust="spacingAndGlyphs" fill="currentColor" className="font-sans">
        LayerFlow
      </text>
    </svg>
  );
}
