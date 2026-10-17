/**
 * Layerflow API server.  `npm run api`  (or `npm start` for everything)
 *
 * First boot seeds the demo learners automatically, so the judges never see
 * an empty product. Listens on LAYERFLOW_API_PORT (default 4000); the web app on
 * :3000 proxies /api/* here, so judges get ONE origin and no CORS.
 */
import { buildApp } from "./app.ts";
import { createRuntime } from "./context.ts";
import { checkKey } from "./lib/razorpay.ts";
import { loadEnv } from "./lib/env.ts";
import { voiceStatus } from "./lib/voice.ts";
import { seedAll } from "./seed-data.ts";

loadEnv();

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name !== "ExperimentalWarning") console.warn(w);
});
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));

const PORT = Number(process.env.LAYERFLOW_API_PORT ?? 4000);
const HOST = process.env.LAYERFLOW_API_HOST ?? "0.0.0.0";

const rt = createRuntime({ log: (s) => console.log(s) });
let seeding: Promise<void> | null = null;
const reseed = () => (seeding ??= seedAll(rt, (s) => console.log(s)).finally(() => (seeding = null)));

const app = await buildApp({ ...rt, pool: rt.pool, reseed, log: (s) => console.log(s) });

if (rt.store.learners().length === 0 || process.env.LAYERFLOW_RESEED === "1") {
  console.log("[layerflow] first boot — seeding demo learners (yash, riya, khushi) through the real sandbox…");
  const t0 = Date.now();
  await reseed();
  console.log(`[layerflow] seed done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

await app.listen({ port: PORT, host: HOST });
console.log(`[layerflow] API ready on http://localhost:${PORT}  ·  LLM tier: ${rt.rewriter ? rt.rewriter.model : "off (deterministic tier — no API key needed)"}`);
const v = voiceStatus();
console.log(`[layerflow] mentor chat: ${rt.ai ? rt.ai.providers.join(" → ") : "built-in replies (add GROQ_API_KEY or GEMINI_API_KEY for AI)"}  ·  voice: ${v.tts === "elevenlabs" ? "ElevenLabs" : "browser"}  ·  listening: ${v.stt === "groq" ? "Groq Whisper" : "browser"}`);
checkKey().then((k) => console.log(`[layerflow] payments: ${k.message}`));

const shutdown = async () => {
  await app.close().catch(() => {});
  rt.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Started by `npm start`? Then go down with the launcher, even if it was force-killed.
const parent = Number(process.env.LAYERFLOW_PARENT_PID);
if (parent) {
  setInterval(() => {
    try {
      process.kill(parent, 0);
    } catch {
      shutdown();
    }
  }, 2000).unref();
}
