/**
 * Seeds the three pseudonymous demo learners by playing their scripts through
 * the REAL engine and sandbox (no hand-written rows), so what the judges see
 * on the dashboard is exactly what the product computes.
 *
 * rohan  — first visit: no history yet (the first-time experience).
 * riya   — in the middle: the statement's story — two recurring mistakes,
 *          one one-off slip, a non-empty "why this next" reason.
 * khushi — finished every problem on a 12-day streak; with her bug-bounty
 *          finds she has enough points to cash out.
 */
import { SEED_LEARNERS } from "./fixtures.ts";
import { seedBounty } from "./seed-bounty.ts";
import { seedCommunity } from "./seed-community.ts";
import { runScript, type Ctx } from "./service.ts";

export async function seedAll(ctx: Ctx, log: (s: string) => void = () => {}): Promise<void> {
  ctx.store.wipe();
  const now = Date.now();
  for (const l of SEED_LEARNERS) {
    const t0 = Date.now();
    if (l.steps.length) await runScript(ctx, l.id, l.steps, { days: l.days, now: now - 60_000 });
    // steps that happen "today", at the real current time (keeps a streak alive)
    if (l.today?.length) await runScript(ctx, l.id, l.today);
    const n = [...l.steps, ...(l.today ?? [])].filter((s) => s.code).length;
    log(`  seeded ${l.id.padEnd(6)} ${n ? `${n} submissions` : "first visit — no history"}  (${Date.now() - t0} ms)`);
  }
  seedCommunity(ctx.store, now);
  log("  seeded community: 3 teachers, the AI mentor, 12 threads");
  seedBounty(ctx.store, now);
  log("  seeded bug bounty: 2 hosted programs, reports, rewards");
}
