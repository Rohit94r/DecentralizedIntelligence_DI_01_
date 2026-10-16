/**
 * One sandbox child process (apps/runner/src/supervisor.mjs).
 *
 * How it is started — every flag here is part of the isolation story:
 *   node --permission                   Node's permission model: no fs access
 *        --allow-fs-read=<runner dir>    …except reading its own code
 *        --allow-fs-read=<pyodide dir>   …and the Pyodide runtime files
 *        --allow-worker                  (it runs Python in a worker thread)
 *   env = {}                            no secrets, no API keys, no PATH
 *   cwd = a fresh empty temp dir
 *   POSIX: sh -c 'ulimit -t … -f … -c 0; exec node …'   + its own process group
 *
 * The API never trusts it: every request has a wall-clock backstop, and on
 * any hard stop the process is killed (whole group on POSIX) and replaced.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNNER_DIR = path.resolve(here, "../../../runner/src");
const require = createRequire(path.join(RUNNER_DIR, "..", "package.json"));
const PYODIDE_DIR = path.dirname(require.resolve("pyodide/package.json"));
const IS_WIN = process.platform === "win32";
const MEM_BUDGET_MB = Number(process.env.DOJO_MEM_MB ?? 320);
const READY_TIMEOUT_MS = 30_000;

export interface RunnerResponse {
  fatal?: boolean;
  result: Record<string, unknown>;
}

let nextId = 1;

export class RunnerProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly ready: Promise<void>;
  readonly spawnedAt = Date.now();
  dead = false;
  busy = false;
  private pending = new Map<number, { resolve: (r: RunnerResponse) => void; timer: NodeJS.Timeout }>();
  private tmp: string;

  constructor() {
    this.tmp = mkdtempSync(path.join(os.tmpdir(), "dojo-run-"));
    const nodeArgs = [
      "--permission",
      `--allow-fs-read=${RUNNER_DIR}`,
      `--allow-fs-read=${PYODIDE_DIR}`,
      "--allow-worker",
      "--disable-warning=SecurityWarning",
      "--disable-warning=ExperimentalWarning",
      "--max-old-space-size=256",
      path.join(RUNNER_DIR, "supervisor.mjs"),
      PYODIDE_DIR,
      String(MEM_BUDGET_MB),
    ];
    try {
      this.child = this.launch(nodeArgs);
    } catch (e) {
      rmSync(this.tmp, { recursive: true, force: true });
      throw e;
    }
    this.child.stderr.resume();
    const rl = createInterface({ input: this.child.stdout });

    let readyResolve!: () => void;
    let readyReject!: (e: Error) => void;
    this.ready = new Promise<void>((res, rej) => {
      readyResolve = res;
      readyReject = rej;
    });
    this.ready.catch(() => {});
    const readyTimer = setTimeout(() => {
      readyReject(new Error("runner did not become ready"));
      this.kill();
    }, READY_TIMEOUT_MS);

    rl.on("line", (line) => {
      let msg: { type?: string; id?: number; fatal?: boolean; result?: Record<string, unknown>; error?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        return; // anything that isn't our protocol is ignored
      }
      if (msg.type === "ready") {
        clearTimeout(readyTimer);
        readyResolve();
        return;
      }
      if (msg.type === "fatal") {
        clearTimeout(readyTimer);
        readyReject(new Error(msg.error ?? "runner failed to start"));
        return;
      }
      if (typeof msg.id !== "number") return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      if (msg.fatal) this.dead = true;
      p.resolve({ fatal: msg.fatal, result: msg.result ?? { status: "killed", killedBy: "crash" } });
    });

    this.child.on("exit", () => {
      this.dead = true;
      clearTimeout(readyTimer);
      readyReject(new Error("runner exited"));
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.resolve({ fatal: true, result: { status: "killed", killedBy: "crash", stdout: "", ms: 0 } });
      }
      this.pending.clear();
      try {
        rmSync(this.tmp, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    });
    this.child.on("error", () => {
      this.dead = true;
    });
    this.child.stdin.on("error", () => {
      this.dead = true;
    });
  }

  private launch(nodeArgs: string[]): ChildProcessWithoutNullStreams {
    if (IS_WIN) {
      // Windows has no setrlimit; the permission model, the memory watchdog and
      // the kill-on-timeout carry the load. SystemRoot is required by the OS loader.
      return spawn(process.execPath, nodeArgs, {
        cwd: this.tmp,
        env: { SystemRoot: process.env.SystemRoot ?? "C:\\Windows" },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } else {
      const quoted = [process.execPath, ...nodeArgs].map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
      // -t CPU seconds (whole runner, incl. Pyodide boot) · -f max file size · -c no core dumps.
      // Not -v: WebAssembly reserves large virtual ranges, so an address-space cap would stop Node itself.
      // Not -u: RLIMIT_NPROC is per-USER, so it would also count the API's own processes. WebAssembly can't fork anyway.
      return spawn("/bin/sh", ["-c", `ulimit -t 60; ulimit -f 2048; ulimit -c 0; exec ${quoted}`], {
        cwd: this.tmp,
        env: {},
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
      });
    }
  }

  /** Send one job. Resolves with the result — never rejects, never hangs. */
  request(job: Record<string, unknown> & { timeoutMs: number }): Promise<RunnerResponse> {
    if (this.dead) return Promise.resolve({ fatal: true, result: { status: "killed", killedBy: "crash", stdout: "", ms: 0 } });
    const id = nextId++;
    return new Promise((resolve) => {
      // Backstop: if the supervisor itself stops answering, kill the whole process.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.kill();
        resolve({ fatal: true, result: { status: "killed", killedBy: "wall_clock", stdout: "", ms: job.timeoutMs } });
      }, job.timeoutMs + 3000);
      this.pending.set(id, { resolve, timer });
      try {
        this.child.stdin.write(JSON.stringify({ id, job }) + "\n");
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        this.dead = true;
        resolve({ fatal: true, result: { status: "killed", killedBy: "crash", stdout: "", ms: 0 } });
      }
    });
  }

  kill(): void {
    this.dead = true;
    const pid = this.child.pid;
    if (!pid) return;
    try {
      if (IS_WIN) this.child.kill("SIGKILL");
      else process.kill(-pid, "SIGKILL"); // the whole process group
    } catch {
      try {
        this.child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

export const runnerPaths = { RUNNER_DIR, PYODIDE_DIR };
