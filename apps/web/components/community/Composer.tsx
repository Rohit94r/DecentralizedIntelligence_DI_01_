"use client";

/**
 * "Start a post" — a calm one-line prompt that opens into the full form:
 * kind (with what each is for), title, details (with the spoiler rule spelled
 * out), the problem it's about, and a Post button with clear validation.
 */
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Check, ChevronDown, Info, LoaderCircle, PenLine, SendHorizontal, X } from "lucide-react";
import type { PostKind, Role } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, RoleBadge } from "./bits";
import { FOCUS, KIND, KINDS } from "./meta";

export interface DraftPost {
  kind: PostKind;
  title: string;
  body: string;
  challenge_id: string;
}

export const TITLE_MIN = 4;
export const TITLE_MAX = 140;
export const BODY_MIN = 2;
export const BODY_MAX = 6000;

const PLACEHOLDER: Record<PostKind, { title: string; body: string }> = {
  question: { title: "e.g. Why does my loop skip the last item?", body: "What were you trying to do, what did you try, and what happened instead?" },
  tip: { title: "e.g. Write the loop numbers on paper first", body: "What's the trick, and when did it help you?" },
  discussion: { title: "e.g. When should a function print instead of return?", body: "Share your thinking and ask others for theirs." },
  showcase: { title: "e.g. Five problems in a row without a hint", body: "What did you build or achieve, and what made it click?" },
};

