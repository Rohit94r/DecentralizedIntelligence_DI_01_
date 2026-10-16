"use client";

/**
 * The wallet PIN. Layerflow has no passwords — a learner is just a pseudonym —
 * so anything that moves points out (cash-outs, goodies, a company's triage)
 * asks for a 4–6 digit PIN. The first time, it asks you to choose one.
 *
 *   const pin = usePin();
 *   const p = await pin.ask(learner, hasPin);   // null if cancelled
 *   …
 *   {pin.dialog}
 */
import React, { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { KeyRound, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { Portal } from "@/components/app/Portal";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Pending = { learner: string; create: boolean; title: string; resolve: (pin: string | null) => void };

export function usePin() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const ask = useCallback((learner: string, hasPin: boolean, title = "Confirm with your wallet PIN") => {
    return new Promise<string | null>((resolve) => {
      setPin("");
      setConfirm("");
      setError(null);
      setPending({ learner, create: !hasPin, title, resolve });
      setTimeout(() => input.current?.focus(), 60);
    });
  }, []);

  const close = (value: string | null) => {
    pending?.resolve(value);
    setPending(null);
  };

  const submit = async () => {
    if (!pending) return;
    if (!/^\d{4,6}$/.test(pin)) return setError("Use 4 to 6 digits.");
    if (pending.create) {
      if (pin !== confirm) return setError("The two PINs don't match.");
      setBusy(true);
      try {
        await api.setPin(pending.learner, pin);
      } catch (e) {
        setBusy(false);
        return setError((e as Error).message);
      }
      setBusy(false);
    }
    close(pin);
  };

  const dialog = (
    <Portal>
      <AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-[2px]" onClick={() => close(null)}>
            <motion.form
              initial={{ y: 12, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              onKeyDown={(e) => e.key === "Escape" && close(null)}
              className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-neutral-950 text-[#bbf451]">{pending.create ? <ShieldCheck className="size-5" /> : <KeyRound className="size-5" />}</span>
                <button type="button" onClick={() => close(null)} className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">{pending.create ? "Create your wallet PIN" : pending.title}</p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-neutral-500">
                {pending.create
                  ? `Layerflow has no passwords, so this PIN is what stops anyone else from spending ${pending.learner}'s points. Pick 4–6 digits you'll remember.`
                  : `Enter the PIN for ${pending.learner}. Five wrong tries lock the wallet for 15 minutes.`}
              </p>
              <input
                ref={input}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete={pending.create ? "new-password" : "current-password"}
                type="password"
                placeholder="••••"
                aria-label="PIN"
                className="mt-4 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-center font-mono text-[22px] tracking-[0.5em] outline-none focus:border-neutral-950"
              />
              {pending.create && (
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="new-password"
                  type="password"
                  placeholder="again"
                  aria-label="Repeat the PIN"
                  className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-center font-mono text-[18px] tracking-[0.4em] outline-none placeholder:tracking-normal focus:border-neutral-950"
                />
              )}
              {error && <p className="mt-2 text-[12.5px] font-medium text-[#a8401f]">{error}</p>}
              <button disabled={busy} className={cn("mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[14px] font-semibold text-white disabled:opacity-50")}>
                {busy && <LoaderCircle className="size-4 animate-spin" />}
                {pending.create ? "Save PIN and continue" : "Confirm"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );

  return { ask, dialog };
}
