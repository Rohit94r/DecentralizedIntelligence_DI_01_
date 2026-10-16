# Architecture — how Debug Dojo runs learner code safely

## Runtime topology

```
┌──────────────────── BROWSER ────────────────────┐
│  Next.js 16 app (apps/web) on :3000             │
│  landing · practice · challenge · dashboard ·   │
│  bug factory · ledger · taxonomy · judges       │
└───────────────────────┬─────────────────────────┘
                        │ same origin: /api/*  →  rewrite (proxy) to :4000
┌───────────────────────▼─────────────────────────────────────────────────┐
│  API PROCESS — Fastify (apps/api) on :4000           ← every scoring rule │
│                                                                          │
│  @dojo/core (pure, no I/O)                                               │
│    challenge-bank.ts  ← 18 challenges + HIDDEN TESTS ██ memory only ██    │
│    classifier · detectors · hints + validator · explain · secrecy        │
│    mastery · recurrence · engine                                         │
│  @dojo/db — node:sqlite, WAL, apps/api/data/dojo.db                     │
│  sandbox/ — warm pool · per-submission sessions · backstop timers         │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ stdin  : {code, fn, args}      ← INPUTS ONLY
                        │ stdout : {status, ret, repr, stdout, excType, …}
┌───────────────────────▼─────────────────────────────────────────────────┐
│  RUNNER PROCESS (apps/runner) — one per submission, then thrown away     │
│  node --permission --allow-fs-read=<runner,pyodide> --allow-worker       │
│  env = {} · cwd = empty temp dir · POSIX: ulimit -t/-f/-c + own pgroup   │
│                                                                          │
│   main thread: SUPERVISOR — protocol, wall clock, memory watchdog       │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │ worker thread: PYODIDE (CPython → WebAssembly) + harness.py       │   │
│   │  AST policy · restricted built-ins · import allowlist (proxies)   │   │
│   │  capped stdout (256 KB) · in-memory scratch "disk" (1 MB)         │   │
│   │  JS bridge (js, pyodide_js) unregistered · fetch/WebSocket removed │   │
│   └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Decision 1 — hidden tests live only in the parent's memory

The hidden tests are static TypeScript literals in `packages/core/src/challenge-bank.ts`, imported by the API process. There is **no challenges table**, no test file on disk at runtime, nothing in the web bundle (the secrecy suite scans `apps/web/.next/static` and `public/`). For each test the API sends the runner **only the code and the input**. The runner reports what the learner's code did; the **parent** compares that with the expected value and assigns the label. A hostile program cannot leak an expected value because it never had one — this one decision covers the red-team, the secrecy test and the "trick the harness" attacks at once.

What leaves the API about a hidden test is `{test, outcome}` — enforced three times:
1. the engine builds hidden rows with only those two fields;
2. the Fastify **response schema** for `/api/submit` lists only `test` and `outcome` for hidden rows (`additionalProperties: false`), so the serializer drops anything else even if a bug put it there;
3. every outgoing text (explanation, hint) passes `findLeak()` — no hidden input, expected value, hidden output or exception message unless that literal is already public.

The database enforces the same rule: `test_results.got` has `CHECK (kind = 'visible' OR got IS NULL)`, and `detail` is a fixed vocabulary of limit names.

## Decision 2 — four independent isolation layers

| Layer | What it stops | Where |
|---|---|---|
| **1 · Python policy** | Dunder / underscore attribute access, frame walking (`gi_frame`, `f_back`…), `eval`/`exec`/`getattr`/`vars`/`globals`, imports outside an allowlist (`math`, `random`, `itertools`, `collections`, `functools`, `heapq`, `bisect`, `statistics`, `fractions`, `decimal`, `re`, `time`, `datetime`), and allowed modules are **proxies** holding public, non-module attributes only (so `random._os`, `re.enum.sys` don't exist). `os`/`sys` are stubs: empty `environ`, `fork` → "process limit", `kill` → refused. `open()` sees only files the program itself wrote, with a 1 MB quota. | `apps/runner/src/harness.py` |
| **2 · WebAssembly** | No real filesystem (`/etc/passwd` doesn't exist), no `fork`, no host syscalls. The Pyodide→JS bridge modules are unregistered and removed from `sys.modules`; `fetch`, `WebSocket`, `process.kill`, `process.binding`, `process.getBuiltinModule` are removed from the worker's globals. | `apps/runner/src/worker.mjs` |
| **3 · The process** | `node --permission`: no fs access except reading the runner's own code and the Pyodide files, no child processes. Empty environment (no API keys, no PATH). Fresh temp cwd. On POSIX: `ulimit -t 60 -f 2048 -c 0` and a detached process group (killed with `kill(-pid)`). | `apps/api/src/sandbox/runner-process.ts` |
| **4 · Supervision** | Per-test wall clock → Python `KeyboardInterrupt` through Pyodide's interrupt buffer, then `worker.terminate()` after 400 ms if ignored. Memory watchdog: RSS above the idle baseline + 320 MB → terminate ("memory limit"). The API keeps a backstop timer per request and kills the whole process if the supervisor ever stops answering. Every submission gets fresh runners that are discarded afterwards. | `apps/runner/src/supervisor.mjs`, `apps/api/src/sandbox/*` |

Why not `ulimit -v` / `-u`? WebAssembly reserves large virtual address ranges, so an address-space cap stops Node itself; and `RLIMIT_NPROC` is per user, so it would also count the API's own processes. Both concerns are covered elsewhere (the RSS watchdog, and WebAssembly cannot fork). Windows has no `setrlimit` at all; layers 1–4 apply unchanged.

## One submit, end to end

```
POST /api/submit {learner_id, challenge_id, code}
 1. engine.submit()                          packages/core/src/engine.ts
 2. sandbox session: 3 visible + 5–7 hidden tests, in order   (inputs only)
      timeout on a test → remaining tests fan out over fresh runners in parallel
      module-level failure → same result for every test (module code can't see inputs)
 3. classify() each — the parent holds the expected values    classifier.ts
 4. detect() → at most one primary mistake tag                detectors.ts
 5. analyze() in the sandbox → Line Map culprit line (AST of their own code)
 6. buildExplanation() (Tier 1) → optional LLM rewrite only if it passes the checks
 7. ONE SQLite transaction: submission + test_results + mastery + ledger
 8. response: visible[] with values · hidden[] = {test, outcome} only · debug{culprit_line…}
```

## The learner model

- **Mastery** per concept is a Beta posterior (α = β = 1 prior; unhinted pass α += 1, hinted pass α += 0.35, fail β += 0.6, each hint β += 0.15). Shown on the dashboard with a timeline replayed from the evidence.
- **Recurrence** counts distinct challenge ids per tag; ≥ 2 → recurring, 1 → one-off.
- **Next challenge** targets the top recurring tag (with the reason), else the weakest touched concept, else progression. The **Bug Factory** generates a buggy program from the top tag.

## Hint guardrail

`validateHint()` (`packages/core/src/hints.ts`) rejects fences, statement keywords at line start, `def`, `lambda`, imports, `return <expr>`, assignments, comparison operators, arithmetic between names, slices, call-like tokens (except the challenge's own function on literal arguments — the statement's own rung 2) and subscripts other than a literal index (`marks[-1]`, also from the statement). Every hint is validated at storage time; contextual drafts that quote the learner's line are rejected by it and logged, and the prose version ships instead. Asking for the answer advances exactly one rung. The next submission on the same mistake resumes at the next rung.

## Data

`node:sqlite` (built into Node ≥ 22.13) — no install, no native build, WAL so parallel judges never block, `busy_timeout` so `SQLITE_BUSY` never surfaces, one file you can delete to reset. Schema: `packages/db/src/schema.sql`.
