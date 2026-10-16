/**
 * Voice for the mentor: ElevenLabs text-to-speech and Groq Whisper speech-to-text.
 *
 * Both OPTIONAL. Without ELEVENLABS_API_KEY the browser's own speech engine
 * speaks the mentor's lines; without GROQ_API_KEY the browser's own speech
 * recognition (Chrome / Edge) listens. The UI asks /api/voice/status which
 * one to use, so the session works the same with zero keys.
 */
import { createHash } from "node:crypto";
import { MENTOR } from "@layerflow/core";

const TTS_MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";
const STT_MODEL = process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo";

/** ELEVENLABS_API_KEY (ELEVEN_LABS_API_KEY is accepted too). */
function elevenKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || undefined;
}

/** Small LRU so replaying a session never re-bills the same line. */
const cache = new Map<string, Buffer>();
const CACHE_MAX = 300;
let ttsDisabledUntil = 0;

export function voiceStatus() {
  return {
    tts: elevenKey() && Date.now() > ttsDisabledUntil ? "elevenlabs" : "browser",
    stt: process.env.GROQ_API_KEY ? "groq" : "browser",
    tts_model: elevenKey() ? TTS_MODEL : null,
    stt_model: process.env.GROQ_API_KEY ? STT_MODEL : null,
  };
}

export async function synthesize(text: string, log: (s: string) => void = () => {}): Promise<Buffer | null> {
  const key = elevenKey();
  if (!key || Date.now() < ttsDisabledUntil) return null;
  const clean = text.replace(/\*\*|`/g, "").slice(0, 900);
  const voice = process.env.ELEVENLABS_VOICE_ID ?? MENTOR.elevenLabsVoiceId;
  const id = createHash("sha1").update(`${voice}|${TTS_MODEL}|${clean}`).digest("hex");
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id);
    cache.set(id, hit);
    return hit;
  }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: clean, model_id: TTS_MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!r || !r.ok) {
    const status = r?.status ?? 0;
    log(`[voice] ElevenLabs ${status || "unreachable"} — falling back to the browser voice${status === 401 || status === 402 || status === 429 ? " for 10 minutes" : ""}`);
    if (status === 401 || status === 402 || status === 429) ttsDisabledUntil = Date.now() + 10 * 60_000;
    return null;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  cache.set(id, buf);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return buf;
}

export async function transcribe(audio: Buffer, mime: string, log: (s: string) => void = () => {}): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key || audio.length < 800) return null;
  const ext = /ogg/.test(mime) ? "ogg" : /mp4|m4a|aac/.test(mime) ? "m4a" : /wav/.test(mime) ? "wav" : /mpeg|mp3/.test(mime) ? "mp3" : "webm";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime || "audio/webm" }), `speech.${ext}`);
  form.append("model", STT_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  if (!r || !r.ok) {
    log(`[voice] Groq Whisper ${r?.status ?? "unreachable"} — the browser will listen instead`);
    return null;
  }
  const j = (await r.json()) as { text?: string };
  return j.text?.trim() || null;
}
