# 🧠 prompt.md — THE COMPLETE BUILD SPEC FOR DEBUG DOJO (as built)

> **Purpose:** this file is a *build prompt* and the single description of the product. Paste it into a coding agent and it has everything needed to rebuild Debug Dojo end-to-end — every package, file, contract, rule and test. It describes **what is actually in this repository**, and §20 lists every place where the build deliberately differs from the first draft of this spec, with the reason.
> **Statement:** DI-01 Debug Dojo · "A coding coach that helps you find the bug without handing you the answer."
> **Scored out of 100 points** (§0). **Learner language:** Python only.

---

# §0 — MISSION & SCORING

Build a **web practice platform for beginner Python programmers** that:
1. runs learner code **safely**;
2. reports **every test honestly** as exactly one of `passed` / `wrong_output` / `runtime_error` / `timeout`, naming any limit that stopped it;
3. **explains** failures in plain language without revealing hidden test values;
4. gives a **ladder of ≥ 3 escalating hints that never contain code and never give the solution**, even when asked;
5. **detects mistake categories**, tracks which recur **across different challenges**, and **chooses (or generates) the next challenge to fix them — with the reason**;
6. keeps a **mastery estimate per concept** where **a pass without hints counts for more**.

| Component | Pts | How it is judged | Won by (in this repo) |
|---|---|---|---|
| Sandbox red-team | **15** | ~15 hostile programs contained, none `passed`, server never dies, no secret/test file exposed, next normal submission still works | 4-layer sandbox (§5) · `harness/redteam.test.ts` |
| Outcome labels + secrecy | **15** | 12/12 labels; no hidden input / expected / output / exception text reaches the learner | parent-memory design (§5.1) · classifier (§6) · schema-filtered responses · `labels` + `secrecy` suites |
| Hint leakage | **10** | merge all hint code into the learner's code → still fails ≥ 1 hidden test | prose-only validator (§8) · `leakage.test.ts` |
| Recurring + skills | **10** | scripted learner: both planted recurring mistakes named, one-offs not, next challenge targets one with a reason; mastery moves with evidence | detectors (§7) · recurrence + mastery (§10) · `learner.test.ts` |
| Explanations + hints | **15** | 2 blind judges rate 5 failures 0–2 on correct · specific · not-a-giveaway | Tier-1 templates (§9) · hand-written ladders · `explain.test.ts` rating sheet |
| Learning experience | **15** | "Would a struggling beginner use it, and learn rather than copy?" | the web app (§12) · Line Map · Replay · Bug Factory · encouraging copy |
| Technical depth + viva | **20** | explain isolation · test harness · hint guardrails · learner model — without notes | `docs/viva.md` · `docs/architecture.md` |

**Required hand-ins:** (1) repo + README + **one command** → `npm install && npm start`; (2) live URL (`npm run url` → ngrok) or the laptop, all endpoints up from the start of judging; (3) the taxonomy on one page → `TAXONOMY.md` + `/taxonomy`; (4) 5-minute demo + viva → `docs/viva.md`.

---

# §1 — ENVIRONMENT & HARD RULES

| Thing | Requirement | Verified here |
|---|---|---|
| Node.js | **≥ 22.13** (built-in `node:sqlite` without a flag, `--permission`) | v24.13.1 on Windows 11 (the original plan machine was macOS + Node 26 — both work) |
| npm | workspaces (npm 10+) | 11.8 |
| Python | **not needed** — Pyodide ships CPython as WebAssembly via npm | — |
| Internet | only for `npm install`; runtime is fully offline | — |
| ngrok | optional, for a public URL | — |

**Do not use:** Docker · Postgres/MySQL/Mongo/Redis/Prisma · `better-sqlite3` or any native module · JSON files as the system of record · Judge0/Piston/E2B/any external code runner · any **required** API key · pnpm/yarn/bun · Jest/Vitest/Playwright for the harness (plain `tsx` + `node:assert`).

**Do use:** TypeScript run directly by `tsx` (no build step for the backend) · npm workspaces · Fastify · Pyodide · `node:sqlite` · **Next.js 16 + Tailwind 4 + shadcn/ui + motion for the web app, cloned from the team's `icancodefyi/VH26-IMPIC` frontend** (see §12 and §20).

---

# §2 — MONOREPO (npm workspaces)

