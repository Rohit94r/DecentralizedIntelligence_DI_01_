"use client";

/**
 * "How bug bounty works" — a narrated walkthrough that plays like a short
 * screen-recorded video: real screenshots of Layerflow, zoomed in on what
 * matters, with a cursor that clicks where you would click; Priya's voice
 * (ElevenLabs when the server has a key, the browser's voice otherwise),
 * captions, chapters and full screen. The script comes from the API
 * (translated to Hindi / Marathi when an AI provider is configured) and each
 * scene is paced by its narration.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  Building2,
  Calculator,
  Captions,
  CaptionsOff,
  CircleCheck,
  Code,
  Database,
  Expand,
  FileText,
  KeyRound,
  Lock,
  Mail,
  Pause,
  Play,
  RotateCcw,
  Search,
  Server,
  SkipBack,
  SkipForward,
  UserRound,
  Volume2,
  VolumeX,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { api, type ExplainerScene, type ExplainerVisual } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { estimateMs, sleep, useSpeaker } from "@/lib/voice";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const ICON: Record<string, LucideIcon> = {
  building: Building2,
  search: Search,
  file: FileText,
  check: CircleCheck,
  wallet: Wallet,
  database: Database,
  lock: Lock,
  key: KeyRound,
  calculator: Calculator,
  zap: Zap,
  code: Code,
  user: UserRound,
  server: Server,
  mail: Mail,
  book: BookOpen,
};

function Cursor() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]" aria-hidden>
      <path d="M4 2.5 19.5 13l-7 1.3L9 21z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** A real screenshot in a browser window: zoom into the part that matters, dim the rest, move the cursor and click. */
function Shot({ v }: { v: Extract<ExplainerVisual, { kind: "shot" }> }) {
  const f = v.focus;
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const zoom = Math.min(1.9, Math.max(1, 0.92 * Math.min(100 / f.w, 100 / f.h)));
  return (
    // a size container: the window is as big as fits — by width or by height — and keeps the screenshot's shape
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: "size" }}>
      <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#16181d] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]" style={{ width: "min(100cqw, calc((100cqh - 26px) * 1.4953))" }}>
        <div className="flex h-[26px] shrink-0 items-center gap-2 border-b border-white/10 px-3">
          <span className="flex gap-1.5">
            <i className="size-2 rounded-full bg-[#ff5f57]" />
            <i className="size-2 rounded-full bg-[#febc2e]" />
            <i className="size-2 rounded-full bg-[#28c840]" />
          </span>
          <span className="mx-auto truncate rounded-md bg-white/[0.08] px-3 py-0.5 font-mono text-[10.5px] text-white/60">localhost:3000{v.path}</span>
        </div>
        <div className="relative aspect-[1600/1070] overflow-hidden bg-white">
          <motion.div className="absolute inset-0" style={{ transformOrigin: `${cx}% ${cy}%` }} initial={{ scale: 1 }} animate={{ scale: zoom }} transition={{ delay: 0.7, duration: 1.3, ease }}>
            <img src={v.src} alt="" className="absolute inset-0 size-full" draggable={false} />
            {/* spotlight: the focus box stays bright, everything else dims */}
            <motion.div
              className="absolute rounded-md ring-2 ring-[#bbf451]"
              style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}
              initial={{ opacity: 0, boxShadow: "0 0 0 9999px rgba(10,10,12,0)" }}
              animate={{ opacity: 1, boxShadow: "0 0 0 9999px rgba(10,10,12,0.42)" }}
              transition={{ delay: 1.6, duration: 0.5 }}
            />
            {v.click && (
              <motion.div className="absolute" style={{ left: `${v.click.x}%`, top: `${v.click.y}%` }} initial={{ x: 120, y: 90, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ delay: 2.0, duration: 0.9, ease }}>
                <motion.span className="absolute -left-4 -top-4 size-8 rounded-full border-2 border-[#bbf451]" initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 1.4], opacity: [0, 1, 0] }} transition={{ delay: 3.0, duration: 0.7 }} />
                <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}>
                  <Cursor />
                </div>
              </motion.div>
            )}
          </motion.div>
          <motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }} className="absolute left-3 top-3 rounded-lg bg-[#0b0b0f]/90 px-3 py-1.5 text-[12px] font-semibold text-white sm:text-[13px]">
            {v.label}
          </motion.span>
        </div>
      </div>
    </div>
  );
}

