/**
 * Seeds the three pseudonymous demo learners by playing their scripts through
 * the REAL engine and sandbox (no hand-written rows), so what the judges see
 * on the dashboard is exactly what the product computes.
 *
 * rohan — the statement's story: two recurring mistakes, one one-off slip,
 *         a non-empty "why this next" reason · meera — boundary mistakes and
 *         an "answer please" that still only climbed one rung · kabir — new,
 *         nothing recurring yet.
 */
import { SEED_LEARNERS } from "./fixtures.ts";
import { runScript, type Ctx } from "./service.ts";

export async function seedAll(ctx: Ctx, log: (s: string) => void = () => {}): Promise<void> {
  ctx.store.wipe();
  const now = Date.now();
  for (const l of SEED_LEARNERS) {
    const t0 = Date.now();
    await runScript(ctx, l.id, l.steps, { days: l.days, now: now - 60_000 });
    log(`  seeded ${l.id.padEnd(6)} ${l.steps.filter((s) => s.code).length} submissions  (${Date.now() - t0} ms)`);
  }
}