export function Composer({
  open,
  onOpen,
  onClose,
  form,
  setForm,
  challenges,
  acting,
  posting,
  onSubmit,
}: {
  open: boolean;
  onOpen: (kind?: PostKind) => void;
  onClose: () => void;
  form: DraftPost;
  setForm: React.Dispatch<React.SetStateAction<DraftPost>>;
  challenges: { id: string; title: string }[];
  acting: { name: string; avatar: string | null; role: Role };
  posting: boolean;
  onSubmit: () => void;
}) {
  const [tried, setTried] = useState(false);
  const [touched, setTouched] = useState<{ title?: boolean; body?: boolean }>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setTried(false);
      setTouched({});
      return;
    }
    const id = setTimeout(() => titleRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open]);

  const titleLen = form.title.trim().length;
  const bodyLen = form.body.trim().length;
  const titleErr = titleLen < TITLE_MIN ? (titleLen === 0 ? "Give your post a title." : `A little longer, please — at least ${TITLE_MIN} characters.`) : null;
  const bodyErr = bodyLen < BODY_MIN ? "Add a sentence or two so people can help." : null;
  const showTitleErr = !!titleErr && (tried || touched.title);
  const showBodyErr = !!bodyErr && (tried || touched.body);

  const submit = () => {
    if (titleErr || bodyErr) {
      setTried(true);
      (titleErr ? titleRef : bodyRef).current?.focus();
      return;
    }
    onSubmit();
  };

  const k = KIND[form.kind];

  if (!open)
    return (
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)] sm:p-4">
        <div className="flex items-center gap-3">
          <Avatar name={acting.name} src={acting.avatar} size={38} />
          <button
            type="button"
            onClick={() => onOpen()}
            className={cn("flex h-11 min-w-0 flex-1 items-center rounded-full border border-neutral-200 bg-neutral-50 px-4 text-left text-[13.5px] text-neutral-400 transition-colors hover:border-neutral-400", FOCUS)}
          >
            <span className="truncate">{acting.role === "teacher" ? "Share a tip or start a class discussion…" : "Ask a question or share what helped you…"}</span>
          </button>
          <button type="button" onClick={() => onOpen()} className={cn("hidden h-11 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white @lg/feed:inline-flex", FOCUS)}>
            <PenLine className="size-3.5" /> Start a post
          </button>
        </div>
        <div className="-mx-3 mt-3 grid grid-cols-2 gap-1 border-t border-neutral-100 px-2 pt-2.5 sm:-mx-4 sm:px-3 @md/feed:flex @md/feed:justify-between">
          {KINDS.map((x) => (
            <button
              key={x.kind}
              type="button"
              onClick={() => onOpen(x.kind)}
              className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900", FOCUS)}
            >
              <x.Icon className="size-4" style={{ color: x.accent }} strokeWidth={2.2} />
              {x.short}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <motion.form
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          submit();
        }
      }}
      className="rounded-3xl border border-neutral-200/80 bg-white shadow-[0_16px_40px_-20px_rgba(0,0,0,0.18)]"
      aria-label="Start a post"
    >
      <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <Avatar name={acting.name} src={acting.avatar} size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">Start a post</p>
          <p className="flex items-center gap-1.5 truncate text-[11.5px] text-neutral-500">
            Posting as <b className="font-semibold text-neutral-700">{acting.name}</b> <RoleBadge role={acting.role} />
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the composer" className={cn("flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900", FOCUS)}>
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* kind */}
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold text-neutral-700">What kind of post?</legend>
          <div role="radiogroup" aria-label="Post kind" className="grid grid-cols-2 gap-2 @xl/feed:grid-cols-4">
            {KINDS.map((x) => {
              const on = form.kind === x.kind;
              return (
                <button
                  key={x.kind}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setForm((f) => ({ ...f, kind: x.kind }))}
                  className={cn("relative flex flex-col items-start justify-start rounded-2xl border p-3 text-left transition-colors", FOCUS, on ? x.picked : "border-neutral-200 bg-white hover:border-neutral-400")}
                >
                  <span className={cn("flex size-7 items-center justify-center rounded-full", x.chip)}>
                    <x.Icon className="size-3.5" strokeWidth={2.4} />
                  </span>
                  <span className="mt-2 block text-[13px] font-semibold tracking-[-0.01em] text-neutral-950">{x.label}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-neutral-500">{x.help}</span>
                  {on && (
                    <span className="absolute right-2.5 top-2.5 flex size-4.5 items-center justify-center rounded-full text-white" style={{ backgroundColor: x.accent }}>
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* title */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="lf-post-title" className="text-[12px] font-semibold text-neutral-700">
              Title
            </label>
            <span className={cn("text-[11px] tabular-nums", form.title.length > TITLE_MAX - 20 ? "text-[#a8401f] dark:text-[#ff9b77]" : "text-neutral-400")}>
              {form.title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            id="lf-post-title"
            ref={titleRef}
            value={form.title}
            maxLength={TITLE_MAX}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            onBlur={() => form.title && setTouched((t) => ({ ...t, title: true }))}
            placeholder={PLACEHOLDER[form.kind].title}
            aria-invalid={showTitleErr}
            aria-describedby={showTitleErr ? "lf-post-title-err" : undefined}
            className={cn(
              "h-11 w-full rounded-2xl border bg-white px-3.5 text-[14px] font-medium text-neutral-950 outline-none transition-shadow placeholder:font-normal placeholder:text-neutral-400 focus:ring-2",
              showTitleErr ? "border-[#e9a58b] focus:ring-[#c64e27]/25" : "border-neutral-200 focus:ring-[#359462]/30",
            )}
          />
          {showTitleErr && (
            <p id="lf-post-title-err" className="mt-1.5 text-[11.5px] font-medium text-[#a8401f] dark:text-[#ff9b77]">
              {titleErr}
            </p>
          )}
        </div>

        {/* body */}
        <div>
          <label htmlFor="lf-post-body" className="mb-1.5 block text-[12px] font-semibold text-neutral-700">
            Details
          </label>
          <textarea
            id="lf-post-body"
            ref={bodyRef}
            value={form.body}
            maxLength={BODY_MAX}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            onBlur={() => form.body && setTouched((t) => ({ ...t, body: true }))}
            rows={5}
            placeholder={PLACEHOLDER[form.kind].body}
            aria-invalid={showBodyErr}
            aria-describedby="lf-post-body-hint"
            className={cn(
              "block w-full resize-y rounded-2xl border bg-white px-3.5 py-3 text-[13.5px] leading-[1.55] text-neutral-900 outline-none transition-shadow placeholder:text-neutral-400 focus:ring-2",
              showBodyErr ? "border-[#e9a58b] focus:ring-[#c64e27]/25" : "border-neutral-200 focus:ring-[#359462]/30",
            )}
          />
          {showBodyErr ? (
            <p className="mt-1.5 text-[11.5px] font-medium text-[#a8401f] dark:text-[#ff9b77]">{bodyErr}</p>
          ) : null}
          <p id="lf-post-body-hint" className="mt-2 flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-[11.5px] leading-[1.5] text-neutral-500">
            <Info className="mt-px size-3.5 shrink-0" />
            <span>
              Explain the idea in words. <b className="font-semibold text-neutral-700">Pasting a full solution?</b> It&apos;s blurred automatically for anyone who hasn&apos;t solved that problem yet. Use <code className="rounded bg-neutral-100 px-1 font-mono text-[10.5px]">```</code> for code.
            </span>
          </p>
        </div>

        {/* problem */}
        <div>
          <label htmlFor="lf-post-problem" className="mb-1.5 block text-[12px] font-semibold text-neutral-700">
            About a problem <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <div className="relative sm:max-w-xs">
            <BookOpen className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <select
              id="lf-post-problem"
              value={form.challenge_id}
              onChange={(e) => setForm((f) => ({ ...f, challenge_id: e.target.value }))}
              className="h-10 w-full appearance-none rounded-2xl border border-neutral-200 bg-white pl-9 pr-9 text-[13px] text-neutral-800 outline-none transition-shadow focus:ring-2 focus:ring-[#359462]/30"
            >
              <option value="">Not about one problem</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-3 sm:px-5">
        <p className="hidden text-[11px] text-neutral-400 @md/feed:block">
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-sans">Ctrl</kbd> + <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-sans">Enter</kbd> to post
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onClose} className={cn("h-10 rounded-full px-4 text-[13px] font-semibold text-neutral-500 transition-colors hover:text-neutral-900", FOCUS)}>
            Cancel
          </button>
          <button type="submit" disabled={posting} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-950 px-4.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50", FOCUS)}>
            {posting ? <LoaderCircle className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
            Post {k.label.toLowerCase()}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {tried && (titleErr || bodyErr) && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-5 pb-3 text-right text-[11.5px] text-[#a8401f] dark:text-[#ff9b77]">
            Almost there — fill in the highlighted {titleErr && bodyErr ? "fields" : "field"}.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
