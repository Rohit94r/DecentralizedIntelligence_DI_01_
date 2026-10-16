/**
 * The runner process — a disposable child of the API, one per submission.
 *
 * Main thread = supervisor: speaks newline-delimited JSON with the API on
 * stdin/stdout, and polices the worker thread that actually runs Python:
 *   • per-job wall clock → Python KeyboardInterrupt, then worker.terminate()
 *   • memory watchdog    → process RSS above budget → terminate ("memory limit")
 *   • worker crash/exit  → reported, never silent
 * After any hard stop this process exits; the API simply starts a fresh one.
 *
 * Started by the API with: an EMPTY environment, cwd = an empty temp dir,
 * `node --permission --allow-fs-read=<runner + pyodide only> --allow-worker`
 * (no host writes, no child processes), and on POSIX a `ulimit` wrapper.
 */
import { Worker } from "node:worker_threads";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexURL = process.argv[2];
const harnessPath = path.join(here, "harness.py");
const MEM_BUDGET_MB = Number(process.argv[3] || 320);
const GRACE_MS = 400;

const sab = new SharedArrayBuffer(4);
const interrupt = new Int32Array(sab);

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

const worker = new Worker(path.join(here, "worker.mjs"), {
  workerData: { indexURL, sab, harnessPath },
  env: {},
  stdout: true,
  stderr: true,
  resourceLimits: { stackSizeMb: 16 },
});
worker.stdout.resume();
worker.stderr.resume();

let ready = false;
let baseline = 0;
let current = null; // { id, timers, poll }

function finish(msg, fatal) {
  if (current) {
    clearTimeout(current.soft);
    clearTimeout(current.hard);
    clearInterval(current.poll);
    current = null;
  }
  send(msg);
  if (fatal) {
    worker.terminate().catch(() => {});
    setTimeout(() => process.exit(0), 20);
  }
}

function hardStop(killedBy) {
  if (!current) return;
  const id = current.id;
  worker.terminate().catch(() => {});
  finish({ id, fatal: true, result: { status: "killed", killedBy, stdout: "", ms: Date.now() - current.started } }, true);
}

worker.on("message", (m) => {
  if (m.type === "ready") {
    ready = true;
    baseline = process.memoryUsage.rss();
    send({ type: "ready", rss: Math.round(baseline / 1e6) });
    return;
  }
  if (!current || m.id !== current.id) return;
  if (m.fatal) {
    const oom = /memory|OOM|Aborted/i.test(m.error || "");
    finish({ id: m.id, fatal: true, result: { status: "killed", killedBy: oom ? "memory" : "crash", stdout: "", ms: Date.now() - current.started } }, true);
    return;
  }
  let result;
  try {
    result = JSON.parse(m.out);
  } catch {
    result = { status: "killed", killedBy: "crash", stdout: "", ms: 0 };
  }
  finish({ id: m.id, result }, false);
});

worker.on("error", (e) => {
  const oom = /memory|OOM|allocation|Aborted/i.test(String(e && e.message));
  if (current) finish({ id: current.id, fatal: true, result: { status: "killed", killedBy: oom ? "memory" : "crash", stdout: "", ms: 0 } }, true);
  else {
    send({ type: "fatal", error: String(e && e.message).slice(0, 300) });
    process.exit(1);
  }
});

worker.on("exit", () => {
  if (current) finish({ id: current.id, fatal: true, result: { status: "killed", killedBy: "crash", stdout: "", ms: 0 } }, true);
  else process.exit(ready ? 0 : 1);
});

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (!ready || current) {
    send({ id: msg.id, fatal: false, result: { status: "killed", killedBy: "crash", stdout: "", ms: 0 } });
    return;
  }
  const timeout = Math.max(100, Math.min(Number(msg.job.timeoutMs) || 1000, 10000));
  Atomics.store(interrupt, 0, 0);
  current = { id: msg.id, started: Date.now() };
  current.soft = setTimeout(() => Atomics.store(interrupt, 0, 2), timeout); // SIGINT → KeyboardInterrupt in Python
  current.hard = setTimeout(() => hardStop("wall_clock"), timeout + GRACE_MS);
  current.poll = setInterval(() => {
    if (process.memoryUsage.rss() - baseline > MEM_BUDGET_MB * 1e6) hardStop("memory");
  }, 15);
  worker.postMessage({ id: msg.id, job: msg.job });
});
rl.on("close", () => process.exit(0));
