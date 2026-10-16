/**
 * The sandbox orchestrator — implements the engine's `Sandbox` port.
 *
 *  • A small pool of WARM runner processes (Pyodide already booted) so a
 *    submission doesn't pay the ~1 s WebAssembly start-up.
 *  • Every submission gets FRESH processes that are thrown away afterwards —
 *    nothing one learner's code does can survive into the next submission.
 *  • Tests run in order; if one times out, the rest are spread across extra
 *    runners so a `while True` program doesn't hold the API for ten seconds.
 *  • Hard limit on concurrent runners; excess work queues instead of
 *    overloading the machine. Nothing in here can throw into a route.
 */
import type { AnalyzeJob, LineMap, RunJob, RunResult, Sandbox, SandboxSession, TraceJob, TraceResult } from "@layerflow/core";
import { RunnerProcess } from "./runner-process.ts";

const WARM = Number(process.env.LAYERFLOW_WARM ?? 3);
const MAX_PROCS = Number(process.env.LAYERFLOW_MAX_RUNNERS ?? 8);
const PARALLEL_AFTER_TIMEOUT = 4;

type Waiter = (p: RunnerProcess) => void;

export class RunnerPool {
  private warm: RunnerProcess[] = [];
  private live = new Set<RunnerProcess>();
  private waiters: Waiter[] = [];
  private stopped = false;
  stats = { spawned: 0, served: 0, killed: 0, bootMs: [] as number[] };

  constructor(private readonly warmTarget = WARM) {}

  start(): void {
    this.refill();
  }

  private failures = 0;
  private backoffUntil = 0;
  private retryTimer: NodeJS.Timeout | null = null;

  /** Spawning can fail at the OS level (EROFS, EMFILE, EAGAIN…). That must never throw into a route or a timer. */
  private spawnOne(): RunnerProcess | null {
    let p: RunnerProcess;
    try {
      p = new RunnerProcess();
    } catch (e) {
      this.failures++;
      const wait = Math.min(10_000, 250 * 2 ** this.failures);
      this.backoffUntil = Date.now() + wait;
      console.error(`[sandbox] could not start a runner (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}) — retrying in ${wait} ms`);
      this.scheduleRefill(wait);
      return null;
    }
    this.stats.spawned++;
    this.live.add(p);
    p.child.on("exit", () => {
      this.live.delete(p);
      this.warm = this.warm.filter((x) => x !== p);
      if (!this.stopped) setImmediate(() => this.refill());
    });
    p.ready
      .then(() => {
        this.failures = 0;
        this.stats.bootMs.push(Date.now() - p.spawnedAt);
        if (this.stats.bootMs.length > 20) this.stats.bootMs.shift();
        this.hand(p);
      })
      .catch(() => p.kill());
    return p;
  }

  private scheduleRefill(ms: number): void {
    if (this.retryTimer || this.stopped) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.refill();
    }, ms);
    this.retryTimer.unref();
  }

  /** Give a freshly-ready process to a waiter, or park it as warm. */
  private hand(p: RunnerProcess): void {
    if (p.dead) return;
    const w = this.waiters.shift();
    if (w) {
      p.busy = true;
      w(p);
    } else this.warm.push(p);
  }

  private refill(): void {
    if (this.stopped) return;
    if (Date.now() < this.backoffUntil) return this.scheduleRefill(this.backoffUntil - Date.now());
    const booting = [...this.live].filter((p) => !p.busy && !this.warm.includes(p)).length;
    const want = this.warmTarget + this.waiters.length - this.warm.length - booting;
    for (let i = 0; i < want && this.live.size < MAX_PROCS; i++) if (!this.spawnOne()) break;
  }

  /** Resolves with a fresh, booted runner — or rejects (HTTP 503) if none can be started in time. Never hangs. */
  acquire(timeoutMs = 45_000): Promise<RunnerProcess> {
    const p = this.warm.shift();
    if (p && !p.dead) {
      p.busy = true;
      this.stats.served++;
      queueMicrotask(() => this.refill());
      return Promise.resolve(p);
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = (x) => {
        clearTimeout(timer);
        this.stats.served++;
        resolve(x);
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(Object.assign(new Error("The sandbox is busy starting up — please submit again in a moment."), { statusCode: 503 }));
      }, timeoutMs);
      this.waiters.push(waiter);
      this.refill();
    });
  }

  release(p: RunnerProcess): void {
    // Never reused: a runner serves exactly one submission, then it is gone.
    p.kill();
    this.stats.killed++;
  }

  status() {
    const avg = this.stats.bootMs.length ? Math.round(this.stats.bootMs.reduce((a, b) => a + b, 0) / this.stats.bootMs.length) : null;
    return { warm: this.warm.length, live: this.live.size, waiting: this.waiters.length, spawned: this.stats.spawned, served: this.stats.served, avg_boot_ms: avg };
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    for (const p of this.live) p.kill();
  }
}

