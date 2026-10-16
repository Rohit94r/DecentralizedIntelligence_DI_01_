"use client";

/**
 * Voice for Priya, with zero required keys.
 *
 *   speaking:  ElevenLabs (via /api/voice/tts, when the server has a key)
 *              → the browser's own speech engine (Web Speech API) otherwise
 *   listening: Groq Whisper (via /api/voice/stt, when the server has a key)
 *              → the browser's own speech recognition (Chrome / Edge) otherwise
 *
 * The presentation is paced by the narration either way: with sound off we
 * still wait about as long as the line would take to say.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type VoiceStatus } from "@/lib/api";

let statusPromise: Promise<VoiceStatus | null> | null = null;
export function voiceStatusOnce(): Promise<VoiceStatus | null> {
  statusPromise ??= api.voiceStatus().catch(() => null);
  return statusPromise;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Roughly how long a line takes to say aloud. */
export function estimateMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(22_000, Math.max(1400, (words / 2.6) * 1000 + 300));
}

/** Markdown and code-ish text → something nice to hear. */
export function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (there's a small example in the chat) ")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*(\d+)\.\s+/gm, "$1: ")
    .replace(/\s+/g, " ")
    .trim();
}

const BCP47: Record<string, string[]> = { en: ["en-IN", "en-GB", "en-US", "en"], hi: ["hi-IN", "hi"], mr: ["mr-IN", "hi-IN", "hi"] };
const FEMALE = /female|heera|neerja|swara|kalpana|veena|lekha|priya|zira|aria|jenny|samantha|sonia|libby|susan|hazel|emma|ava|google uk english female|google हिन्दी|natural/i;

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const want of BCP47[lang] ?? BCP47.en) {
    const cands = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(want.toLowerCase()));
    const best = cands.find((v) => FEMALE.test(v.name) && /natural|online|neural/i.test(v.name)) ?? cands.find((v) => FEMALE.test(v.name)) ?? cands[0];
    if (best) return best;
  }
  return voices[0] ?? null;
}

/** Chrome cuts long utterances — speak sentence by sentence. */
function browserSpeak(text: string, lang: string, cancelled: () => boolean): Promise<void> {
  const synth = window.speechSynthesis;
  const parts = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const voice = pickVoice(lang);
  return new Promise<void>((resolve) => {
    let i = 0;
    const next = () => {
      if (cancelled() || i >= parts.length) return resolve();
      const u = new SpeechSynthesisUtterance(parts[i++].trim());
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? (BCP47[lang] ?? BCP47.en)[0];
      u.rate = 1.02;
      u.pitch = 1.05;
      u.onend = next;
      u.onerror = next;
      synth.speak(u);
    };
    next();
  });
}

export interface Speaker {
  speak: (text: string, opts?: { lang?: string }) => Promise<void>;
  stop: () => void;
  speaking: boolean;
  muted: boolean;
  setMuted: (m: boolean) => void;
  engine: "elevenlabs" | "browser" | "none";
}

export function useSpeaker(): Speaker {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [engine, setEngine] = useState<Speaker["engine"]>("browser");
  const audio = useRef<HTMLAudioElement | null>(null);
  const token = useRef(0);
  const mutedRef = useRef(false);
  const engineRef = useRef<Speaker["engine"]>("browser");

  useEffect(() => {
    let alive = true;
    voiceStatusOnce().then((s) => {
      if (!alive) return;
      const e = s?.tts === "elevenlabs" ? "elevenlabs" : typeof window !== "undefined" && "speechSynthesis" in window ? "browser" : "none";
      engineRef.current = e;
      setEngine(e);
    });
    // voices load asynchronously in Chrome
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => {
      alive = false;
    };
  }, []);

  const stop = useCallback(() => {
    token.current++;
    if (audio.current) {
      audio.current.pause();
      audio.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (text: string, opts: { lang?: string } = {}) => {
      stop();
      const my = ++token.current;
      const clean = toSpeech(text);
      if (!clean) return;
      setSpeaking(true);
      try {
        if (mutedRef.current || engineRef.current === "none") {
          await sleep(estimateMs(clean));
          return;
        }
        if (engineRef.current === "elevenlabs") {
          const r = await fetch("/api/voice/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: clean }) }).catch(() => null);
          if (my !== token.current) return;
          if (r && r.status === 200) {
            const url = URL.createObjectURL(await r.blob());
            if (my !== token.current) return URL.revokeObjectURL(url);
            const a = new Audio(url);
            audio.current = a;
            await new Promise<void>((res) => {
              a.onended = () => res();
              a.onerror = () => res();
              a.play().catch(() => res());
            });
            URL.revokeObjectURL(url);
            return;
          }
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) await browserSpeak(clean, opts.lang ?? "en", () => my !== token.current);
        else await sleep(estimateMs(clean));
      } finally {
        if (my === token.current) setSpeaking(false);
      }
    },
    [stop],
  );

  const setMuted = useCallback(
    (m: boolean) => {
      mutedRef.current = m;
      setMutedState(m);
      if (m) {
        if (audio.current) audio.current.muted = true;
        if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      }
    },
    [],
  );

  return { speak, stop, speaking, muted, setMuted, engine };
}

/* ───────────────────────── listening ───────────────────────── */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface Listener {
  start: () => void;
  stop: () => void;
  listening: boolean;
  interim: string;
  engine: "groq" | "browser" | "none";
  error: string | null;
}

/** Tap to talk, tap again (or pause) to send. `onFinal` receives the transcript. */
export function useListener(onFinal: (text: string) => void, lang = "en"): Listener {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [engine, setEngine] = useState<Listener["engine"]>("none");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const media = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null);
  const finalCb = useRef(onFinal);
  useEffect(() => {
    finalCb.current = onFinal;
  });

  useEffect(() => {
    voiceStatusOnce().then((s) => {
      const canRecord = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
      setEngine(s?.stt === "groq" && canRecord ? "groq" : recognitionCtor() ? "browser" : "none");
    });
  }, []);

  const stop = useCallback(() => {
    if (rec.current) rec.current.stop();
    if (media.current && media.current.recorder.state !== "inactive") media.current.recorder.stop();
  }, []);

  const start = useCallback(() => {
    setError(null);
    setInterim("");
    if (engine === "groq") {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
          const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          recorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            setListening(false);
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (blob.size < 1200) return;
            setInterim("…");
            const r = await fetch("/api/voice/stt", { method: "POST", headers: { "content-type": blob.type.split(";")[0] || "audio/webm" }, body: blob }).catch(() => null);
            setInterim("");
            if (r && r.status === 200) {
              const j = (await r.json()) as { text?: string };
              if (j.text) finalCb.current(j.text);
            } else setError("I couldn't hear that clearly — try again, or type it in the chat.");
          };
          media.current = { recorder, stream, chunks };
          recorder.start();
          setListening(true);
        })
        .catch(() => setError("Microphone permission was blocked. Allow it in the address bar, or type instead."));
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser — type in the chat instead (Chrome and Edge support it).");
      return;
    }
    const r = new Ctor();
    r.lang = (BCP47[lang] ?? BCP47.en)[0];
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim((finalText + " " + live).trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone permission was blocked. Allow it in the address bar, or type instead.");
      else if (e.error !== "aborted" && e.error !== "no-speech") setError("I didn't catch that — try again.");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
      if (finalText.trim()) finalCb.current(finalText.trim());
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("The microphone is busy — try again in a second.");
    }
  }, [engine, lang]);

  useEffect(
    () => () => {
      rec.current?.abort();
      media.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { start, stop, listening, interim, engine, error };
}
