/**
 * T1 — Sandbox red-team (15 pts).
 * The statement's ~15 hostile programs plus 9 extra escape attempts. For EACH:
 *   • no test is ever reported `passed`
 *   • the outcome and the named limit are the honest ones
 *   • no secret reaches the response (a canary env var lives in the API process,
 *     plus host markers: /etc/passwd lines, the API's own paths, the harness source)
 *   • GET /api/health is still 200 — the server never dies
 *   • the very next known-good submission still passes
 */
import os from "node:os";
import { ESCAPE_ATTEMPTS, HOSTILE_PROGRAMS, KNOWN_GOOD, type HostileProgram } from "../packages/core/src/index.ts";
import { CANARY, check, connect, isMain, printSuite, type Check, type SuiteResult } from "./lib.ts";

function secretsIn(raw: string): string | null {
  const markers = [CANARY, "root:x:0:0", "layerflow_dispatch", "_policy_check", os.homedir(), process.cwd(), os.hostname(), process.env.PATH?.split(/[;:]/)[0] ?? "__none__"];
  for (const m of markers) if (m && m.length > 3 && raw.includes(m)) return m;
  return null;
}

async function attack(api: Awaited<ReturnType<typeof connect>>, p: HostileProgram, checks: Check[]): Promise<boolean> {
  const t0 = Date.now();
  const r = await api.post("/api/submit", { learner_id: "harness_redteam", challenge_id: p.challenge, code: p.code });
  const rows = [...(r.body?.visible ?? []), ...(r.body?.hidden ?? [])] as { outcome: string }[];
  const outcomes = rows.map((x) => x.outcome);
  const noPass = r.status === 200 && rows.length > 0 && !outcomes.includes("passed");
  const honest = outcomes.every((o) => (p.outcomes as string[]).includes(o));
  const detail = r.body?.debug?.detail ?? null;
  const detailOk = !p.details || p.details.includes(detail);
  const leak = secretsIn(r.raw);
  const health = await api.get("/api/health");
  const good = await api.post("/api/submit", { learner_id: "harness_redteam_good", challenge_id: KNOWN_GOOD.challenge, code: KNOWN_GOOD.code });
  const goodOk = good.status === 200 && [...good.body.visible, ...good.body.hidden].every((x: { outcome: string }) => x.outcome === "passed");
  const ok = noPass && honest && detailOk && !leak && health.status === 200 && goodOk;
  check(
    checks,
    `#${p.id} ${p.name} [${p.category}] → ${[...new Set(outcomes)].join("/")}${detail ? ` (${detail})` : ""} · ${Date.now() - t0} ms`,
    ok,
    ok
      ? undefined
      : [
          !noPass && "a test was PASSED or the submit failed",
          !honest && `unexpected outcome (allowed ${p.outcomes})`,
          !detailOk && `detail ${detail} not in ${p.details}`,
          leak && `LEAKED ${leak}`,
          health.status !== 200 && "HEALTH DOWN",
          !goodOk && "next good submit did not pass",
        ]
          .filter(Boolean)
          .join("; "),
  );
  return ok;
}

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  let contained = 0;
  for (const p of HOSTILE_PROGRAMS) if (await attack(api, p, checks)) contained++;
  let escapes = 0;
  for (const p of ESCAPE_ATTEMPTS) if (await attack(api, p, checks)) escapes++;
  // Parallel burst: the judges may fire several at once.
  const burst = await Promise.all([HOSTILE_PROGRAMS[5], HOSTILE_PROGRAMS[7], HOSTILE_PROGRAMS[8], HOSTILE_PROGRAMS[10]].map((p) => api.post("/api/submit", { learner_id: "harness_burst", challenge_id: p.challenge, code: p.code })));
  const burstOk = burst.every((r) => r.status === 200 && ![...r.body.visible, ...r.body.hidden].some((x: { outcome: string }) => x.outcome === "passed"));
  check(checks, "4 hostile programs submitted in parallel — all contained", burstOk);
  const health = await api.get("/api/health");
  check(checks, "server healthy after the whole red-team run", health.status === 200 && health.body?.ok === true);
  return {
    suite: "redteam.test.ts — T1 sandbox red-team",
    points: "15 pts",
    checks,
    summary: `${contained}/${HOSTILE_PROGRAMS.length} hostile contained · ${escapes}/${ESCAPE_ATTEMPTS.length} escape attempts contained · server up`,
    ms: Date.now() - t0,
  };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
