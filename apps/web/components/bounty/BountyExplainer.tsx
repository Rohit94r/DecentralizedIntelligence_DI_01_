"use client";

/**
 * "How bug bounty works" — a narrated explainer that plays like a short video:
 * ten animated scenes, Priya's voice (ElevenLabs when the server has a key,
 * the browser's voice otherwise), captions, chapters, a scrubbable progress
 * bar and full screen. Nothing is pre-rendered: the script comes from the API
 * (translated to Hindi / Marathi when an AI provider is configured) and each
 * scene is paced by its narration.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Captions, CaptionsOff, Expand, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { api, type ExplainerScene, type ExplainerVisual } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { estimateMs, sleep, useSpeaker } from "@/lib/voice";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

function Visual({ v }: { v: ExplainerVisual }) {
  switch (v.kind) {
    case "title":
      return (
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 12 }} className="text-6xl sm:text-7xl">
            🐞
          </motion.div>
          <motion.h3 initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, ease }} className="mt-4 text-[28px] font-medium tracking-[-0.04em] text-white sm:text-[42px]">
            {v.heading}
          </motion.h3>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {v.sub.split("·").map((s, i) => (
              <motion.span key={s} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 + i * 0.25 }} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-semibold text-[#d9f99d] sm:text-[13px]">
                {s.trim()}
              </motion.span>
            ))}
          </div>
        </div>
      );
    case "flow":
      return (
        <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
          {v.steps.map((s, i) => (
            <React.Fragment key={s.label}>
              <motion.div initial={{ y: 18, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.55, ease }} className="flex w-[92px] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.07] px-1.5 py-2.5 text-center sm:w-[100px]">
                <span className="text-2xl sm:text-3xl">{s.icon}</span>
                <span className="mt-1.5 text-[10.5px] font-semibold leading-tight text-white/90 sm:text-[11.5px]">{s.label}</span>
              </motion.div>
              {i < v.steps.length - 1 && (
                <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.55 }} className="hidden text-[#bbf451] md:block">
                  →
                </motion.span>
              )}
            </React.Fragment>
          ))}
        </div>
      );
    case "scope":
      return (
        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {[
            ["In scope", v.inside, "#359462", "✓"],
            ["Out of scope", v.outside, "#e8792b", "✕"],
          ].map(([label, items, color, mark], col) => (
            <motion.div key={label as string} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + Number(col) * 0.5 }} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: color as string }}>
                {label as string}
              </p>
              <ul className="mt-2 space-y-1.5">
                {(items as string[]).map((it, i) => (
                  <motion.li key={it} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 + Number(col) * 0.5 + i * 0.3 }} className="flex items-start gap-2 text-[13px] text-white/85">
                    <span className="font-bold" style={{ color: color as string }}>
                      {mark as string}
                    </span>
                    {it}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      );
    case "recon":
      return (
        <div className="flex w-full max-w-2xl flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="w-44 rounded-2xl border border-white/10 bg-white/[0.06] p-3 font-mono text-[12px]">
            {v.tree.map((f, i) => (
              <motion.p key={f} initial={{ opacity: 0 }} animate={{ opacity: 1, color: i === 0 ? "#bbf451" : "rgba(255,255,255,0.7)" }} transition={{ delay: 0.2 + i * 0.2 }} className="py-0.5">
                {i === 0 ? "▸ " : "  "}
                {f}
              </motion.p>
            ))}
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2 }} className="rounded-xl bg-[#bbf451] px-3 py-2 font-mono text-[12px] font-bold text-[#0a0a0a]">
            {v.focus}
          </motion.div>
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.8, duration: 0.8 }} className="h-0.5 w-10 origin-left bg-gradient-to-r from-[#bbf451] to-[#e8792b] sm:w-14" />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.6 }} className="rounded-xl border border-[#e8792b]/60 bg-[#e8792b]/15 px-3 py-2 font-mono text-[12px] font-bold text-[#fdba74]">
            {v.to}
          </motion.div>
        </div>
      );
    case "classes":
      return (
        <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {v.items.map((it, i) => (
            <motion.div key={it.label} initial={{ opacity: 0, y: 14, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.25 + i * 0.6, type: "spring", stiffness: 180, damping: 16 }} className="rounded-2xl border border-white/10 bg-white/[0.07] p-3">
              <p className="text-2xl">{it.icon}</p>
              <p className="mt-1 text-[13px] font-semibold text-white">{it.label}</p>
              <p className="text-[11.5px] leading-snug text-white/60">{it.ask}</p>
            </motion.div>
          ))}
        </div>
      );
    case "prove":
      return (
        <div className="w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 py-2 font-mono text-[11.5px] sm:text-[12.5px]">
            {v.code.map((l, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, backgroundColor: i + 1 === v.line ? ["rgba(232,121,43,0)", "rgba(232,121,43,0.28)", "rgba(232,121,43,0.18)"] : "rgba(0,0,0,0)" }}
                transition={{ delay: i * 0.12, backgroundColor: { delay: 1.4, duration: 1.2 } }}
                className="flex gap-3 whitespace-pre px-3 leading-[22px] text-white/85"
              >
                <span className="w-4 text-right text-white/30">{i + 1}</span>
                {l}
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 }} className="mt-3 rounded-2xl bg-[#e8792b] px-4 py-2.5 font-mono text-[12px] font-semibold text-white">
            {v.note}
          </motion.div>
        </div>
      );
    case "report":
      return (
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.07] p-4">
          {v.fields.map((f, i) => (
            <motion.div key={f.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.8 }} className="flex gap-3 border-b border-white/5 py-1.5 last:border-0">
              <span className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#bbf451]">{f.label}</span>
              <span className="text-[12.5px] leading-snug text-white/90">{f.value}</span>
            </motion.div>
          ))}
        </div>
      );
    case "reward":
      return (
        <div className="w-full max-w-md">
          {v.rows.map((r, i) => (
            <div key={r.severity} className="mb-2 flex items-center gap-3">
              <span className="w-16 text-[12px] font-semibold text-white/80">{r.severity}</span>
              <div className="h-7 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(r.points / v.rows[0].points) * 100}%` }} transition={{ delay: 0.3 + i * 0.4, duration: 0.9, ease }} className="flex h-full items-center justify-end rounded-full pr-3 text-[12px] font-bold text-white" style={{ backgroundColor: r.color }}>
                  {r.points}
                </motion.div>
              </div>
            </div>
          ))}
          <motion.p initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.2, type: "spring" }} className="mx-auto mt-4 w-fit rounded-full bg-[#bbf451] px-4 py-1.5 text-[14px] font-bold text-[#0a0a0a]">
            ⚡ {v.rate}
          </motion.p>
        </div>
      );
    case "rules":
      return (
        <div className="w-full max-w-xl space-y-2">
          {v.rules.map((r, i) => (
            <motion.div key={r.text} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.9 }} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
              <span className="text-xl">{r.icon}</span>
              <span className="text-[13px] leading-snug text-white/90">{r.text}</span>
            </motion.div>
          ))}
        </div>
      );
    case "outro":
      return (
        <div className="flex flex-col items-center text-center">
          <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }} className="text-5xl">
            🏆
          </motion.p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {v.cta.map((c, i) => (
              <motion.span key={c} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.5 }} className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0a0a0a]">
                {i + 1}. {c}
              </motion.span>
            ))}
          </div>
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
    <div ref={box} className="relative w-full overflow-hidden rounded-3xl bg-[#0b0b0f] text-white shadow-[0_24px_60px_-24px_rgba(16,15,25,0.55)]">
      {/* stage */}
      <div className="relative aspect-[4/5] w-full sm:aspect-video">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-[#359462]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-[#5e2ac4]/30 blur-3xl" />

        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 sm:left-5 sm:top-5">
          <img src="/people/priya.jpg" alt="" className={cn("size-8 rounded-full object-cover ring-2 transition-all", speaker.speaking ? "ring-[#bbf451]" : "ring-white/20")} />
          <div className="leading-tight">
            <p className="text-[12px] font-semibold text-white">Priya · Bug bounty, explained</p>
            <p className="text-[11px] text-white/50">
              {idx + 1}/{scenes.length} · {scene.chapter}
            </p>
          </div>
        </div>

        {started && (
          <div className={cn("absolute inset-0 flex items-center justify-center px-5 pt-14 sm:px-10", captions ? "pb-36 sm:pb-32" : "pb-20")}>
            <AnimatePresence mode="wait">
              <motion.div key={scene.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} className="flex w-full justify-center">
                <Visual v={scene.visual} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {captions && started && (
          <div className="absolute inset-x-0 bottom-14 z-10 flex justify-center px-4">
            <AnimatePresence mode="wait">
              <motion.p key={scene.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="line-clamp-4 max-w-3xl rounded-xl bg-black/70 px-3 py-1.5 text-center text-[12px] leading-snug text-white sm:text-[13px]">
                {scene.say}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {!started && (
          <button onClick={() => playFrom(0)} className="group absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center" aria-label="Play the explainer">
            <span className="flex flex-wrap justify-center gap-1.5 text-3xl sm:text-4xl" aria-hidden>
              {["🏢", "🕵️", "🐞", "📝", "🏆"].map((e, i) => (
                <motion.span key={e} initial={{ y: 8, opacity: 0 }} animate={{ y: [0, -4, 0], opacity: 1 }} transition={{ delay: i * 0.12, y: { delay: 1 + i * 0.15, duration: 1.6, repeat: Infinity, repeatDelay: 2 } }}>
                  {e}
                </motion.span>
              ))}
            </span>
            <span className="mt-2 flex size-16 items-center justify-center rounded-full bg-[#bbf451] text-[#0a0a0a] shadow-[0_0_0_10px_rgba(187,244,81,0.15)] transition-transform group-hover:scale-105 sm:size-20">
              <Play className="ml-1 size-7 fill-current sm:size-8" />
            </span>
            <span className="text-[20px] font-medium tracking-[-0.03em] text-white sm:text-[26px]">How bug bounty works</span>
            <span className="text-[12px] text-white/60">
              {scenes.length} chapters · about {fmt(total)} · voiced by Priya{sceneLang !== "en" ? ` · ${sceneLang === "hi" ? "हिन्दी" : "मराठी"}` : ""}
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
                <span className="block h-full rounded-full bg-[#bbf451]" style={{ width: i < idx ? "100%" : i === idx ? `${Math.round((started ? within : 0) * 100)}%` : "0%" }} />
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
