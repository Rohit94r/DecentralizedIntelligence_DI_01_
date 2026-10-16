"use client";

/** Renders full-screen overlays (the Meet room, the thread drawer) at <body>, above the app shell's stacking context. */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document.body only exists after mount
    setEl(document.body);
  }, []);
  return el ? createPortal(children, el) : null;
}
