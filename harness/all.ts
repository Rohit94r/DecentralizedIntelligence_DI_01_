/**
 * `npm run harness` — run every self-test and print the scoreboard.
 * The judges' six checks, run on ourselves before they run them on us.
 *
 *   npm run harness                     in-process (real API + real sandbox, temp DB)
 *   npm run harness -- --url http://localhost:3000    against the running product
 *   npm run harness -- --verbose        show every check, not just failures
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connect, printSuite, type SuiteResult } from "./lib.ts";
import * as labels from "./labels.test.ts";
import * as secrecy from "./secrecy.test.ts";
import * as leakage from "./leakage.test.ts";
import * as redteam from "./redteam.test.ts";
import * as learner from "./learner.test.ts";
import * as explain from "./explain.test.ts";
import * as learning from "./learning.test.ts";
import * as rewards from "./rewards.test.ts";

const started = Date.now();
console.log("\nLAYERFLOW — self-test harness");
const api = await connect();
console.log(`   mode: ${api.mode}`);

const { unitResult } = await import("../packages/core/test/unit.ts");

const suites: SuiteResult[] = [];
for (const s of [redteam, labels, secrecy, leakage, learner, explain, learning, rewards]) {
  try {
    const r = await s.run();
    suites.push(r);
    printSuite(r);
  } catch (e) {
    const r: SuiteResult = { suite: String(s), points: "?", checks: [{ name: "suite crashed", ok: false, info: String((e as Error).stack ?? e) }], summary: "CRASHED", ms: 0 };
    suites.push(r);
    printSuite(r);
  }
}

const health = await api.get("/api/health");
console.log("\n╔══════════════════════════════ SCOREBOARD ══════════════════════════════╗");
const row = (name: string, s: SuiteResult | undefined) => {
  if (!s) return;
  const ok = s.checks.every((c) => c.ok);
  console.log(`║ ${ok ? "✅" : "❌"} ${name.padEnd(30)} ${s.summary.slice(0, 38).padEnd(38)} ║`);
};
row("T1 sandbox red-team (15)", suites[0]);
row("T2 outcome labels (15)", suites[1]);
row("T3 hidden-test secrecy (15)", suites[2]);
row("T4 hint leakage (10)", suites[3]);
row("T5 recurring + skills (10)", suites[4]);
row("T6 explanations (15, rated)", suites[5]);
row("T7 mentor·chat·community·repo", suites[6]);
row("T8 streak·points·bounty·pay", suites[7]);
console.log(`║ ${unitResult.failed ? "❌" : "✅"} ${"core unit tests".padEnd(30)} ${`${unitResult.total - unitResult.failed}/${unitResult.total} passed`.padEnd(38)} ║`);
console.log(`║ ${health.status === 200 ? "✅" : "❌"} ${"server alive at the end".padEnd(30)} ${`GET /api/health → ${health.status}`.padEnd(38)} ║`);
console.log("╚════════════════════════════════════════════════════════════════════════╝");
const allOk = suites.every((s) => s.checks.every((c) => c.ok)) && !unitResult.failed && health.status === 200;
console.log(`${allOk ? "ALL GREEN" : "SOME CHECKS FAILED"} in ${((Date.now() - started) / 1000).toFixed(1)} s\n`);

const outDir = path.resolve(import.meta.dirname, "results");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "latest.json"), JSON.stringify({ at: new Date().toISOString(), mode: api.mode, allOk, unit: unitResult, suites }, null, 2));
await api.close();
process.exit(allOk ? 0 : 1);
