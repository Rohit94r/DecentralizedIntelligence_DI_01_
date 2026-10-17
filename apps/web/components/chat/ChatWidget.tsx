"use client";

/**
 * "Ask Priya" — the floating chat on every page.
 *   • anywhere: explains Python ideas and how Layerflow works, in simple words
 *   • on a problem page: knows the problem and your latest attempt, and helps
 *     with THAT — prose only, never code, never the answer (server-enforced)
 * Works with zero API keys (built-in replies); uses Groq / Gemini when set.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, LoaderCircle, Mic, SendHorizontal, Video, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, isPlanLimit, type ChatTurn } from "@/lib/api";
import { useLearner } from "@/lib/learner";
import { useI18n } from "@/lib/i18n/context";
import { OPEN_CHAT_EVENT, useChatContext } from "@/lib/chat-context";
import { useListener, useSpeaker } from "@/lib/voice";
import { Markdown } from "@/components/app/Markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
  source?: string;
  suggestions?: string[];
}

const GENERAL_STARTERS = ["How does Layerflow work?", "What is a list?", "return vs print?", "How do I debug?"];
const PROBLEM_STARTERS = ["Explain the task simply", "What's wrong with my code?", "Which line should I look at?", "What is an edge case?"];

function load(key: string): Msg[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "[]") as Msg[];
  } catch {
    return [];
  }
}

export function ChatWidget({ variant = "app" }: { variant?: "app" | "landing" }) {
  const path = usePathname();
  const ctx = useChatContext();
  const [learner] = useLearner();
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [nudge, setNudge] = useState(false);
  const speaker = useSpeaker();
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const onProblem = !!ctx.challenge_id && path.startsWith("/challenge");
  const key = `layerflow-chat:${onProblem ? ctx.challenge_id : "general"}`;

  // restore this context's conversation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    setMsgs(load(key));
  }, [key]);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* private mode */
    }
  }, [key, msgs]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  // a gentle nudge on problem pages, once per session
  useEffect(() => {
    if (!onProblem) return;
    try {
      if (sessionStorage.getItem("layerflow-chat-nudged")) return;
    } catch {
      return;
    }
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem("layerflow-chat-nudged", "1");
      } catch {
        /* private mode */
      }
      setNudge(true);
    }, 4000);
    const u = setTimeout(() => setNudge(false), 12000);
    return () => (clearTimeout(t), clearTimeout(u));
  }, [onProblem]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setOpen(true);
      setNudge(false);
      const history: ChatTurn[] = msgs.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      setMsgs((m) => [...m, { role: "user", content: q }]);
      setDraft("");
      setBusy(true);
      try {
        const r = await api.chat({
          learner_id: learner,
          message: q,
          history,
          lang,
          context: onProblem ? { page: "challenge", challenge_id: ctx.challenge_id, code: ctx.code } : { page: path.split("/")[1] || "home" },
        });
        setMsgs((m) => [...m, { role: "assistant", content: r.reply, source: r.model ?? "built-in", suggestions: r.suggestions }]);
        if (voiceOn) speaker.speak(r.reply, { lang });
      } catch (e) {
        const msg = (e as Error).message;
        setMsgs((m) => [...m, isPlanLimit(msg) ? { role: "assistant", content: `${msg}\n\n[See the Pro plan →](/pricing)`, source: "plan" } : { role: "assistant", content: "I couldn't reach the server just now — is the API running? Try again in a moment.", source: "offline" }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, msgs, learner, lang, onProblem, ctx.challenge_id, ctx.code, path, voiceOn, speaker],
  );

  const listener = useListener((t) => send(t), lang);

  // anything can open the chat with a question: openChat("…")
  useEffect(() => {
    const on = (e: Event) => {
      setOpen(true);
      const m = (e as CustomEvent<string>).detail;
      if (m) setTimeout(() => send(m), 50);
      else setTimeout(() => input.current?.focus(), 80);
    };
    window.addEventListener(OPEN_CHAT_EVENT, on);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, on);
  }, [send]);

  const starters = onProblem ? PROBLEM_STARTERS : GENERAL_STARTERS;
  const last = msgs[msgs.length - 1];

  return (
    <div className={cn("fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-5 sm:right-5", variant === "landing" && "z-[60]")}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-[min(600px,calc(100svh-110px))] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[26px] border border-neutral-200/80 bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)] sm:w-[400px]"
          >
            {/* header */}
            <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
              <div className="relative">
                <img src="/people/priya.jpg" alt="Priya" className="size-9 rounded-full object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[#359462]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">Priya</p>
                <p className="truncate text-[11px] text-neutral-500">AI mentor · guides you, never gives the code</p>
              </div>
              <button onClick={() => (voiceOn ? (speaker.stop(), setVoiceOn(false)) : setVoiceOn(true))} title={voiceOn ? "Stop reading replies aloud" : "Read replies aloud"} className={cn("flex size-8 items-center justify-center rounded-full transition-colors", voiceOn ? "bg-[#eeffe8] text-[#2f7c53]" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700")}>
                {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              {onProblem && (
                <Link href={`/mentoring?challenge=${ctx.challenge_id}&join=1`} title="Join a call with Priya" className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-[#1a73e8]">
                  <Video className="size-4" />
                </Link>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-[11.5px] text-neutral-500">
              <BookOpen className="size-3.5" />
              {onProblem ? (
                <span className="truncate">
                  About: <b className="text-neutral-800">{ctx.title ?? ctx.challenge_id}</b> — I can see your current code
                </span>
              ) : (
                <span>General Python help · ask anything, no question is too small</span>
              )}
            </div>

            {/* messages */}
            <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="flex gap-2.5">
                  <img src="/people/priya.jpg" alt="" className="mt-0.5 size-7 shrink-0 rounded-full object-cover" />
                  <div className="rounded-2xl rounded-tl-md bg-neutral-100 px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-neutral-800">
                    {onProblem ? (
                      <>
                        Hi! I'm Priya 👋 Stuck on <b>{ctx.title ?? "this problem"}</b>? Ask me what the task means, why a test fails, or any Python word. I'll point you to the right place — but I won't write the code for you.
                      </>
                    ) : (
                      <>Hi! I'm Priya 👋 I explain Python in simple words — lists, loops, errors, anything. New here? Ask me how Layerflow works.</>
                    )}
                  </div>
                </div>
              )}
              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-neutral-950 px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-white">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2.5">
                    <img src="/people/priya.jpg" alt="" className="mt-0.5 size-7 shrink-0 rounded-full object-cover" />
                    <div className="min-w-0 max-w-[88%]">
                      <div className="rounded-2xl rounded-tl-md bg-neutral-100 px-3.5 py-2.5 text-neutral-800">
                        <Markdown text={m.content} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 pl-1 text-[10.5px] text-neutral-400">
                        <span>{m.source === "built-in" ? "built-in reply" : m.source}</span>
                        <button onClick={() => speaker.speak(m.content, { lang })} className="hover:text-neutral-700" title="Read aloud">
                          <Volume2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}
              {busy && (
                <div className="flex gap-2.5">
                  <img src="/people/priya.jpg" alt="" className="size-7 shrink-0 rounded-full object-cover" />
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-neutral-100 px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span key={d} className="size-1.5 rounded-full bg-neutral-400" animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* suggestions */}
            <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {(last?.role === "assistant" && last.suggestions?.length ? last.suggestions : msgs.length === 0 ? starters : []).map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy} className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:border-neutral-950 hover:text-neutral-950 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>

            {/* input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="m-3 mt-1 flex items-end gap-1.5 rounded-[22px] border border-neutral-200 bg-white p-1.5 pl-3.5 focus-within:border-neutral-400"
            >
              <textarea
                ref={input}
                value={listener.listening ? listener.interim || "Listening…" : draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                placeholder={onProblem ? "Ask about this problem…" : "Ask anything about Python…"}
                className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[13.5px] leading-[1.4] text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              {listener.engine !== "none" && (
                <button type="button" onClick={() => (listener.listening ? listener.stop() : listener.start())} title={listener.listening ? "Stop and send" : "Speak your question"} className={cn("flex size-9 shrink-0 items-center justify-center rounded-full transition-colors", listener.listening ? "bg-[#ea4335] text-white" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700")}>
                  <Mic className="size-4" />
                </button>
              )}
              <button disabled={!draft.trim() || busy} aria-label="Send" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-opacity disabled:opacity-30">
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {nudge && !open && (
          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => setOpen(true)} className="max-w-[240px] rounded-2xl rounded-br-md border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-[12.5px] leading-[1.45] text-neutral-700 shadow-lg">
            Stuck? Ask me about <b>{ctx.title ?? "this problem"}</b> — I'll point you to the right line.
          </motion.button>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ y: -2 }}
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 rounded-full border border-neutral-200/80 bg-white py-1.5 pl-1.5 pr-4 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)]"
        >
          <span className="relative">
            <img src="/people/priya.jpg" alt="" className="size-9 rounded-full object-cover" />
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[#359462]" />
          </span>
          <span className="text-left">
            <span className="block text-[13px] font-semibold leading-tight tracking-[-0.01em] text-neutral-950">Ask Priya</span>
            <span className="block text-[10.5px] leading-tight text-neutral-500">{onProblem ? "about this problem" : "your AI mentor"}</span>
          </span>
        </motion.button>
      )}
    </div>
  );
}
