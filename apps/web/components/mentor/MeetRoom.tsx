"use client";

/**
 * A mentoring call that looks and feels like Google Meet: a "Ready to join?"
 * lobby, two tiles (Priya and you), the dark control bar, live captions, an
 * in-call chat, raise-hand, reactions — and "Summarise", which makes Priya
 * PRESENT an animated walkthrough of your own code.
 *
 * Priya speaks with ElevenLabs when the server has a key, otherwise with the
 * browser's own voice. You can talk back (Groq Whisper or browser speech
 * recognition) or type. Every answer goes through the same no-code guardrail
 * as the hint ladder.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Captions,
  EllipsisVertical,
  Hand,
  Info,
  LoaderCircle,
  MessageSquareText,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  SendHorizontal,
  Smile,
  Sparkles,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type ChatTurn, type MentorSession } from "@/lib/api";
import { useSpeaker, useListener } from "@/lib/voice";
import { Markdown } from "@/components/app/Markdown";
import { Portal } from "@/components/app/Portal";
import { VisualSummary } from "./VisualSummary";

type Lang = "en" | "hi" | "mr";
interface Msg {
  from: "priya" | "you";
  text: string;
  at: number;
}

const OUTRO: Record<Lang, { fail: string; pass: string; done: string; hand: string }> = {
  en: {
    fail: "Want me to show you exactly where it goes wrong? Press Summarise and I'll walk you through your own code, step by step. Or just ask me anything.",
    pass: "Want a quick visual replay of the key idea? Press Summarise. Or ask me anything.",
    done: "That's the whole story. Ask me anything — tap the mic or type in the chat.",
    hand: "Yes? Go ahead — ask me anything.",
  },
  hi: {
    fail: "क्या मैं दिखाऊँ कि गड़बड़ी ठीक कहाँ होती है? Summarise दबाइए — मैं आपके अपने कोड को कदम-दर-कदम समझाऊँगी। या मुझसे कुछ भी पूछिए।",
    pass: "मुख्य बात का छोटा-सा विज़ुअल रिप्ले देखना है? Summarise दबाइए। या मुझसे कुछ भी पूछिए।",
    done: "बस, यही पूरी कहानी है। कुछ भी पूछिए — माइक दबाइए या चैट में लिखिए।",
    hand: "हाँ, बोलिए — क्या पूछना है?",
  },
  mr: {
    fail: "चूक नेमकी कुठे होते ते दाखवू का? Summarise दाबा — मी तुमचाच कोड टप्प्याटप्प्याने समजावून सांगेन. किंवा मला काहीही विचारा.",
    pass: "मुख्य कल्पनेचा छोटा व्हिज्युअल रिप्ले पाहायचा आहे? Summarise दाबा. किंवा मला काहीही विचारा.",
    done: "हीच पूर्ण गोष्ट. काहीही विचारा — माईक दाबा किंवा चॅटमध्ये लिहा.",
    hand: "हो, बोला — काय विचारायचं आहे?",
  },
};

function meetingCode(id: string): string {
  const letters = id.replace(/[^a-z]/g, "") + "layerflowmentor";
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (n: number, off: number) =>
    Array.from({ length: n }, (_, i) => letters[(h >> ((i + off) % 24)) % letters.length] ?? "a").join("");
  return `${pick(3, 0)}-${pick(4, 3)}-${pick(3, 9)}`;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* ───────────────────────── tiles + buttons ───────────────────────── */

