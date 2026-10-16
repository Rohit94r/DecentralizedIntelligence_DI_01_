/**
 * Debug Dojo API server.  `npm run api`  (or `npm start` for everything)
 *
 * First boot seeds the demo learners automatically, so the judges never see
 * an empty product. Listens on DOJO_API_PORT (default 4000); the web app on
 * :3000 proxies /api/* here, so judges get ONE origin and no CORS.
 */
import { buildApp } from "./app.ts";
import { createRuntime } from "./context.ts";
import { seedAll } from "./seed-data.ts";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name !== "ExperimentalWarning") console.warn(w);
});
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));

const PORT = Number(process.env.DOJO_API_PORT ?? 4000);
const HOST = process.env.DOJO_API_HOST ?? "0.0.0.0";

const rt = createRuntime({ log: (s) => console.log(s) });
let seeding: Promise<void> | null = null;
const reseed = () => (seeding ??= seedAll(rt, (s) => console.log(s)).finally(() => (seeding = null)));

const app = await buildApp({ ...rt, pool: rt.pool, reseed });

if (rt.store.learners().length === 0 || process.env.DOJO_RESEED === "1") {
  console.log("[dojo] first boot — seeding demo learners (rohan, meera, kabir) through the real sandbox…");
  const t0 = Date.now();
  await reseed();
  console.log(`[dojo] seed done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

await app.listen({ port: PORT, host: HOST });
console.log(`[dojo] API ready on http://localhost:${PORT}  ·  LLM tier: ${rt.rewriter ? rt.rewriter.model : "off (deterministic tier — no API key needed)"}`);

const shutdown = async () => {
  await app.close().catch(() => {});
  rt.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Started by `npm start`? Then go down with the launcher, even if it was force-killed.
const parent = Number(process.env.DOJO_PARENT_PID);
if (parent) {
  setInterval(() => {
    try {
      process.kill(parent, 0);
    } catch {
      shutdown();
    }
  }, 2000).unref();
}