function Visual({ v }: { v: ExplainerVisual }) {
  switch (v.kind) {
    case "title":
      return (
        <div className="flex flex-col items-center text-center">
          <motion.img src="/brands/layerflow.svg" alt="" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="size-14 rounded-2xl" />
          <motion.h3 initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, ease }} className="mt-5 text-[30px] font-semibold tracking-[-0.035em] text-white sm:text-[44px]">
            {v.heading}
          </motion.h3>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-2 text-[14px] text-white/60 sm:text-[16px]">
            {v.sub}
          </motion.p>
        </div>
      );
    case "steps":
      return (
        <div className="w-full max-w-3xl">
          <div className="relative grid grid-cols-5 gap-2">
            <motion.span className="absolute left-[10%] right-[10%] top-6 h-px origin-left bg-white/20" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2, duration: 2.4 }} />
            {v.steps.map((s, i) => {
              const I = ICON[s.icon] ?? CircleCheck;
              return (
                <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.55, ease }} className="relative flex flex-col items-center text-center">
                  <span className="flex size-12 items-center justify-center rounded-full border border-white/15 bg-[#1b1e24] text-[#bbf451]">
                    <I className="size-5" />
                  </span>
                  <span className="mt-1.5 text-[10.5px] font-semibold text-white/40">0{i + 1}</span>
                  <span className="mt-0.5 text-[11.5px] font-medium leading-tight text-white/90 sm:text-[13px]">{s.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    case "shot":
      return <Shot v={v} />;
    case "classes":
      return (
        <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
          {v.items.map((it, i) => {
            const I = ICON[it.icon] ?? Code;
            return (
              <motion.div key={it.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.5, ease }} className="rounded-xl border border-white/10 bg-[#1b1e24] p-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/[0.07] text-[#bbf451]">
                  <I className="size-4" />
                </span>
                <p className="mt-2 text-[13px] font-semibold text-white">{it.label}</p>
                <p className="text-[11.5px] leading-snug text-white/55">{it.ask}</p>
              </motion.div>
            );
          })}
        </div>
      );
    case "rules":
      return (
        <div className="w-full max-w-xl space-y-2">
          {v.rules.map((r, i) => {
            const I = ICON[r.icon] ?? CircleCheck;
            return (
              <motion.div key={r.text} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.9 }} className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#1b1e24] px-4 py-2.5">
                <I className="mt-0.5 size-4 shrink-0 text-[#bbf451]" />
                <span className="text-[13px] leading-snug text-white/90">{r.text}</span>
              </motion.div>
            );
          })}
        </div>
      );
    case "outro":
      return (
        <div className="flex flex-col items-center text-center">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[24px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
            Your turn.
          </motion.p>
          <ol className="mt-5 space-y-2 text-left">
            {v.cta.map((c, i) => (
              <motion.li key={c} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.5 }} className="flex items-center gap-3 text-[14px] text-white/85">
                <span className="flex size-6 items-center justify-center rounded-full bg-[#bbf451] text-[12px] font-bold text-[#0a0a0a]">{i + 1}</span>
                {c}
              </motion.li>
            ))}
          </ol>
        </div>
      );
  }
}