function SpeakingBars() {
  return (
    <span className="flex size-7 items-center justify-center gap-[2px] rounded-full bg-[#1a73e8]">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="w-[3px] rounded-full bg-white" animate={{ height: [4, 12, 6, 10, 4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

function Tile({ name, speaking, muted, hand, small, children }: { name: string; speaking?: boolean; muted?: boolean; hand?: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-xl bg-[#3c4043] transition-shadow duration-300", speaking && "shadow-[inset_0_0_0_3px_#8ab4f8]")}>
      {children}
      {speaking && <div className="pointer-events-none absolute inset-0 rounded-xl ring-[3px] ring-inset ring-[#8ab4f8]" />}
      <div className={cn("absolute right-2.5 top-2.5", small && "right-2 top-2")}>
        {speaking ? (
          <SpeakingBars />
        ) : muted ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-[#202124]/70">
            <MicOff className="size-3.5 text-white" />
          </span>
        ) : null}
      </div>
      {hand && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute left-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-[#fdd663] text-[#202124]">
          <Hand className="size-4" />
        </motion.span>
      )}
      <span className={cn("absolute bottom-2 left-3 max-w-[80%] truncate text-[13px] font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]", small && "bottom-1.5 left-2 text-[12px]")}>{name}</span>
    </div>
  );
}

function RoundBtn({ children, onClick, label, tone = "default", active = false, className }: { children: React.ReactNode; onClick?: () => void; label: string; tone?: "default" | "danger"; active?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors sm:size-12",
        tone === "danger" ? "bg-[#ea4335] text-white hover:bg-[#d93025]" : active ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]" : "bg-[#3c4043] text-white hover:bg-[#4a4d51]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, label, active, badge }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean; badge?: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cn("relative flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10", active && "bg-[#8ab4f8]/20 text-[#8ab4f8]")}>
      {children}
      {badge}
    </button>
  );
}

/* ───────────────────────── the meeting ───────────────────────── */

type MeetRoomProps = {
  open: boolean;
  learnerId: string;
  learnerName: string;
  challengeId: string;
  challengeTitle: string;
  headline?: string;
  initialLang?: Lang;
  onClose: () => void;
};

/** Rendered at <body> so the call covers the whole window, sidebar included. */
export function MeetRoom(props: MeetRoomProps) {
  return (
    <Portal>
      <MeetRoomInner {...props} />
    </Portal>
  );
}

function MeetRoomInner({
  open,
  learnerId,
  learnerName,
  challengeId,
  challengeTitle,
  headline,
  initialLang = "en",
  onClose,
}: MeetRoomProps) {
  const [phase, setPhase] = useState<"lobby" | "in" | "left">("lobby");
  const [lang, setLang] = useState<Lang>(initialLang);
  const [session, setSession] = useState<MentorSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [panel, setPanel] = useState<null | "chat" | "people" | "info">(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [caption, setCaption] = useState<{ who: "Priya" | "You"; text: string } | null>(null);
  const [hand, setHand] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; e: string; x: number }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [pauseSignal, setPauseSignal] = useState(0);
  const [summaryKey, setSummaryKey] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const lobbyVideo = useRef<HTMLVideoElement | null>(null);
  const talk = useRef(0);
  const speaker = useSpeaker();
  const clock = useClock();
  const code = useMemo(() => meetingCode(challengeId), [challengeId]);
  const panelRef = useRef(panel);
  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  /* load the session as soon as the lobby opens, so "Join now" is instant */
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSession(null);
    setError(null);
    api
      .mentorSession(learnerId, challengeId, lang)
      .then((s) => alive && setSession(s))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [open, learnerId, challengeId, lang]);

  /* reset when (re)opened */
  useEffect(() => {
    if (open) {
      setPhase("lobby");
      setPresenting(false);
      setMessages([]);
      setCaption(null);
      setPanel(null);
      setHand(false);
    }
  }, [open]);

  /* the page behind the call must not scroll */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamOn(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (stream.current) return stopCamera();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      stream.current = s;
      setCamOn(true);
    } catch {
      setToast("Camera permission was blocked — that's fine, Priya can still hear and see your code.");
    }
  }, [stopCamera]);

  useEffect(() => {
    for (const v of [video.current, lobbyVideo.current]) if (v) v.srcObject = camOn ? stream.current : null;
  }, [camOn, phase, presenting]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const addMsg = useCallback((m: Omit<Msg, "at">) => {
    setMessages((xs) => [...xs, { ...m, at: Date.now() }]);
    if (panelRef.current !== "chat" && m.from === "priya") setUnread((n) => n + 1);
  }, []);

  /* Priya says something (captions + voice) */
  const say = useCallback(
    async (text: string, my: number) => {
      if (talk.current !== my) return;
      setCaption({ who: "Priya", text });
      await speaker.speak(text, { lang });
    },
    [speaker, lang],
  );

  /* joining → Priya greets and gives the verbal summary */
  const greet = useCallback(async () => {
    if (!session) return;
    const my = ++talk.current;
    await new Promise((r) => setTimeout(r, 1100));
    if (talk.current !== my) return;
    setToast(`${session.mentor.name} joined`);
    const order = ["intro", "tests", "pattern"];
    for (const id of order) {
      const s = session.segments.find((x) => x.id === id);
      if (s) await say(s.say, my);
      if (talk.current !== my) return;
    }
    const outro = session.passed ? OUTRO[lang].pass : OUTRO[lang].fail;
    addMsg({ from: "priya", text: outro });
    await say(outro, my);
  }, [session, say, addMsg, lang]);

  const join = () => {
    setPhase("in");
    setTimeout(() => greet(), 50);
  };

  /* asking Priya (typed or spoken) */
  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || !session) return;
      talk.current++;
      speaker.stop();
      setPauseSignal((n) => n + 1);
      setHand(false);
      const history: ChatTurn[] = messages.slice(-8).map((m) => ({ role: m.from === "you" ? "user" : "assistant", content: m.text }));
      addMsg({ from: "you", text: q });
      setCaption({ who: "You", text: q });
      setBusy(true);
      const r = await api
        .chat({ learner_id: learnerId, message: q, history, lang, context: { page: "mentoring", challenge_id: challengeId, code: session.code } })
        .catch(() => ({ reply: "Sorry — I lost the connection for a second. Could you say that again?" }));
      setBusy(false);
      addMsg({ from: "priya", text: r.reply });
      const my = ++talk.current;
      await say(r.reply, my);
    },
    [session, messages, learnerId, challengeId, lang, speaker, addMsg, say],
  );

  const listener = useListener((t) => ask(t), lang);
  useEffect(() => {
    if (listener.error) setToast(listener.error);
  }, [listener.error]);
  const toggleMic = () => {
    if (listener.listening) return listener.stop();
    talk.current++;
    speaker.stop();
    setPauseSignal((n) => n + 1);
    listener.start();
  };

  const summarise = () => {
    if (presenting) {
      setPresenting(false);
      setPauseSignal((n) => n + 1);
      speaker.stop();
      return;
    }
    talk.current++;
    speaker.stop();
    setSummaryKey((k) => k + 1);
    setPresenting(true);
  };

  const raiseHand = () => {
    if (hand) return setHand(false);
    setHand(true);
    talk.current++;
    speaker.stop();
    setPauseSignal((n) => n + 1);
    const my = ++talk.current;
    say(OUTRO[lang].hand, my);
    setPanel("chat");
    setUnread(0);
  };

  const react = (e: string) => {
    const id = Date.now() + Math.random();
    setReactions((xs) => [...xs, { id, e, x: 8 + Math.random() * 30 }]);
    setTimeout(() => setReactions((xs) => xs.filter((r) => r.id !== id)), 3200);
    setTray(false);
  };

  const hangUp = () => {
    talk.current++;
    speaker.stop();
    listener.stop();
    setPauseSignal((n) => n + 1);
    setPresenting(false);
    stopCamera();
    setPhase("left");
  };

  const close = () => {
    hangUp();
    onClose();
  };

  if (!open) return null;

  /* ───────────── lobby (popup) ───────────── */
  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px] sm:p-6" onClick={close}>
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative grid max-h-[94svh] w-full max-w-5xl gap-6 overflow-y-auto rounded-[28px] bg-[#ffffff] p-4 text-[#202124] shadow-2xl sm:p-7 md:grid-cols-[1.35fr_1fr] md:items-center md:gap-10"
        >
          <button onClick={close} aria-label="Close" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]">
            <X className="size-5" />
          </button>
          {/* preview */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-[#202124]">
            {camOn ? (
              <video ref={lobbyVideo} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white">
                <span className="flex size-20 items-center justify-center rounded-full bg-[#7b5ea7] text-3xl font-medium uppercase">{learnerName.slice(0, 1)}</span>
                <span className="text-[15px]">Camera is off</span>
              </div>
            )}
            <span className="absolute left-4 top-3 text-[14px] font-medium text-white">{learnerName}</span>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4">
              <button onClick={() => setToast("Your mic turns on inside the call — tap it whenever you want to ask Priya out loud.")} className="flex size-12 items-center justify-center rounded-full border border-white/70 text-white hover:bg-white/10" aria-label="Microphone">
                <Mic className="size-5" />
              </button>
              <button onClick={toggleCamera} className={cn("flex size-12 items-center justify-center rounded-full text-white", camOn ? "border border-white/70 hover:bg-white/10" : "bg-[#ea4335]")} aria-label="Camera">
                {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
              </button>
            </div>
          </div>
          {/* join */}
          <div className="text-center md:text-left">
            <h2 className="text-[28px] font-normal tracking-[-0.01em]">Ready to join?</h2>
            <div className="mt-3 flex items-center justify-center gap-2 md:justify-start">
              <img src="/people/priya.jpg" alt="" className="size-7 rounded-full object-cover" />
              <span className="text-[14px] text-[#3c4043]">Priya is in this call</span>
            </div>
            <div className="mt-5 rounded-2xl border border-[#dadce0] p-4 text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#5f6368]">Mentoring session</p>
              <p className="mt-1 text-[17px] font-medium">{challengeTitle}</p>
              {headline && <p className="mt-1.5 text-[13px] leading-[1.5] text-[#5f6368]">{headline}</p>}
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12px] text-[#5f6368]">Priya speaks</p>
              <div className="inline-flex rounded-full border border-[#dadce0] p-1">
                {(
                  [
                    ["en", "English"],
                    ["hi", "हिन्दी"],
                    ["mr", "मराठी"],
                  ] as [Lang, string][]
                ).map(([k, label]) => (
                  <button key={k} onClick={() => setLang(k)} className={cn("rounded-full px-3.5 py-1.5 text-[13px]", lang === k ? "bg-[#e8f0fe] font-medium text-[#1967d2]" : "text-[#3c4043] hover:bg-[#f1f3f4]")}>
                    {label}
                  </button>
                ))}
              </div>
              {lang !== "en" && session && session.lang === "en" && <p className="mt-2 text-[12px] text-[#b06000]">Translations need an AI key (GROQ_API_KEY or GEMINI_API_KEY) — Priya will speak English for now.</p>}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <button onClick={join} disabled={!session} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1a73e8] px-7 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-[#1765cc] disabled:bg-[#9aa0a6]">
                {!session && !error ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {session ? "Join now" : error ? "Can't join" : "Getting ready…"}
              </button>
              <button onClick={close} className="h-12 rounded-full px-5 text-[15px] font-medium text-[#1a73e8] hover:bg-[#f1f3f4]">
                Not now
              </button>
            </div>
            {error && <p className="mt-3 text-[13px] text-[#d93025]">{error}</p>}
            <p className="mt-5 text-[12px] leading-[1.5] text-[#5f6368]">Priya sees your last attempt, the Line Map and a replay on a safe example — never the hidden tests. She'll point you to the right place, but never hand you the code.</p>
          </div>
          <AnimatePresence>{toast && <Toast text={toast} light />}</AnimatePresence>
        </motion.div>
      </div>
    );
  }

  /* ───────────── after hanging up ───────────── */
  if (phase === "left") {
    const pattern = session?.segments.find((s) => s.visual.kind === "pattern")?.visual;
    const plan = session?.segments.find((s) => s.visual.kind === "plan")?.visual;
    return (
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#ffffff] text-[#202124]">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-5 py-12 text-center">
          <h2 className="text-[34px] font-normal tracking-[-0.01em]">You left the meeting</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => (setPhase("lobby"), setMessages([]))} className="h-11 rounded-full border border-[#dadce0] px-6 text-[14px] font-medium text-[#1a73e8] hover:bg-[#f8f9fa]">
              Rejoin
            </button>
            <button onClick={onClose} className="h-11 rounded-full bg-[#1a73e8] px-6 text-[14px] font-medium text-white hover:bg-[#1765cc]">
              Return to Mentoring
            </button>
          </div>
          {session && (
            <div className="mt-10 w-full rounded-3xl border border-[#dadce0] p-6 text-left">
              <div className="flex items-center gap-3">
                <img src={session.mentor.avatar} alt="" className="size-10 rounded-full object-cover" />
                <div>
                  <p className="text-[15px] font-medium">Your takeaways from Priya</p>
                  <p className="text-[12.5px] text-[#5f6368]">{session.challenge.title}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5 text-[14px] leading-[1.5] text-[#3c4043]">
                {session.line_map?.culprit_line && (
                  <li>
                    📍 Look at <b>line {session.line_map.culprit_line}</b> — {session.line_map.reason}
                  </li>
                )}
                {pattern && pattern.kind === "pattern" && (
                  <li>
                    🧩 The pattern: <b>{pattern.label}</b> — {pattern.rule}
                  </li>
                )}
                {plan &&
                  plan.kind === "plan" &&
                  plan.steps.slice(0, 3).map((s, i) => (
                    <li key={i}>
                      {["1️⃣", "2️⃣", "3️⃣"][i]} {s}
                    </li>
                  ))}
              </ul>
              <Link href={`/challenge/${challengeId}`} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#202124] px-5 py-2.5 text-[14px] font-medium text-white">
                Try the fix now <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ───────────── in the call ───────────── */
  const priyaSpeaking = speaker.speaking && !(caption?.who === "You" && busy);
  const name = session?.mentor.name ?? "Priya";
  const priyaTile = (small?: boolean) => (
    <Tile name={name} speaking={priyaSpeaking} small={small}>
      <motion.img src={session?.mentor.avatar ?? "/people/priya.jpg"} alt={name} className="h-full w-full object-cover" animate={priyaSpeaking ? { scale: [1, 1.025, 1] } : { scale: 1 }} transition={{ duration: 2.4, repeat: priyaSpeaking ? Infinity : 0, ease: "easeInOut" }} />
      {busy && (
        <span className="absolute bottom-2 right-3 flex items-center gap-1.5 rounded-full bg-[#202124]/70 px-2.5 py-1 text-[11.5px] text-white">
          <LoaderCircle className="size-3 animate-spin" /> thinking…
        </span>
      )}
    </Tile>
  );
  const youTile = (small?: boolean) => (
    <Tile name={`${learnerName} (You)`} muted={!listener.listening} speaking={listener.listening} hand={hand} small={small}>
      {camOn ? (
        <video ref={video} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className={cn("flex items-center justify-center rounded-full bg-[#7b5ea7] font-medium uppercase text-white", small ? "size-12 text-xl" : "size-24 text-4xl sm:size-28")}>{learnerName.slice(0, 1)}</span>
        </div>
      )}
    </Tile>
  );

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#202124] text-white">
      <div className="relative flex min-h-0 flex-1 gap-3 p-3 sm:gap-4 sm:p-4">
        {/* stage */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {presenting && session ? (
            <div className="flex min-h-0 flex-1 gap-3">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <p className="mb-2 flex items-center gap-2 text-[13px] text-[#e8eaed]">
                  <MonitorUp className="size-4 text-[#8ab4f8]" /> {name} is presenting
                </p>
                <div className="min-h-0 flex-1">
                  <VisualSummary
                    key={summaryKey}
                    session={session}
                    speaker={speaker}
                    lang={lang}
                    pauseSignal={pauseSignal}
                    onCaption={(t) => t && setCaption({ who: "Priya", text: t })}
                    onFinished={() => {
                      const my = ++talk.current;
                      addMsg({ from: "priya", text: OUTRO[lang].done });
                      say(OUTRO[lang].done, my);
                    }}
                    onExit={summarise}
                  />
                </div>
              </div>
              <div className="hidden w-[220px] shrink-0 flex-col gap-3 lg:flex xl:w-[260px]">
                <div className="aspect-video">{priyaTile(true)}</div>
                <div className="aspect-video">{youTile(true)}</div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="grid w-full max-w-[1400px] grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                <div className="aspect-video max-h-[42svh] md:max-h-none">{priyaTile()}</div>
                <div className="aspect-video max-h-[42svh] md:max-h-none">{youTile()}</div>
              </div>
            </div>
          )}

          {/* captions */}
          <AnimatePresence>
            {captionsOn && caption && !presenting && (
              <motion.div key="cap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2">
                <div className="flex max-w-3xl items-start gap-3 rounded-lg bg-[#000000]/75 px-4 py-3">
                  {caption.who === "Priya" ? <img src="/people/priya.jpg" alt="" className="size-7 shrink-0 rounded-full object-cover" /> : <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#7b5ea7] text-[12px] font-medium uppercase">{learnerName.slice(0, 1)}</span>}
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#e8eaed]">{caption.who === "Priya" ? name : "You"}</p>
                    <p className="line-clamp-3 text-[16px] leading-[1.4] text-white sm:text-[18px]">{caption.text.replace(/\*\*|`/g, "").replace(/```[\s\S]*?```/g, "…")}</p>
                  </div>
                </div>
              </motion.div>
            )}
            {listener.listening && (
              <motion.div key="listen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2">
                <div className="flex max-w-2xl items-center gap-3 rounded-lg bg-[#000000]/80 px-4 py-3 text-[15px]">
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#8ab4f8] opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-[#8ab4f8]" />
                  </span>
                  {listener.interim || (listener.engine === "groq" ? "Listening… tap the mic again to send" : "Listening… ask your question")}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* floating reactions */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <AnimatePresence>
              {reactions.map((r) => (
                <motion.span key={r.id} initial={{ y: 0, opacity: 0, scale: 0.6 }} animate={{ y: -320, opacity: [0, 1, 1, 0], scale: 1.2 }} transition={{ duration: 3, ease: "easeOut" }} className="absolute bottom-6 text-4xl" style={{ left: `${r.x}%` }}>
                  {r.e}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* side panel */}
        <AnimatePresence>
          {panel && (
            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="absolute inset-y-3 right-3 z-10 flex w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg bg-[#ffffff] text-[#202124] shadow-xl sm:inset-y-4 sm:right-4 lg:static lg:shrink-0"
            >
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <h3 className="text-[18px] font-normal">{panel === "chat" ? "In-call messages" : panel === "people" ? "People" : "Meeting details"}</h3>
                <button onClick={() => setPanel(null)} aria-label="Close panel" className="flex size-9 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]">
                  <X className="size-5" />
                </button>
              </div>
              {panel === "chat" && (
                <>
                  <p className="mx-4 rounded-lg bg-[#f1f3f4] px-3 py-2.5 text-center text-[12px] leading-[1.45] text-[#5f6368]">Ask Priya anything about this problem — she answers out loud. She'll guide you, but never write the code for you.</p>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {messages.map((m, i) => (
                      <div key={i}>
                        <p className="text-[12.5px] font-medium text-[#202124]">
                          {m.from === "priya" ? name : "You"} <span className="ml-1 font-normal text-[#5f6368]">{new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                        </p>
                        <Markdown text={m.text} className="mt-0.5 text-[13.5px] text-[#3c4043]" />
                      </div>
                    ))}
                    {busy && (
                      <p className="flex items-center gap-2 text-[12.5px] text-[#5f6368]">
                        <LoaderCircle className="size-3.5 animate-spin" /> {name} is typing…
                      </p>
                    )}
                    {!messages.length && !busy && <p className="pt-6 text-center text-[13px] text-[#5f6368]">No messages yet.</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                    {["Which line should I look at?", "Explain it more simply", "What should I try next?"].map((s) => (
                      <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full border border-[#dadce0] px-3 py-1 text-[12px] text-[#1a73e8] hover:bg-[#f8f9fa] disabled:opacity-50">
                        {s}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      ask(draft);
                      setDraft("");
                    }}
                    className="m-3 mt-1 flex items-center gap-2 rounded-full bg-[#f1f3f4] py-1.5 pl-4 pr-1.5"
                  >
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Send a message" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#5f6368]" />
                    <button disabled={!draft.trim() || busy} aria-label="Send" className="flex size-9 items-center justify-center rounded-full text-[#1a73e8] hover:bg-[#e8eaed] disabled:text-[#9aa0a6]">
                      <SendHorizontal className="size-5" />
                    </button>
                  </form>
                </>
              )}
              {panel === "people" && (
                <div className="space-y-1 px-3 py-2">
                  <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#5f6368]">In the meeting · 2</p>
                  {[
                    { n: `${learnerName} (You)`, sub: "Learner", img: null as string | null },
                    { n: name, sub: "Mentor · AI", img: session?.mentor.avatar ?? "/people/priya.jpg" },
                  ].map((p) => (
                    <div key={p.n} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#f8f9fa]">
                      {p.img ? <img src={p.img} alt="" className="size-9 rounded-full object-cover" /> : <span className="flex size-9 items-center justify-center rounded-full bg-[#7b5ea7] text-[14px] font-medium uppercase text-white">{learnerName.slice(0, 1)}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px]">{p.n}</p>
                        <p className="text-[12px] text-[#5f6368]">{p.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {panel === "info" && (
                <div className="space-y-4 px-5 py-2 text-[13.5px] leading-[1.5] text-[#3c4043]">
                  <div>
                    <p className="font-medium text-[#202124]">Joining info</p>
                    <p className="font-mono text-[13px]">layerflow.app/mentor/{code}</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#202124]">Problem</p>
                    <p>{session?.challenge.title}</p>
                    <code className="text-[12.5px] text-[#1967d2]">{session?.challenge.signature}</code>
                  </div>
                  <div>
                    <p className="font-medium text-[#202124]">What Priya can see</p>
                    <p>Your last attempt, its result, the Line Map, and a replay of your code on a safe example. Never the hidden tests' inputs.</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#202124]">Voice</p>
                    <p>{speaker.engine === "elevenlabs" ? "ElevenLabs" : "Your browser's built-in voice"} · listening with {listener.engine === "groq" ? "Groq Whisper" : listener.engine === "browser" ? "your browser" : "— (type instead)"}</p>
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* control bar */}
      <div className="relative flex h-[76px] shrink-0 items-center gap-2 px-3 sm:h-20 sm:px-6">
        <div className="hidden min-w-0 flex-1 items-center gap-3 text-[15px] font-medium text-[#e8eaed] lg:flex">
          <span>{clock}</span>
          <span className="h-4 w-px bg-[#5f6368]" />
          <span className="truncate">{code}</span>
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 sm:gap-3 lg:flex-none">
          <RoundBtn label={listener.listening ? "Stop and send" : "Ask out loud"} onClick={toggleMic} tone={listener.listening ? "default" : "danger"}>
            {listener.listening ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </RoundBtn>
          <RoundBtn label={camOn ? "Turn off camera" : "Turn on camera"} onClick={toggleCamera} tone={camOn ? "default" : "danger"}>
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </RoundBtn>
          <RoundBtn label="Captions" onClick={() => setCaptionsOn((c) => !c)} active={captionsOn} className="hidden sm:flex">
            <Captions className="size-5" />
          </RoundBtn>
          <div className="relative hidden sm:block">
            <RoundBtn label="Send a reaction" onClick={() => setTray((t) => !t)} active={tray}>
              <Smile className="size-5" />
            </RoundBtn>
            <AnimatePresence>
              {tray && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-14 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-[#3c4043] p-1.5 shadow-lg">
                  {["💖", "👍", "🎉", "👏", "😂", "😮", "🤔", "🙏"].map((e) => (
                    <button key={e} onClick={() => react(e)} className="flex size-9 items-center justify-center rounded-full text-xl hover:bg-white/10">
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={summarise}
            disabled={!session}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-all sm:h-12 sm:px-5",
              presenting ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]" : "bg-[#bbf451] text-[#17152a] shadow-[0_0_0_4px_rgba(187,244,81,0.18)] hover:shadow-[0_0_0_6px_rgba(187,244,81,0.25)]",
            )}
          >
            {presenting ? <MonitorUp className="size-4.5" /> : <Sparkles className="size-4.5" />}
            <span className="hidden sm:inline">{presenting ? "Stop presenting" : "Summarise"}</span>
          </button>
          <RoundBtn label={hand ? "Lower hand" : "Raise hand"} onClick={raiseHand} active={hand} className="hidden sm:flex">
            <Hand className="size-5" />
          </RoundBtn>
          <div className="relative">
            <RoundBtn label="More options" onClick={() => setMenu((m) => !m)}>
              <EllipsisVertical className="size-5" />
            </RoundBtn>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-14 right-0 w-64 overflow-hidden rounded-lg bg-[#ffffff] py-2 text-[#202124] shadow-xl">
                  <MenuItem
                    icon={speaker.muted ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                    label={speaker.muted ? "Turn Priya's voice on" : "Mute Priya's voice (captions only)"}
                    onClick={() => (speaker.setMuted(!speaker.muted), setMenu(false))}
                  />
                  <MenuItem icon={<Sparkles className="size-4" />} label="Restart the summary" onClick={() => (setMenu(false), setPresenting(false), setTimeout(summarise, 30))} />
                  <MenuItem icon={<Captions className="size-4" />} label={captionsOn ? "Turn off captions" : "Turn on captions"} onClick={() => (setCaptionsOn((c) => !c), setMenu(false))} />
                  <MenuItem icon={<Hand className="size-4" />} label="Raise hand" onClick={() => (setMenu(false), raiseHand())} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={hangUp} aria-label="Leave call" title="Leave call" className="flex h-10 w-14 shrink-0 items-center justify-center rounded-full bg-[#ea4335] text-white hover:bg-[#d93025] sm:h-12 sm:w-16">
            <PhoneOff className="size-5" />
          </button>
        </div>
        <div className="hidden flex-1 items-center justify-end gap-1 md:flex">
          <IconBtn label="Meeting details" onClick={() => setPanel((p) => (p === "info" ? null : "info"))} active={panel === "info"}>
            <Info className="size-5" />
          </IconBtn>
          <IconBtn label="People" onClick={() => setPanel((p) => (p === "people" ? null : "people"))} active={panel === "people"} badge={<span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#5f6368] text-[10px] font-semibold">2</span>}>
            <Users className="size-5" />
          </IconBtn>
          <IconBtn
            label="Chat with everyone"
            onClick={() => {
              setPanel((p) => (p === "chat" ? null : "chat"));
              setUnread(0);
            }}
            active={panel === "chat"}
            badge={unread > 0 && panel !== "chat" ? <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-[#8ab4f8]" /> : null}
          >
            <MessageSquareText className="size-5" />
          </IconBtn>
        </div>
        <button onClick={() => (setPanel((p) => (p === "chat" ? null : "chat")), setUnread(0))} className="relative flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10 md:hidden" aria-label="Chat">
          <MessageSquareText className="size-5" />
          {unread > 0 && panel !== "chat" && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-[#8ab4f8]" />}
        </button>
      </div>

      <AnimatePresence>{toast && <Toast text={toast} />}</AnimatePresence>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-[#f1f3f4]">
      <span className="text-[#5f6368]">{icon}</span>
      {label}
    </button>
  );
}

function Toast({ text, light }: { text: string; light?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className={cn("pointer-events-none fixed bottom-24 left-4 z-[95] flex max-w-sm items-center gap-2.5 rounded-lg px-4 py-3 text-[14px] shadow-lg", light ? "bg-[#202124] text-white" : "bg-[#ffffff] text-[#202124]")}
    >
      {text.endsWith("joined") && <img src="/people/priya.jpg" alt="" className="size-6 rounded-full object-cover" />}
      {text}
    </motion.div>
  );
}
