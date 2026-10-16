/** `npm run seed` — wipe and re-seed the demo learners through the real sandbox. */
import { createRuntime } from "./context.ts";
import { seedAll } from "./seed-data.ts";

process.removeAllListeners("warning");
const rt = createRuntime({ llm: false });
const t0 = Date.now();
console.log("[seed] seeding rohan, meera, kabir through the real engine + sandbox…");
await seedAll(rt, (s) => console.log(s));
const s = rt.store.stats();
console.log(`[seed] done in ${((Date.now() - t0) / 1000).toFixed(1)} s — ${s.learners} learners, ${s.submissions} submissions, ${s.hints} hints, ${s.rejected} guardrail rejections logged`);
rt.close();
process.exit(0);