```
KURUKSHETRA-IMPIC/
├─ package.json                ← workspaces + scripts (start, dev, seed, harness, test:unit, url, typecheck)
├─ tsconfig.base.json · tsconfig.json   (backend type-check only; tsx runs the code)
├─ README.md                   ← judges read this: one command, tour, API, results
├─ TAXONOMY.md                 ← hand-in #3
├─ prompt.md                   ← this file
├─ .env.example                ← everything optional
├─ scripts/start.mjs           ← the one command: build web once → API → wait healthy → web → banner
├─ docs/  architecture.md · test-harness.md · viva.md · EVENT-MANUAL.md (event field manual)
├─ apps/
│  ├─ api/      @dojo/api — Fastify server (THE product's brain)
│  │  └─ src/
│  │     server.ts       boot, first-boot seed, listen :4000, parent-pid watchdog
│  │     app.ts          every route + response schemas + error handler
│  │     service.ts      doSubmit / doHint / runScript — one code path for routes, seed, harness
│  │     context.ts      wires store + sandbox pool + optional LLM
│  │     fixtures.ts     scripted learners (seed + T5 harness)
│  │     seed-data.ts · seed.ts   `npm run seed`
│  │     lib/llm.ts      optional Tier-2 rewriter (@anthropic-ai/sdk)
│  │     sandbox/runner-process.ts   spawn one runner (flags, env, ulimit), request/response, kill
│  │     sandbox/sandbox.ts          warm pool, per-submission sessions, parallel fan-out, backoff
│  ├─ runner/   @dojo/runner — THE CHILD PROCESS (never inside the API process)
│  │  └─ src/
│  │     supervisor.mjs  main thread: NDJSON protocol, wall clock, memory watchdog, terminate
│  │     worker.mjs      worker thread: loads Pyodide, cuts the JS bridge, runs harness.py
│  │     harness.py      the in-sandbox harness: policy, restricted built-ins, run / analyze / trace
│  └─ web/      @dojo/web — Next.js 16 app (cloned design system from VH26-IMPIC)
│     ├─ next.config.ts          rewrites /api/* → http://127.0.0.1:4000 (one origin, no CORS)
│     ├─ app/  layout · page (landing) · practice · challenge/[id] · dashboard · bug-factory · ledger · taxonomy · judges · icon.svg · globals.css
│     ├─ components/  Hero · Navbar · footer · LanguageSwitcher · ThemeToggle · theme-provider · wheel-picker
│     │               landing/ (DashboardPreview, HintWheelBox, AppShowcase, BentoWidgets, landingData)
│     │               app/ (AppShell, CodeEditor, bits)   ui/ (button, card, table, tabs, tooltip, badge, input, globe, animated-list, cta-11)
│     ├─ lib/  api.ts (typed client) · learner.ts (pseudonymous id) · python.ts (highlighter) · i18n/ (en · hi · mr)
│     └─ public/  fonts, trendybg.png, cta.jpeg, video1-3.webm, firstbox.mp4 (from VH26-IMPIC)
├─ packages/
│  ├─ core/     @dojo/core — pure, NO I/O
│  │  └─ src/  types · challenge-bank (hidden tests) · compare · classifier · detectors · hints (+validator)
│  │           explain · secrecy · mastery · recurrence · taxonomy · redteam · public · engine · reference (harness only)
│  │     test/unit.ts
│  └─ db/       @dojo/db — the ONLY module that touches SQL
│     └─ src/  index.ts (DojoStore) · schema.sql
└─ harness/   lib.ts · redteam · labels · secrecy · leakage · learner · explain · all.ts (scoreboard)
```