export function BountyExplainer() {
  const { lang } = useI18n();
  const speaker = useSpeaker();
  const [scenes, setScenes] = useState<ExplainerScene[] | null>(null);
  const [sceneLang, setSceneLang] = useState("en");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [sceneStart, setSceneStart] = useState(0);
  const [now, setNow] = useState(0);
  const run = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .explainer(lang)
      .then((r) => {
        if (!alive) return;
        setScenes(r.scenes);
        setSceneLang(r.lang);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  // a ticking clock only while playing — drives the progress bar inside a scene
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [playing]);

  const stop = useCallback(() => {
    run.current++;
    speaker.stop();
    setPlaying(false);
  }, [speaker]);

  const playFrom = useCallback(
    async (start: number) => {
      if (!scenes) return;
      const my = ++run.current;
      speaker.stop();
      setStarted(true);
      setPlaying(true);
      for (let i = start; i < scenes.length; i++) {
        if (my !== run.current) return;
        setIdx(i);
        const t0 = Date.now();
        setSceneStart(t0);
        setNow(t0);
        await speaker.speak(scenes[i].say, { lang: sceneLang });
        // never cut a scene shorter than its animation needs
        const left = Math.max(0, Math.min(estimateMs(scenes[i].say), 6000) - (Date.now() - t0));
        await sleep(Math.max(500, Math.min(left, 2500)));
      }
      if (my === run.current) setPlaying(false);
    },
    [scenes, sceneLang, speaker],
  );

  useEffect(() => () => void run.current++, []);

  if (!scenes)
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-3xl bg-neutral-950">
        <span className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );

  const scene = scenes[idx];
  const dur = estimateMs(scene.say);
  const within = playing ? Math.min(1, (now - sceneStart) / dur) : 0;
  const total = scenes.reduce((n, s) => n + estimateMs(s.say), 0);
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <div ref={box} className="relative isolate w-full overflow-hidden rounded-2xl bg-[#0f1115] text-white xl:h-full">
      {/* stage */}
      <div className="relative aspect-[4/5] w-full sm:aspect-video xl:aspect-auto xl:h-full xl:min-h-[400px]">

        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 sm:left-5 sm:top-5">
          <img src="/people/priya.jpg" alt="" className={cn("size-8 rounded-full object-cover ring-2 transition-all", speaker.speaking ? "ring-[#bbf451]" : "ring-white/20")} />
          <div className="leading-tight">
            <p className="text-[12px] font-semibold text-white">How bug bounty works</p>
            <p className="text-[11px] text-white/50">
              {idx + 1}/{scenes.length} · {scene.chapter}
            </p>
          </div>
        </div>

        {started && (
          <div className={cn("absolute inset-0 flex items-center justify-center px-4 pt-14 sm:px-8", scene.visual.kind === "shot" ? "!px-3 !pt-12 pb-[60px]" : captions ? "pb-36 sm:pb-32" : "pb-20")}>
            <AnimatePresence mode="wait">
              <motion.div key={scene.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} className="flex h-full w-full items-center justify-center">
                <Visual v={scene.visual} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {captions && started && (
          <div className="absolute inset-x-0 bottom-[84px] z-10 flex justify-center px-4">
            <AnimatePresence mode="wait">
              <motion.p key={scene.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="line-clamp-4 max-w-3xl rounded-xl bg-black/70 px-3 py-1.5 text-center text-[12px] leading-snug text-white sm:text-[13px]">
                {scene.say}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {!started && (
          <button onClick={() => playFrom(0)} className="group absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center" aria-label="Play the explainer">
            <img src="/explainer/1-programs.webp" alt="" className="absolute inset-0 size-full object-cover object-top opacity-25" />
            <span className="absolute inset-0 bg-gradient-to-t from-[#0f1115] via-[#0f1115]/70 to-[#0f1115]/40" />
            <span className="relative mt-2 flex size-16 items-center justify-center rounded-full bg-white text-[#0a0a0a] transition-transform group-hover:scale-105 sm:size-[72px]">
              <Play className="ml-1 size-7 fill-current" />
            </span>
            <span className="relative text-[20px] font-semibold tracking-[-0.03em] text-white sm:text-[26px]">How bug bounty works</span>
            <span className="relative text-[12px] text-white/60">
              {scenes.length} chapters · about {fmt(total)} · narrated by Priya{sceneLang !== "en" ? ` · ${sceneLang === "hi" ? "हिन्दी" : "मराठी"}` : ""}
            </span>
          </button>
        )}
      </div>

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2.5 pt-6 sm:px-4">
        <div className="mb-2 flex gap-1">
          {scenes.map((s, i) => (
            <button key={s.id} onClick={() => playFrom(i)} title={`${i + 1}. ${s.chapter}`} className="group h-3 flex-1 py-1" aria-label={`Chapter ${i + 1}: ${s.chapter}`}>
              <span className="block h-1 overflow-hidden rounded-full bg-white/20 group-hover:bg-white/35">
                <span className="block h-full rounded-full bg-white" style={{ width: i < idx ? "100%" : i === idx ? `${Math.round((started ? within : 0) * 100)}%` : "0%" }} />
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => playFrom(Math.max(0, idx - 1))} className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10" aria-label="Previous chapter">
            <SkipBack className="size-4" />
          </button>
          <button
            onClick={() => (playing ? stop() : playFrom(!started || idx === scenes.length - 1 ? (idx === scenes.length - 1 && started ? 0 : idx) : idx))}
            className="flex size-9 items-center justify-center rounded-full bg-white text-[#0a0a0a]"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-4 fill-current" /> : started && idx === scenes.length - 1 ? <RotateCcw className="size-4" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </button>
          <button onClick={() => playFrom(Math.min(scenes.length - 1, idx + 1))} className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10" aria-label="Next chapter">
            <SkipForward className="size-4" />
          </button>
          <span className="ml-1 hidden truncate text-[12px] text-white/70 sm:block">{scene.chapter}</span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => speaker.setMuted(!speaker.muted)} className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10" aria-label={speaker.muted ? "Unmute" : "Mute"}>
              {speaker.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button onClick={() => setCaptions((c) => !c)} className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10" aria-label="Captions">
              {captions ? <Captions className="size-4" /> : <CaptionsOff className="size-4" />}
            </button>
            <button onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.())} className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10" aria-label="Full screen">
              <Expand className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