function toRunResult(r: Record<string, unknown>): RunResult {
  const status = (r.status as RunResult["status"]) ?? "killed";
  return {
    status,
    ret: r.ret as RunResult["ret"],
    repr: r.repr as string | undefined,
    stdout: typeof r.stdout === "string" ? r.stdout : "",
    excType: r.excType as string | undefined,
    excMessage: r.excMessage as string | undefined,
    excLine: (r.excLine as number | null | undefined) ?? null,
    killedBy: (r.killedBy as RunResult["killedBy"]) ?? (status === "killed" ? "crash" : undefined),
    policy: (r.policy as string | undefined) ?? undefined,
    mutated: !!r.mutated,
    secondCallDiffers: !!r.secondCallDiffers,
    phase: r.phase as RunResult["phase"],
    ms: Number(r.ms ?? 0),
  };
}

class Session implements SandboxSession {
  private procs: RunnerProcess[] = [];
  private current: RunnerProcess | null = null;
  constructor(private readonly pool: RunnerPool) {}

  private async proc(): Promise<RunnerProcess> {
    if (this.current && !this.current.dead) return this.current;
    this.current = await this.pool.acquire();
    this.procs.push(this.current);
    return this.current;
  }

  private async runOne(p: RunnerProcess, code: string, fn: string, args: unknown, timeoutMs: number): Promise<RunResult> {
    const res = await p.request({ op: "run", code, fn, args: JSON.stringify(args), timeoutMs });
    return toRunResult(res.result);
  }

  async runTests(job: RunJob): Promise<RunResult[]> {
    const out: (RunResult | undefined)[] = new Array(job.tests.length);
    let i = 0;
    for (; i < job.tests.length; i++) {
      const p = await this.proc();
      const r = await this.runOne(p, job.code, job.fn, job.tests[i].args, job.timeoutMs);
      out[i] = r;
      // Loading the file failed → it fails identically for every input (module code can't see the inputs).
      if (r.phase === "module") {
        for (let j = i + 1; j < job.tests.length; j++) out[j] = { ...r };
        return out as RunResult[];
      }
      if (r.killedBy === "wall_clock" || p.dead) {
        i++;
        break;
      }
    }
    if (i < job.tests.length) {
      // A timeout or a hard stop: finish the remaining tests in parallel on fresh runners.
      const rest = Array.from({ length: job.tests.length - i }, (_, k) => i + k);
      const lanes = Array.from({ length: Math.min(PARALLEL_AFTER_TIMEOUT, rest.length) }, () => [] as number[]);
      rest.forEach((idx, k) => lanes[k % lanes.length].push(idx));
      await Promise.all(
        lanes.map(async (lane) => {
          let p: RunnerProcess | null = null;
          for (const idx of lane) {
            if (!p || p.dead) {
              p = await this.pool.acquire();
              this.procs.push(p);
            }
            out[idx] = await this.runOne(p, job.code, job.fn, job.tests[idx].args, job.timeoutMs);
          }
        }),
      );
    }
    return out as RunResult[];
  }

  async analyze(job: AnalyzeJob): Promise<LineMap | null> {
    const p = await this.proc();
    const res = await p.request({ op: "analyze", code: job.code, fn: job.fn, key: job.key, excLines: job.excLines, timeoutMs: 1500 });
    const r = res.result as Partial<LineMap> & { status?: string };
    if (!r || r.status || r.culprit_line === undefined) return null;
    return { culprit_line: r.culprit_line ?? null, confidence: r.confidence ?? "likely", reason: r.reason ?? "", lines: r.lines ?? [] };
  }

  close(): void {
    for (const p of this.procs) this.pool.release(p);
    this.procs = [];
    this.current = null;
  }
}

export class PyodideSandbox implements Sandbox {
  constructor(readonly pool: RunnerPool) {}

  session(): SandboxSession {
    return new Session(this.pool);
  }

  async trace(job: TraceJob): Promise<TraceResult> {
    const p = await this.pool.acquire();
    try {
      const res = await p.request({ op: "trace", code: job.code, fn: job.fn, args: job.args, argsSource: job.argsSource, culpritLine: job.culpritLine ?? null, timeoutMs: 2500 });
      const r = res.result as Partial<TraceResult> & { status?: string; killedBy?: string };
      if (!r || r.status) {
        return { ok: false, call: "", steps: [], error: r?.killedBy === "wall_clock" ? "The replay ran out of time — your code may loop forever on this input." : "The replay stopped unexpectedly.", firstWrongStep: null, truncated: false };
      }
      return { ok: !!r.ok, call: r.call ?? "", steps: r.steps ?? [], result: r.result, error: r.error, firstWrongStep: r.firstWrongStep ?? null, truncated: !!r.truncated };
    } finally {
      this.pool.release(p);
    }
  }
}