**Root scripts:** `start` (`node scripts/start.mjs`), `dev` (`--dev`, hot reload), `api`, `web`, `build`, `seed`, `harness`, `test:unit`, `typecheck`, `url` (`ngrok http 3000`).
**Pinned versions:** fastify 5.12.7 · pyodide 314.0.7 · tsx 4.23.15 · typescript **5.9.3** (not 7.x) · @types/node 26.6.5 · @anthropic-ai/sdk 0.135.0 · next **16.2.6** · react/react-dom **19.2.4** (the reference repo's versions) · tailwindcss 4 · motion 13 · shadcn 4 · @number-flow/react · cobe · lucide-react · next-themes · canvas-confetti · @ncdai/react-wheel-picker · @radix-ui/react-tooltip · @base-ui/react.

---

# §3 — RUNTIME TOPOLOGY & ONE SUBMIT

```
Browser ──/api/*──▶ Next.js :3000 ──rewrite──▶ Fastify API :4000
                                                 │ hidden tests in MEMORY only (challenge-bank.ts)
                                                 │ sends {code, fn, args} — INPUTS ONLY
                                                 ▼
                     Runner process (fresh per submission, discarded after)
                     node --permission --allow-fs-read=<runner>,<pyodide> --allow-worker
                     env={} (Windows: SystemRoot only) · cwd = empty temp dir · POSIX: sh -c 'ulimit -t 60; ulimit -f 2048; ulimit -c 0; exec node …' detached
                        ├─ supervisor (main thread): per-job wall clock → interrupt → terminate; RSS watchdog
                        └─ worker thread: Pyodide + harness.py
```

```
POST /api/submit {learner_id, challenge_id, code}
 1 engine.submit()                                     packages/core/src/engine.ts
 2 session.runTests(): visible + hidden in order, 1000 ms each     apps/api/src/sandbox/sandbox.ts
     · a timeout or hard stop → the remaining tests fan out over ≤ 4 fresh runners in parallel
     · a failure while LOADING the file → copied to every test (module code can't see the inputs)
 3 classify() each run against the expected value — in the PARENT
 4 detect() → ≤ 1 primary tag
 5 session.analyze() → Line Map (AST of the learner's code, in the sandbox)
 6 buildExplanation() → findLeak() guard → optional LLM rewrite (must pass the same checks)
 7 store.saveSubmission(): ONE transaction — submission + test_results + mastery deltas + ledger
 8 respond: visible[] with values · hidden[] = {test, outcome} · debug{culprit_line, confidence, reason, trace_ref, passed, detail, headline}
```

A warm pool keeps **3** runners booted (Pyodide takes ~1.1 s to load); `DOJO_MAX_RUNNERS=8` caps concurrency; excess work queues; `acquire()` rejects with HTTP 503 after 45 s instead of hanging; OS spawn failures (EMFILE, EROFS…) are caught and retried with exponential backoff — nothing can throw into a route or a timer.

---

# §4 — CHALLENGE BANK (`packages/core/src/challenge-bank.ts`)

**12 practice challenges · 3 levels · 6 concepts · each 3 visible + 5–7 hidden** (+ 6 Bug Factory templates). Every hidden expected value is an **explicit literal**; `harness/labels.test.ts` proves each one by running `packages/core/src/reference.ts` (correct solutions — imported by the harness only, never by the API) against all tests.

Each challenge declares: `id, title, fn, signature, difficulty, concepts[], description, inputs, starter` (a deliberately buggy beginner attempt), `visible[]`, `hidden[]` (each test: `args`, `expected`, `edge` = the KIND of input, `short` = shorter than the naive solution assumes, optional `alts` = the exact value a specific mistake produces), `edges{kind → {one, many, boundary}}`, `stepRule` (numeric | sum | list | grade | bool | none), `checkInputUnchanged`, `floatResult`, `resultNoun`, `targets[]` + `targetReasons{}`, `mechanisms{}` + `mechanismVariants[]`, `probes{kind → public args}` (replay inputs, never a hidden input), `ladders{}`.

| id | Level | Concepts | Starter bug → tag |
|---|---|---|---|
| `count-passes` ⚖️ | easy | conditionals · boundaries · accumulators | `> 40` → `boundary_comparison` |
| `first-n-squares` ⚖️ | easy | loops_range · boundaries | `range(1, n + 2)` → `off_by_one` |
| `sum-of-digits` | easy | loops_range · accumulators | `while n > 9` → `boundary_comparison` (signature) |
| `count-vowels` | easy | strings · accumulators | lowercase only → generic ("capital vowels") |
| `grade-letter` | easy | conditionals · boundaries | `>` instead of `>=` → `boundary_comparison` |
| `last-k-total` ⚖️ | medium | lists_indexing · loops_range · boundaries | Rohan's loop → `unhandled_short_input` |
| `middle-three` ⚖️ | medium | lists_indexing · boundaries | no `< 3` guard → `unhandled_short_input` |
| `is-leap-year` | medium | conditionals · boundaries | `% 4` only → generic ("whole-century years") |
| `second-largest` | medium | lists_indexing · conditionals | `nums.sort()` → `mutates_input` |
| `rotate-left` | hard | lists_indexing · boundaries | slices don't wrap → `boundary_comparison` |
| `running-max` | hard | accumulators · lists_indexing | `best = 0` → generic ("negative numbers") |
| `unique-in-order` | hard | lists_indexing · accumulators | pops from the caller's list → `mutates_input` |
| `bf-count-at-least` · `bf-first-and-last` · `bf-sum-first-n` · `bf-average` · `bf-sorted-copy` · `bf-last-two` | Bug Factory | one per tag | culprit lines 4 · 2 · 3 · 5 · 2 · 2 |

⚖️ = the four judge challenges, exactly as specified. `last-k-total`'s six hidden tests reproduce the statement's example pattern for the starter: **`passed, passed, runtime_error, wrong_output, wrong_output, passed`**, and the engine reproduces the statement's example explanation **verbatim**.

🔒 **The hidden-test rule:** hidden tests live only in the API process's memory; never in the DB, never in a response except `{test, outcome}`, never sent to the child, never in the web bundle. `publicChallenge()` (`public.ts`) is the only shape of a challenge that leaves the API.

---

# §5 — THE SANDBOX (15 + 15 pts)

## 5.1 Parent-memory design
The API holds the expected values; the child gets `{code, fn, args}` and returns `{status, ret, repr, stdout, excType, excMessage, excLine, killedBy, policy, mutated, secondCallDiffers, phase, ms}`. The parent compares **serialized plain data** (so an object whose `__eq__` always says `True` can't pass), with Python semantics (`3 == 3.0`, `True != 1`).

## 5.2 Layer 1 — `harness.py` (inside Pyodide)
- **AST policy** before execution: rejects attribute names starting with `_` (except `__init__/__name__/__doc__/__str__/__repr__/__len__/__eq__/__lt__`), frame/code attributes (`gi_*`, `cr_*`, `ag_*`, `f_*`, `tb_*`, `co_*`, `mro`, `format_map`), dunder names, underscore match-class attributes, relative imports → `SandboxPolicy` → `runtime_error` + `sandbox policy`.
- **Restricted built-ins** per test (fresh dict): no `eval/exec/compile/getattr/setattr/delattr/vars/globals/locals/dir/help/breakpoint/memoryview`; `open` → in-memory scratch (reads only files this program wrote; 1 MB write quota → `disk limit`); `input` → EOFError.
- **Import allowlist** with **proxy modules** (public, non-module attributes only): `math cmath random itertools collections functools heapq bisect statistics fractions decimal re time datetime`. `os`/`sys` are **stubs** (`environ = {}`, `fork/system/popen…` → `process limit`, `kill/remove/chdir…` → refused, fake `argv`). Everything else → `ImportError` + `sandbox policy`.
- **Capped stdout** 256 KB → `output limit` (a `BaseException`, flag kept even if caught). Recursion limit ~1000 → `recursion limit`. `MemoryError` / index-size `OverflowError` → `memory limit`. `KeyboardInterrupt` → timeout.
- Learner code is loaded fresh **per test** in a new namespace (`__name__ = "__dojo__"`), args deep-copied; mutation check (snapshot vs after) and a second-call check when the first call took < 150 ms.
- Ops: `run` (one test), `analyze` (Line Map), `trace` (Replay).

## 5.3 Layer 2 — WebAssembly (`worker.mjs`)
Pyodide in a **worker thread**: no real filesystem, no fork, no host syscalls. After load: `unregisterJsModule("js")` + `("pyodide_js")`, removed from `sys.modules`; `fetch/WebSocket/EventSource/XMLHttpRequest/Request/BroadcastChannel` removed; `process.kill/dlopen/getBuiltinModule/binding/chdir/abort/setuid/setgid/umask` replaced with throwers. (Pyodide's NODEFS needs `process.binding("constants")`, which `--permission` forbids — the worker hands it `fs.constants` and nothing else.)

## 5.4 Layer 3 — the process (`runner-process.ts`)
`node --permission --allow-fs-read=<apps/runner/src> --allow-fs-read=<node_modules/pyodide> --allow-worker --max-old-space-size=256` — host file reads elsewhere and every child process are `ERR_ACCESS_DENIED` (verified). `env = {}` (Windows: `SystemRoot` only), cwd = fresh temp dir. POSIX adds `ulimit -t 60 -f 2048 -c 0` and `detached: true` → kill with `process.kill(-pid)`. **Not** `ulimit -v` (WebAssembly reserves large virtual ranges — it would stop Node itself) and **not** `-u` (RLIMIT_NPROC is per user and would count the API's own processes); covered by the RSS watchdog and "WebAssembly cannot fork".

## 5.5 Layer 4 — supervision (`supervisor.mjs`, `sandbox.ts`)
Per job: at `timeoutMs` set Pyodide's interrupt buffer (SIGINT → `KeyboardInterrupt`); 400 ms later `worker.terminate()` if Python ignored it → `wall_clock`, process exits. RSS polled every 15 ms: above idle baseline + 320 MB → terminate → `memory`. The API adds a backstop (`timeoutMs + 3 s`) and kills the whole process if the supervisor stops answering. Runners are never reused across submissions. The API's error handler, `unhandledRejection` and `uncaughtException` handlers keep the server up whatever happens.

## 5.6 The 15 hostile programs (`packages/core/src/redteam.ts`) — all contained
`/etc/passwd` → runtime_error (file not in sandbox) · dump `os.environ` → `{}`, wrong_output · `../../challenge.json` → runtime_error · `socket` / `urllib` → sandbox policy · `while True` → timeout · infinite recursion → recursion limit · `bytearray(10**10)` → memory limit · `print('A'*10**7)` → output limit · 1 GB file → memory limit (the string is built first) or disk limit · fork bomb → process limit · `shutil.rmtree` → sandbox policy · `open(__file__)` → sandbox policy · hijack `builtins.print` → sandbox policy · `os.kill(getpid, 9)` → sandbox policy. Plus 9 escapes: `import js`, subclass walk, generator frame walk, `random._os`, `eval`, `getattr` with a string, always-equal object (→ wrong_output), a loop that swallows `KeyboardInterrupt` (→ timeout via terminate), `pyodide.code.run_js`.

---

# §6 — CLASSIFIER (`classifier.ts`)
Fixed order, exactly one label: `wall_clock` → **timeout** · `memory/output/disk/cpu/process/recursion` → **runtime_error** + "<name> limit" · `policy` → runtime_error + "sandbox policy" · runner crash → runtime_error + "sandbox restart" · the learner's code raised → **runtime_error** · `checkInputUnchanged && mutated` → **wrong_output** + "input changed" · equal → **passed** · else **wrong_output**. `detail` is a fixed vocabulary (also a CHECK constraint in SQL). Visible rows show `expected`/`got` as Python reprs (`"70"`, `"[1, 4, 9]"`, `"IndexError: list index out of range"`); hidden rows show nothing but the outcome.

---

# §7 — DETECTORS (`detectors.ts`) — deterministic, ≤ 1 primary tag

| Tag | Rule | Unit test |
|---|---|---|
| `print_not_return` | returned `None` and the call's stdout equals the expected value (numbers compared numerically) | `det_print_not_return` |
| `mutates_input` | args differ from the pre-call snapshot, or a second identical call differs | `det_mutates_input` |
| `unhandled_short_input` | raised `IndexError/ValueError/TypeError/ZeroDivisionError/KeyError` during the call on a test declared `short` | `det_short_input` |
| signature tags | the result equals a test's declared `alts[tag]` on ≥ 2 tests or on every wrong-output test (`wrong_index_direction`, `sum-of-digits`' boundary bug) | `det_wrong_direction` |
| `off_by_one` | one step away (`stepRule`) on at least one **non-boundary** input | `det_off_by_one` |
| `boundary_comparison` | one step away **only** on inputs whose `edge` is a boundary kind | `det_boundary_cmp` |

Priority: `print_not_return › mutates_input › unhandled_short_input › signature › off_by_one/boundary_comparison`. One-step rules: numeric ±1 · sum: ±1 or ± one input element · list: one item missing/extra at an end or the window shifted one place · grade: adjacent letter · bool: flipped · none.

---

# §8 — HINT LADDER + GUARDRAIL (`hints.ts`, `engine.nextHint`)
- Rungs: **1 nudge → 2 specific → 3 mechanism → 4 names a built-in in prose**. Hand-written per challenge and tag (the statement's model ladder verbatim for `last-k-total` / `unhandled_short_input`), generic per-tag ladders as fallback (`unhandled_short_input, print_not_return, mutates_input, off_by_one, boundary_comparison, wrong_index_direction, timeout, crash, generic`).
- **`validateHint(text, {fn})`** rejects: code fences · statement keywords at line start · `def`, `lambda`, imports · `return <expr>` / `: return` · assignments and augmented assignments · `== != <= >= -> < >` · arithmetic between names/numbers · slices · call-like tokens **except** the challenge's own function on literal args (`last_k_total([2, 5], 3)`) · subscripts **except** a literal integer index (`marks[-1]`). The prose word "return" is allowed.
- At storage time every hint is validated **and** leak-checked. From rung 2, the engine drafts a contextual hint quoting the learner's culprit line; the validator rejects it (it contains code), the rejection is logged to the ledger (`model = deterministic:contextual-draft`, `rejected_for_code = 1`), and the safe "Start with line N." version ships.
- "give me the answer" / "just tell me" / "solution please"… → exactly **one** rung up, plus a note. Next submission on the same (learner, challenge, ladder) resumes at the next rung. Each hint costs mastery (β += 0.15).

---

# §9 — EXPLANATIONS (`explain.ts`, `secrecy.ts`)
**Tier 1 (always):** `"{N} of the {n} visible tests pass[, but] {k} of the {m} hidden tests fail: {one crashes and two give the wrong total}. {All three are cases where k is larger than the number of marks.} {mechanism}"` — counts in digits, breakdown in words, the KIND of input from `edges`, a hand-written mechanism (code-pattern variants may quote the learner's own code, e.g. "Your loop starts at len(marks) - k, which is negative then."). Special cases: file fails to load (module phase) · sandbox policy · all pass (with/without hints).
**Secrecy guard:** `findLeak(text, challenge, results, code)` checks every hidden input/expected literal and the learner's outputs/exception messages on hidden tests (ignoring 1-digit numbers, `None/True/False/[]`, and anything already public in the description, visible tests, probes or the learner's own code). A leaking draft never ships.
**Tier 2 (optional):** with `ANTHROPIC_API_KEY`, `apps/api/src/lib/llm.ts` asks `claude-opus-5-5` (effort `low`, `fallbacks: "default"` under beta `server-side-fallback-2026-07-01`, 15 s timeout, typed error handling, refusal → Tier 1) to reword the Tier-1 draft. The model sees only the public task, the learner's code and the safe draft. Its output must pass the validator + leak check, else Tier 1 ships. All prompts/responses go to the ledger.

---

# §10 — MASTERY · RECURRENCE · NEXT CHALLENGE (`mastery.ts`, `recurrence.ts`)
- **Mastery** per concept (Beta): prior α = β = 1 · unhinted pass α += 1.0 · pass with hints since the last pass α += 0.35 · fail β += 0.6 · each hint β += 0.15 · value = α/(α+β). The dashboard replays the evidence into a per-concept timeline.
- **Recurring** ⟺ the tag appears in ≥ 2 **distinct** challenge ids (failing submissions only). `one_off_mistakes` = exactly one challenge.
- **Next challenge:** (1) top recurring tag (most challenges, then most recent) → an unpassed listed challenge whose `targets` include it, preferring ones where it hasn't appeared, unattempted, then easier; Bug Factory template if none; reason = *"{tag} has now appeared in two different challenges (a, b). Next: {title}. {targetReason}"* · (2) weakest touched concept < 60 % · (3) progression at the learner's level · (4) all clear → Bug Factory. Never empty.
- **Bug Factory pick:** the learner's top recurring tag, else most frequent, else `boundary_comparison`; `POST /api/bug-factory/locate` checks the clicked line against `culpritLine`, then the fix is a normal `/api/submit` that feeds mastery and recurrence.

---

# §11 — HTTP API (`apps/api/src/app.ts`)
| Method · route | Body / result |
|---|---|
| `POST /api/submit` | `{learner_id (^[A-Za-z0-9_.-]{2,40}$), challenge_id, code (≤ 20 000)}` → `{submission_id, learner_id, challenge_id, visible[{test, call, expected, got, outcome}], hidden[{test, outcome}], mistake_tags[], explanation, debug{…}}` — **response schema with `additionalProperties: false`** |
| `POST /api/hint` | `{submission_id, message?}` → `{submission_id, hint_index, rung, rung_name, hint, remaining, note?}` |
| `GET /api/learner/:id` | `{learner_id, recurring_mistakes, one_off_mistakes, mastery{concept: 0..1}, next_challenge{challenge_id, reason}, history[{submission_id, challenge_id, at, tags, passed, hints_used}]}` + dashboard extras (`recurring_where, mastery_timeline, streak_days, totals, bug_factory, activity, concept_labels, tag_labels`) |
| `GET /api/learners` | known pseudonyms |
| `GET /api/challenges[?all=1]` · `GET /api/challenges/:id` | summaries · public challenge (visible tests, probes) |
| `GET /api/submissions/:id` | a stored submission (own code, visible results, hidden outcomes, hints, Line Map) |
| `POST /api/replay` | `{submission_id, kind?, args_source?}` → `{ok, call, steps[{step, line, event, locals, note?, flag?}], result?, error?, firstWrongStep, truncated, used_kind, kinds}` |
| `GET /api/bug-factory/:learner[/:challenge]` · `POST /api/bug-factory/locate` | template + reason · `{correct, attempts, message, lesson?}` |
| `GET /api/ledger?learner_id&submission_id&kind&limit` | `{stats{total, hints, explanations, rejected, llm}, entries[]}` |
| `GET /api/taxonomy` · `/api/redteam` · `/api/stats` · `/api/feed` · `/api/health` | taxonomy · hostile corpus · landing numbers · recent submissions · liveness + pool status |
| `GET/POST /api/dev/reset` · `GET /api/dev/seed` | wipe + re-seed demo learners |

Errors: JSON `{error}`; 404 unknown ids; 400 schema; 503 sandbox busy; 500 generic (logged). `cache-control: no-store` everywhere.

---

# §12 — FRONTEND (`apps/web`) — the VH26-IMPIC design, carrying Debug Dojo

**Cloned from `github.com/icancodefyi/VH26-IMPIC/apps/web`:** Next.js 16 App Router, Tailwind 4 + `tw-animate-css` + `shadcn/tailwind.css`, the full `globals.css` (oklch tokens + the dark-mode remap block), fonts (Special Gothic Expanded One · Instrument Serif · Poppins · Inter · Geist Mono), `trendybg.png` hero, `cta.jpeg`, the three stat videos and `firstbox.mp4`, the floating pill navbar with the lime `#bbf451` active state, `ThemeToggle` + `next-themes` (`d` hotkey), the `LanguageSwitcher` + i18n context (English · हिन्दी · मराठी), `NumberFlow`, `cobe` globe, `AnimatedList`, wheel picker, shadcn button/card/table/tabs/tooltip, the pastel bento palette (purple `#7B35F0`, sky `#0586d2`, orange `#c64e27`, green `#359462`), the dark app-mockup frame, the tabbed showcase, CTA-11, the image partner card and the footer. App pages use the reference chat page's shell (white 19rem sidebar, small-caps section labels, translucent 57px header).

| Route | What it does |
|---|---|
| `/` | Landing, section for section like the reference: hero + dark mockup with 4 live tabs (Results — the statement's example · Hint ladder — rung by rung, "give me the answer" moves one · Line Map + Replay · Mastery) · proof stats (15/15 · 12/12 · 0) · bento (safe runs · hint-ladder wheel picker · practice heatmap · live feed · offline globe) · "Inside the dojo" tabs · live submissions table (`/api/feed`) · CTA with live counts · judges' partner card · footer with Rohan's quote |
| `/practice` | 30-second onboarding (pick a level → first challenge), "next for you" with reason, your patterns (recurring vs one-off), filter (all · the 4 judge challenges · level), cards with status |
| `/challenge/[id]` | Task + visible examples · dark editor (highlighted overlay, Tab/auto-indent, Ctrl+Enter, draft saved per learner) · Submit with a scanning sweep · results: headline (never "wrong"), counts, tag badge, visible rows (failing rows shake), hidden chips, "what happened", **Line Map** strip + highlighted line · **hint ladder** (locked rungs blurred, "just tell me the answer") · **Time-Travel Replay** (scrubber, play, step cards, first wrong step pulses, public kinds, own input) · mastery bars with deltas · next challenge with reason · confetti + self-drawing check on a pass. `?submission=` reloads a past result, `?autorun=1` submits the starter, `?fresh=1` resets the draft |
| `/dashboard` | Totals, rotate-in "why this next", mastery bars + timeline, recurring (with where) vs one-off, Bug Factory pick, 12-week heatmap + streak, history linking back to each result |
| `/bug-factory` | Find it (click the wrong line; wrong picks marked) → Fix it (editor + submit) · other templates |
| `/ledger` | Stats incl. guardrail rejections, filters (kind, rejected only, learner, search), expandable prompt/response rows |
| `/taxonomy` | Printable hand-in #3 from `/api/taxonomy` |
| `/judges` | Health, the 4 judge challenges one click each, Break it (all hostile programs + escapes, editable, live checks), Rohan's recurrence story, isolation diagram, curl for the three required endpoints, paper trail, reset |

Copy rules: never "wrong"/"you failed"; always a next action (try again · get a hint · watch it run · next for you). Pseudonymous learners only (`?learner=` or the sidebar picker; stored in `localStorage`).

---

# §13 — SELF-TEST HARNESS (`harness/`, `npm run harness`)
In-process by default (real Fastify via `inject`, real runners, temp DB) or `--url` against a live server. Suites: `redteam` (15 + 9 + parallel burst; canary secret; health + known-good after each) · `labels` (12 pinned + 4 extended; every reference passes) · `secrecy` (snoopers on every challenge; all hints/replays/pages; served files; DB CHECK) · `leakage` (4 failures × 5 hint requests incl. answer requests; merge guarded + inline → still fails; resume; validator rejects code) · `learner` (11-program script; same-challenge ×5; hinted vs unhinted) · `explain` (rating sheet + floor checks). Scoreboard + `harness/results/latest.json`. Unit tests: `packages/core/test/unit.ts` (20 tests). Details: `docs/test-harness.md`.

---

# §14 — DATA (`packages/db/src/schema.sql`, `node:sqlite`)
File `apps/api/data/dojo.db` (+ `-wal`/`-shm`, gitignored). PRAGMAs: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`. Tables: `learners(id, created_at)` · `mastery(learner_id, concept, alpha, beta)` · `submissions(id 's_0001', seq UNIQUE, learner_id, challenge_id, code, passed, mistake_tags JSON, explanation, hints_used, ladder_key, analysis JSON, duration_ms, created_at)` · `test_results(submission_id, kind CHECK visible|hidden, test_no, outcome CHECK 4 labels, detail CHECK fixed vocabulary, got CHECK (kind='visible' OR got IS NULL))` · `hints(submission_id, idx, rung, learner_id, challenge_id, ladder_key, text, asked_for_answer, created_at)` · `ledger(id, ts, kind, learner_id, submission_id, prompt, response, model NULL=deterministic, rejected_for_code)` · `bug_seeds(challenge_id UNIQUE, mistake_tag, buggy_code, culprit_line, hint, difficulty)` · `bug_finds(learner_id, challenge_id, line, correct, created_at)`. **No challenges table.** One transaction per submission and per hint; written before the response.

---

# §15 — SEED (`apps/api/src/fixtures.ts`, auto on first boot, `npm run seed`)
Played through the **real** engine and sandbox, timestamps spread over the last days: **rohan** — the 11-program scripted learner (9 submissions + 3 hints): `unhandled_short_input` in last-k-total + first-n-squares, `boundary_comparison` in first-n-squares + last-k-total (the `while … and i > 0` loop), one-off `print_not_return` on middle-three → next: sum-of-digits with a reason. **meera** — 5 submissions incl. a hinted pass after "just tell me the answer" (still one rung) and `boundary_comparison` in two challenges. **kabir** — 3 submissions, nothing recurring. The ledger contains real guardrail rejections (contextual drafts).

---

# §16 — ONE COMMAND + PUBLIC URL
`npm install && npm start` → `scripts/start.mjs`: checks Node ≥ 22.13 → `next build` if `.next/BUILD_ID` is missing → starts the API (`tsx apps/api/src/server.ts`, seeds on first boot) → waits for `/api/health` → starts `next start -p 3000` with `DOJO_API_URL` → banner with the learner, judges and API URLs. Ctrl+C stops everything (Windows: whole process trees via `taskkill /T`; the API also exits if its launcher disappears). `npm run url` → `ngrok http 3000` — judges get one URL for the app **and** the API.

---

# §17 — BUILD ORDER (with gates)
P0 workspaces + health → P1 core types, bank, classifier → P2 runner (Pyodide + supervisor; `while True` → timeout, `/etc/passwd` → runtime_error) → P3 `/api/submit` exact shape (12/12) → P4 red-team + secrecy (15/15, 0 leaks) → P5 detectors, recurrence, mastery, `/api/learner` (2 recurring) → P6 hints + validator + ledger (merged code still fails) → P7 explanations + leak guard → P8 web app on the VH26-IMPIC design → P9 Line Map + Replay → P10 Bug Factory → P11 judges page, TAXONOMY.md, README, docs → P12 one command, ngrok, seed. Run `npm run harness` at every gate.

---

# §18 — THE VIVA (20 pts) — see `docs/viva.md` for the four answers word for word
Isolation (4 layers + parent-memory) · harness (24 hostile, 12 labels + references, secrecy scan, merge test, scripted learner, rating sheet) · guardrails (validator at storage time, logged rejections, one rung per request) · learner model (Beta, distinct-challenge recurrence, next challenge + reason, Bug Factory).

---

# §19 — DEFINITION OF DONE
- [x] `npm install && npm start` works from a clean clone (no keys, no Docker, no DB server, no Python)
- [x] `npm run harness` all green · `npm run test:unit` 20/20 · `npm run typecheck` clean
- [x] TAXONOMY.md on one page · README with one command, tour, API, architecture, results, credits
- [x] Endpoints reachable on the web origin (proxied) and on :4000
- [x] Seeded rohan shows two recurring mistakes and a non-empty next-challenge reason
- [ ] `gitleaks detect --source .` before every push · commit with timestamped messages · ngrok URL tested from another network · viva rehearsed aloud

---

# §20 — WHERE THE BUILD DIFFERS FROM THE FIRST DRAFT OF THIS SPEC (and why)
| First draft said | Built | Why |
|---|---|---|
| Plain HTML + ES modules + GSAP, served by Fastify | **Next.js 16 + Tailwind 4 + shadcn + motion**, cloned from `icancodefyi/VH26-IMPIC`, proxying `/api` to Fastify | The team asked for the existing VH26-IMPIC frontend and theme, exactly. `motion` (already in that stack) does every choreography beat GSAP was chosen for. One origin is kept via the Next rewrite. |
| `@fastify/static`, `nanoid` | not used | Next serves the web; ids are sequential `s_0001` from SQLite (nicer in a demo, race-free because `node:sqlite` is synchronous). |
| Runner in TypeScript via `tsx` | plain `.mjs` + `harness.py` | spawning `node` directly is faster and runs under `--permission` without a loader. |
| `ulimit -v 262144; -t 2; -f 2048; -u 64` | `ulimit -t 60 -f 2048 -c 0` (POSIX only) + Node `--permission` + RSS watchdog + per-test wall clock | `-v` stops WebAssembly/Node from starting; `-u` is per-user. Windows has no rlimits, so the other layers had to be sufficient on their own. |
| `os`/`socket` "not importable in a minimal Pyodide build" | Verified false (`import js` reached Node's `process`; `socket` objects could be created) → explicit import allowlist, proxies, stubs, JS bridge removal, `--permission` | Tested before building on it. |
| `python3 -I -S` fallback runner | not built | Pyodide is installed with npm and runs offline, so the venue-Wi-Fi risk is gone; a CPython fallback would lack the WebAssembly layer. |
| 12-label table with some unpinned rows; recursion → "timeout or runtime_error" | 4 behaviours × 3 challenges, **every** test pinned; recursion → `runtime_error` (recursion limit) | Python raises RecursionError; pinning per test is stricter than per program. |
| `middle-three` hidden `[9,8,7] → [8,7]` | `[9,8,7] → [9,8,7]` | The middle three of a three-item list is the whole list (draft typo). |
| `boundary_comparison` = "±1 at an edge" | one-step rules per challenge (`stepRule`) + explicit signatures | ±1 alone can't describe sums, lists or grades. |
| Validator rejects every `()`, `=` and "return" | allows the challenge's own function on literals, literal subscripts and the prose word "return" | The statement's own model ladder uses `last_k_total([2, 5], 3)`, `marks[-1]` and "return" — and must ship verbatim. |
| Scripted learner step 10: last-k-total `boundary_comparison` | the `while count < k and i > 0` loop | A real beginner boundary bug that is wrong only when k ≥ len. |
| Node 26 on macOS | Node ≥ 22.13, tested on Windows 11 / Node 24 | Works on the laptops we actually have. |

> *"Rohan never needed the answer. He needed someone to point him to the right place to look."* — The Line Map points at the place. The Replay shows why. The Bug Factory makes him stop doing it. The validator makes sure he never gets the answer.
