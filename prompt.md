# 🧠 prompt.md — THE COMPLETE BUILD SPEC FOR DEBUG DOJO

> **Purpose:** this file is a *build prompt*. Paste it into Claude Code (or feed it to any coding agent) and it contains everything needed to build the entire product end-to-end — every file, every contract, every test.
> **Statement:** DI-01 Debug Dojo · "A coding coach that helps you find the bug without handing you the answer."
> **Scored out of 100 points** (full table in §0).

---

# §0 — MISSION & SCORING

Build a **web practice platform for beginner Python programmers** that:
1. runs learner code **safely**,
2. reports **every test honestly** as exactly one of `passed` / `wrong_output` / `runtime_error` / `timeout`,
3. **explains** failures in plain language without revealing hidden test values,
4. gives a **ladder of ≥3 escalating hints that never contain code and never give the solution**,
5. **detects mistake categories**, tracks which are **recurring across different challenges**, and **chooses the next challenge to fix them — with the reason**,
6. keeps a **mastery estimate per concept** where **a pass without hints counts for more**.

## Scoring — build to these 100 points
| Component | Pts | Requirement |
|---|---|---|
| Sandbox red-team | **15** | ~15 hostile programs all contained, none reported `passed`, **server never dies**, no secret/test file exposed, next normal submission still works |
| Outcome labels + hidden-test secrecy | **15** | 12/12 labels exact; no hidden input / expected output / program output / exception message ever reaches the learner |
| Hint leakage | **10** | Merge all code from all hints into the learner's code → **still fails ≥1 hidden test** |
| Recurring mistakes + skills | **10** | Scripted learner: both planted recurring mistakes named, one-off slips **not** named, next challenge targets a recurring mistake **with a reason**; mastery moves with evidence |
| Explanations + hints | **15** | 2 blind judges rate 5 failures 0–2 on *correct · specific · not giving the answer away* |
| Learning experience | **15** | "Would a struggling beginner use it, and learn rather than copy?" |
| Technical depth + viva | **20** | Must explain **isolation · test harness · hint guardrails · learner model — without notes** |

## Required hand-ins
1. Repo + README + **one command that starts everything**
2. **Live URL or a laptop** with all API endpoints, reachable **from the start of judging**
3. **Mistake taxonomy + how each is detected — on one page**
4. **5-minute demo + viva**

---

# §1 — ENVIRONMENT (verified — do not substitute)

**This machine (macOS) has, verified:**
| Thing | Version |
|---|---|
| Node.js | **v26.10.0** |
| npm | **11.19.1** |
| Python (fallback runner only) | 3.14.3 |
| ngrok | **3.37.2** |
| git + gh CLI | present, authenticated as `Rohit94r` |

## ⛔ HARD PROHIBITIONS — do not use
| Never | Why |
|---|---|
| **Docker / docker-compose** | Not needed, not installed, slows everything down |
| **PostgreSQL / MySQL / MongoDB / Redis / Prisma** | Overkill, and would need installing |
| **`better-sqlite3` / any native DB module** | Requires native compilation — can fail. Use the **built-in `node:sqlite`** instead (see §2.1) |
| **JSON files as the system of record** | Read-modify-write races under the judges' parallel submissions. Fine only as a backup |
| **Kubernetes** | Absurd here |
| **Next.js / React / Vite build step** | Unnecessary complexity + build failures. Plain HTML + ES modules |
| **Judge0 / Piston / nsjail / E2B / CodeSandbox** | External services. Judging self-contained is the whole point |
| **Tailwind / shadcn / MUI** | Not needed; hand-written CSS is fine and faster |
| **Jest / Vitest / Playwright / Cypress** | The harness is plain `tsx` scripts with `node:assert` |
| **Any API key requirement** | The product **must work with zero API keys** (see §9) |
| **`bun`, `pnpm`, `yarn`** | Stick to npm workspaces |

---

# §2 — MONOREPO STRUCTURE (npm workspaces — zero extra tooling)

```
dojo/
├─ package.json                  ← workspaces root, scripts delegate here
├─ tsconfig.base.json
├─ README.md                     ← judges read this: one command, architecture, results
├─ TAXONOMY.md                   ← REQUIRED hand-in #3
├─ docs/
│  ├─ architecture.md            ← the isolation diagram + why
│  ├─ test-harness.md            ← the 6 self-tests, how to run them
│  └─ viva.md                    ← the 4 memorised answers (see §17)
├─ apps/
│  ├─ api/                       ← Fastify server (THE product; holds all scoring)
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ server.ts            ← Fastify bootstrap, static serving, port 3000
│  │     ├─ routes/
│  │     │  ├─ submit.ts         ← POST /api/submit
│  │     │  ├─ hint.ts           ← POST /api/hint
│  │     │  ├─ learner.ts        ← GET  /api/learner/:id
│  │     │  ├─ challenges.ts     ← GET  /api/challenges, /api/challenges/:id
│  │     │  ├─ ledger.ts         ← GET  /api/ledger  (Hint Ledger)
│  │     │  └─ dev.ts            ← GET  /api/dev/reset, /api/dev/seed (judges' page)
│  │     ├─ sandbox/
│  │     │  ├─ orchestrator.ts   ← spawn child, apply limits, timeout, killpg
│  │     │  └─ result.ts         ← typed execution result
│  │     └─ lib/  (guards, logging, ids)
│  ├─ runner/                    ← THE CHILD PROCESS (never runs in the API process)
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ main.ts              ← reads JSON job on stdin → runs → writes JSON result on stdout
│  │     ├─ pyodide-host.ts      ← loads Pyodide, sets up virtual FS
│  │     ├─ inject.py            ← the harness injected into the sandbox (exec learner code)
│  │     └─ analysis.py          ← AST line map (§12 OB1) + execution trace (§12 OB2)
│  └─ web/                       ← frontend, plain HTML + ES modules + GSAP
│     ├─ package.json
│     └─ public/
│        ├─ index.html
│        ├─ challenge.html
│        ├─ dashboard.html
│        ├─ ledger.html
│        ├─ taxonomy.html
│        ├─ judges.html          ← judges' landing page (1-click trials)
│        ├─ css/app.css
│        └─ js/ (app.js, editor.js, anim.js, replay.js, linemap.js, confetti.js)
├─ packages/
│  ├─ core/                      ← shared, NO I/O, fully unit-testable
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ types.ts             ← all shared TS types
│  │     ├─ challenge-bank.ts    ← ALL challenges + hidden tests (§4) — STATIC, never in the DB
│  │     ├─ reference.ts         ← correct reference solutions for the 4 judge challenges
│  │     ├─ classifier.ts        ← outcome labelling (§6)
│  │     ├─ detectors.ts         ← 5 mistake detectors (§7)
│  │     ├─ hints.ts             ← ladder + prose validator (§8)
│  │     ├─ explain.ts           ← deterministic explanations + optional LLM (§9)
│  │     ├─ mastery.ts           ← Beta posterior (§10)
│  │     ├─ recurrence.ts        ← recurring detection + next challenge (§10)
│  │     └─ engine.ts            ← orchestrates submit() end-to-end (no I/O)
│  └─ db/                        ← THE ONLY MODULE THAT TOUCHES SQL
│     ├─ package.json
│     └─ src/
│        ├─ index.ts             ← open db (apps/api/data/dojo.db), PRAGMAs, migrate()
│        ├─ schema.sql           ← exact DDL in §2.1
│        └─ repos/
│           ├─ learners.ts       ← upsert learner, fetch history
│           ├─ submissions.ts    ← insert submission + its test_results (transaction)
│           ├─ hints.ts          ← append hint, get next rung
│           ├─ ledger.ts         ← append prompt/response + rejection counter
│           └─ mastery.ts        ← read/apply α,β per concept
└─ harness/
   ├─ labels.test.ts             ← 12-label corpus  (15 pts)
   ├─ secrecy.test.ts            ← hidden-test leak assertions (15 pts)
   ├─ leakage.test.ts            ← hint-merge test    (10 pts)
   ├─ redteam.test.ts            ← 15 hostile programs(15 pts)
   ├─ learner.test.ts            ← 11-program scripted learner (10 pts)
   ├─ explain.test.ts            ← self-rating helper for blind judge prep (15 pts)
   └─ all.ts                     ← runs every suite, prints a scoreboard
```

## 2.1 THE DATA LAYER — where everything is stored

### Decision: **`node:sqlite`** (SQLite built into Node 26) — *verified working on this machine: 100 parallel writes, zero loss*

| Option | Verdict | Reason |
|---|---|---|
| **`node:sqlite`** | ✅ **USE THIS** | Built into Node 26 · **zero install** · WAL = safe under the judges' parallel submissions · single file · real SQL |
| Neon / Supabase / MongoDB Atlas | ❌ | Need accounts + a live network. **Venue Wi-Fi dies → judges get a dead product → up to 30 points gone at 08:00** |
| `better-sqlite3` | ❌ | Native compilation — can fail mid-event, buys nothing over the built-in |
| PostgreSQL / Redis / MongoDB local | ❌ | Not installed, needs a server process, migration time |
| JSON files as system of record | ⚠️ backup only | Read-modify-write races under parallel submissions |

> **Rule: the system of record is a local file. The product must work with the network cable pulled.**

### File location
```
apps/api/data/dojo.db        ← single SQLite file        (gitignore it)
apps/api/data/dojo.db-wal    ← WAL sidecar               (gitignore it)
apps/api/data/seed/*.json    ← seed fixtures             (committed)
```
Reset for judges = **delete `dojo.db*`, re-run `npm run seed`.** One command, zero drift.

### What is stored vs what is NEVER stored
| ✅ Stored in SQLite | ❌ Never stored anywhere persistent |
|---|---|
| learners (pseudonymous ids only) | **hidden tests** — memory only, inside the API process |
| mastery (α, β per concept) | any hidden test input / expected output / exception message |
| submissions (code, tags, explanation) | any real student data |
| test_results (outcome + limit **name**) | a complete answer key on disk |
| hints (validator-passed prose) | |
| ledger (prompt/response + rejection counter) | |
| bug_seeds (Bug Factory templates) | |

### Exact DDL — `packages/db/src/schema.sql`
```sql
PRAGMA journal_mode = WAL;          -- parallel writes are safe
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;         -- never surface SQLITE_BUSY to the judges

CREATE TABLE learners (
  id         TEXT PRIMARY KEY,      -- pseudonymous: rohan, meera, kabir
  created_at TEXT NOT NULL
);

CREATE TABLE mastery (
  learner_id TEXT NOT NULL,
  concept    TEXT NOT NULL,
  alpha      REAL NOT NULL DEFAULT 1,   -- Beta posterior (see §10.1)
  beta       REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (learner_id, concept)
);

CREATE TABLE submissions (
  id           TEXT PRIMARY KEY,        -- e.g. s_0142
  learner_id   TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  code         TEXT NOT NULL,
  passed       INTEGER NOT NULL,
  mistake_tags TEXT NOT NULL,          -- JSON array of tags
  explanation  TEXT NOT NULL,
  hints_used   INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,
  created_at   TEXT NOT NULL
);

CREATE TABLE test_results (
  submission_id TEXT NOT NULL,
  kind          TEXT NOT NULL,         -- 'visible' | 'hidden'
  test_no       INTEGER NOT NULL,
  outcome       TEXT NOT NULL,         -- passed | wrong_output | runtime_error | timeout
  detail        TEXT,                  -- limit NAME only — NEVER hidden values
  PRIMARY KEY (submission_id, kind, test_no)
);

CREATE TABLE hints (
  submission_id TEXT NOT NULL,
  idx           INTEGER NOT NULL,      -- 1..4
  rung          INTEGER NOT NULL,      -- 1 nudge | 2 specific | 3 mechanism | 4 builtin
  text          TEXT NOT NULL,         -- prose only; passed the §8.1 validator
  created_at    TEXT NOT NULL,
  PRIMARY KEY (submission_id, idx)
);

CREATE TABLE ledger (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ts                TEXT NOT NULL,
  kind              TEXT NOT NULL,     -- 'explanation' | 'hint'
  learner_id        TEXT,
  submission_id     TEXT,
  prompt            TEXT NOT NULL,
  response          TEXT NOT NULL,
  model             TEXT,               -- NULL when the deterministic tier was used
  rejected_for_code INTEGER NOT NULL DEFAULT 0   -- proof the guardrail fired
);

CREATE TABLE bug_seeds (              -- OB3 Bug Factory
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mistake_tag  TEXT NOT NULL,
  buggy_code   TEXT NOT NULL,
  culprit_line INTEGER NOT NULL,
  hint         TEXT NOT NULL,
  difficulty   INTEGER NOT NULL DEFAULT 2
);

CREATE INDEX idx_sub_learner   ON submissions(learner_id, created_at);
CREATE INDEX idx_sub_challenge ON submissions(learner_id, challenge_id);
CREATE INDEX idx_ledger        ON ledger(learner_id);
CREATE INDEX idx_hints_sub     ON hints(submission_id, idx);
```

### 🔒 Two non-negotiable data rules
1. **There is no `challenges` table.** Challenges are static code in `packages/core/challenge-bank.ts`. Hidden tests exist only in the API process's memory.
2. **`test_results.detail` may only ever contain a limit name** (`"memory limit"`, `"output limit"`, `"cpu limit"`, `"process limit"`). A hidden input, expected value, program output or exception message must **never** be written to disk or returned.

### Write discipline
- One **transaction per submission**: the `submissions` row + all `test_results` rows + the mastery update + the ledger entry commit together.
- Write **before** responding, so a judge refreshing mid-slot never sees a ghost.

---

## Root `package.json`
```json
{
  "name": "debug-dojo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch apps/api/src/server.ts",
    "start": "tsx apps/api/src/server.ts",
    "seed": "tsx harness/seed.ts",
    "harness": "tsx harness/all.ts",
    "url": "ngrok http 3000"
  }
}
```
> **One command to start everything = `npm install && npm run seed && npm start`.** That is hand-in #1.

---

# §3 — THE COMPLETE TECH STACK

## 3.1 Layer by layer
| Layer | Technology | Version | Why this one |
|---|---|---|---|
| **Runtime** | Node.js | **26.10.0** (installed) | Already on the machine |
| **Language** | TypeScript, run directly by `tsx` | **5.9.3** / tsx **4.23.15** | **No build step.** `tsc` only for editor types |
| **Monorepo** | **npm workspaces** | built into npm 11.19.1 | Zero extra tooling. No turbo/pnpm |
| **API server** | **Fastify** + `@fastify/static` | **5.12.7** / **10.1.6** | JSON-schema validation validates the judges' exact response shape |
| **Sandbox runtime** | **Pyodide** (CPython → WebAssembly) | **314.0.7** | **No real filesystem + no importable `os`/`socket`** → red-team fails by construction. Assets vendored locally so runtime needs no network |
| **Sandbox isolation** | `child_process.spawn` via `sh -c 'ulimit …'`, `detached:true`, `process.kill(-pid)` | built-in | OS limits + whole-process-group kill. Node has no `setrlimit` |
| **Code analysis (OB1)** | Python `ast` inside the sandbox | stdlib | Locates the culprit line in the learner's own code |
| **Execution trace (OB2)** | Python `sys.settrace` inside the sandbox | stdlib | Per-step variable values for Time-Travel Replay |
| **Database** | **`node:sqlite`** (built-in SQLite) | Node 26 | **Zero install**, WAL-safe under parallel submissions, single file, works offline |
| **Frontend** | **Plain HTML + ES modules + hand-written CSS** | — | No framework, no bundler, no CORS (same origin) |
| **Animation** | **GSAP** + **canvas-confetti** | **3.15.0** / **1.9.4** | Timeline-choreographed, "crazy learning" feel; confetti for the pass moment |
| **Code editor** | `<textarea>` → CodeMirror later | — | Plain box works for pasting; upgrade only for design points |
| **LLM (optional)** | Any API — Anthropic / Gemini / Groq / Ollama | — | *"any model or API is fine"*. **Optional by design** — see §9 |
| **IDs** | `nanoid` | **6.0.2** | Short unique submission ids like `s_0142` |
| **Test harness** | `tsx` scripts + `node:assert` | — | No Jest/Vitest/Playwright needed |
| **Public URL** | **ngrok** | **3.37.2** (installed) | One command, free, instant |
| **Secrets scan** | `gitleaks` | brew | Required before every push |
| **Source control** | git + gh CLI | installed, authed as `Rohit94r` | History is the plagiarism alibi |

## 3.2 Runtime topology — 3 processes
```
┌─────────────── BROWSER (served by the API itself, same origin) ───────────────┐
│  index · challenge · dashboard · ledger · taxonomy · judges                 │
│  GSAP timelines · CodeMirror/textarea · canvas-confetti                     │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │  HTTP (fetch) — no CORS
┌───────────────────────────────▼──────────────────────────────────────────────┐
│  PROCESS 1 — API (Fastify, port 3000)                    ← ALL 100 PTS LIVE  │
│                                                                              │
│  routes/  submit · hint · learner · challenges · ledger · health · dev       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ packages/core  (pure, no I/O, unit-testable)                          │  │
│  │   challenge-bank.ts  ← challenges + HIDDEN TESTS  ██ MEMORY ONLY ██    │  │
│  │   classifier · detectors · hints+validator · explain · mastery        │  │
│  │   recurrence · engine                                                   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────┐   ┌──────────────────────────────────────────┐          │
│  │ packages/db    │   │ sandbox/orchestrator.ts                   │          │
│  │  node:sqlite   │   │  spawn sh -c 'ulimit -v -t -f -u …'     │          │
│  │  dojo.db (WAL) │   │  detached:true, timeout → kill(-pid)     │          │
│  └────────────────┘   └───────────────────┬──────────────────────┘          │
└──────────────────────────────────────────┼───────────────────────────────────┘
                                           │ stdin: {code, input}  ← NO expected value
                                           │ stdout: {stdout, ret, exc, killed_by, ms}
┌──────────────────────────────────────────▼───────────────────────────────────┐
│  PROCESS 2 — RUNNER (child, Pyodide/WebAssembly)                            │
│  virtual FS only · no os/socket importable · rlimits · stdout byte cap      │
│  inject.py (exec learner code) · analysis.py (AST line map + trace)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.3 One submit request, end to end
```
POST /api/submit {learner_id, challenge_id, code}
 1. core.engine.submit()
 2. for each of (3 visible + ≥5 hidden) tests:
      orchestrator.run(code, test.input)      ← input ONLY, expected stays behind
        └─ PROCESS 2: Pyodide executes, returns {stdout, ret, exc, killed_by}
      core.classifier.classify(result, test.expected)   ← parent compares
      core.detectors.detect(...)                        ← mistake tag
 3. core.explain.build(...)                             ← deterministic tier first
 4. core.mastery.apply(...)                             ← α, β per concept
 5. core.recurrence.rollup(...)                         ← ≥2 DISTINCT challenge_ids
 6. db: ONE transaction → submission + test_results + mastery + ledger
 7. return exact JSON shape (§11.1) — hidden[] = {test, outcome} ONLY
```

## 3.4 Verified dependency manifest
```jsonc
// apps/api
"dependencies": { "fastify": "5.12.7", "@fastify/static": "10.1.6", "nanoid": "6.0.2" },
// apps/runner
"dependencies": { "pyodide": "314.0.7" },
// apps/web  (served statically; GSAP is bundled into the served dir by a copy script)
"dependencies": { "gsap": "3.15.0", "canvas-confetti": "1.9.4" },
// root devDependencies
"devDependencies": { "tsx": "4.23.15", "typescript": "5.9.3", "@types/node": "26.6.5" }
```
- **Do NOT upgrade these.** They are the verified-resolving versions.
- `typescript` is pinned to **5.9.3 on purpose** — npm's `latest` is now the v7 native compiler; do not use it.
- **No build step.** `tsx` runs TypeScript directly. `tsc` is only for editor type-checking.
- `apps/web` must copy `node_modules/gsap/dist/gsap.min.js` and `canvas-confetti/dist/confetti.browser.min.js` into `public/vendor/` at postinstall (or serve them from `node_modules` via `@fastify/static` with a second root).

---

# §4 — CHALLENGE BANK

**Minimum: 10 challenges · ≥3 difficulty levels · ≥4 concepts · each ≥3 visible + ≥5 hidden (with edge cases).**

## 4.1 The four judge challenges — EXACTLY as specified

### `last-k-total`
- Signature: `last_k_total(marks, k)`
- Returns: total of the last `k` marks, **or of all marks if `k` is larger than the list**
- Inputs: `marks`: list of ints, **possibly empty**; `k`: int ≥ 0
- Reference: `if k >= len(marks): return sum(marks)` / `return sum(marks[-k:]) if k > 0 else 0`

```python
# STARTER (deliberately buggy — used by judges' example)
def last_k_total(marks, k):
    total = 0
    for i in range(len(marks) - k, len(marks)):
        total += marks[i]
    return total
```
| Kind | Call | Expected | Buggy result |
|---|---|---|---|
| visible 1 | `last_k_total([10, 20, 30, 40], 2)` | `"70"` | passed |
| visible 2 | `last_k_total([5, 5, 5], 3)` | `"15"` | passed |
| visible 3 | `last_k_total([7], 1)` | `"7"` | passed |
| hidden 1 | `last_k_total([1, 2, 3], 2)` | `"5"` | passed |
| hidden 2 | `last_k_total([4, 5, 6, 7], 4)` | `"22"` | passed |
| hidden 3 | `last_k_total([4, 5], 5)` | `"9"` | **runtime_error** (`IndexError`) |
| hidden 4 | `last_k_total([10, 20, 30], 4)` | `"60"` | **wrong_output** (`90`) |
| hidden 5 | `last_k_total([5, 5], 3)` | `"10"` | **wrong_output** (`15`) |
| hidden 6 | `last_k_total([10, 20, 30, 40], 2)` | `"70"` | passed |

> This hidden set reproduces the statement's example outcome pattern exactly: `passed, passed, runtime_error, wrong_output, wrong_output, passed`.

### `count-passes`
- `count_passes(marks)` → how many marks are **≥ 40**; `marks` possibly empty
- Reference: `sum(1 for m in marks if m >= 40)`
- Starter bug: use `> 40` (triggers `boundary_comparison`)
- Visible: `[40, 39, 41]`→`2` · `[10, 20]`→`0` · `[45, 46, 47]`→`3`
- Hidden edge cases: `[]`→`0` · `[40]`→`1` (the boundary) · `[39, 41]`→`1` · `[40,40,40]`→`3` · `[-5, 100]`→`1` · `range(0,100,10)`→`6`

### `first-n-squares`
- `first_n_squares(n)` → `[1, 4, 9, …, n²]`, or `[]` when `n` is 0; `n` ≥ 0
- Reference: `[i*i for i in range(1, n+1)]`
- Starter bug: loop to `n+1` inclusive (off-by-one), and no `n==0` guard
- Visible: `5`→`[1,4,9,16,25]` · `1`→`[1]` · `3`→`[1,4,9]`
- Hidden edge: `0`→`[]` (empty list!) · `2`→`[1,4]` · `10`→`[1,4,…,100]` · `0` with buggy → `[0]` wrong · `1`→`[1]`

### `middle-three`
- `middle_three(items)` → the middle three items, **or the whole list if it has fewer than 3 items**
- Inputs: `items`: list of **odd length**, or with fewer than 3 items
- Reference: `if len(items) < 3: return list(items)` / `mid = len(items)//2` / `return items[mid-1:mid+2]`
- Starter bug: no `< 3` guard (→ `IndexError`/`ValueError`)
- Visible: `[1,2,3,4,5]`→`[2,3,4]` · `[7,8,9]`→`[7,8,9]` · `[1,2,3,4,5,6,7]`→`[3,4,5]`
- Hidden edge: `[]`→`[]` · `[1]`→`[1]` · `[1,2]`→`[1,2]` · `[9,8,7]`→`[8,7]` (middle 3 of 3)

## 4.2 Six more challenges (to reach 10+, 4 concepts, 3 levels)
| id | Concept | Level | Tests the bug |
|---|---|---|---|
| `sum-of-digits` | loops/range | easy | boundary (`n=0`) |
| `count-vowels` | strings | easy | — |
| `grade-letter` | conditionals | easy | `boundary_comparison` |
| `second-largest` | lists | medium | `off_by_one`, empty list |
| `rotate-left` | lists/indexing | medium | `off_by_one` + `unhandled_short_input` |
| `is-leap-year` | boundaries | easy | `boundary_comparison` |

Each needs ≥3 visible + ≥5 hidden including edge cases (empty, zero, negative, single element, oversized parameter).

## 4.3 🔒 THE HIDDEN-TEST RULE (non-negotiable)
- **Hidden tests live ONLY in the API process's memory** (`packages/core/challenge-bank.ts` imported by the API).
- **They are never written to disk**, never included in any HTTP response except as `{test, outcome}`, and never present in the runner's filesystem.
- Expected values are **explicit literals**, not computed by executing a reference solution at request time.
- If you adapt Exercism (MIT) / MBPP (CC BY 4.0) / HumanEval (MIT), **credit it in README + TAXONOMY.md**.

---

# §5 — SANDBOX ARCHITECTURE (15 + 15 points — the foundation)

## 5.1 The parent-memory design ⭐
```
┌────────────── API PROCESS (parent) ──────────────────────────────┐
│  imports challenge-bank.ts → hidden tests (inputs + expected)     │
│  in MEMORY ONLY. Never written to disk.                         │
│                                                                      │
│  for each test:                                                    │
│    spawn runner child ── job {code, input} (NO expected value) ──▶ │
│    ◀────────────── result {stdout, ret, exc, killed_by, ms}        │
│    parent compares result.ret vs expected  ← parent holds truth     │
│    parent labels: passed | wrong_output | runtime_error | timeout   │
└────────────────────────────────────────────────────────────────────┘
```
**The child must be physically incapable of reading an expected value.** This single decision satisfies the red-team, the secrecy test, and the "tricks against the test harness" attacks at once.

## 5.2 Spawning with OS limits
Node has **no built-in `setrlimit`**. Spawn through a shell wrapper:
```ts
const LIMITS = 'ulimit -v 262144; ulimit -t 2; ulimit -f 2048; ulimit -u 64;';
const child = spawn('/bin/sh', ['-c', `${LIMITS} exec tsx apps/runner/src/main.ts`], {
  cwd: RUNNER_DIR, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
  env: { PATH: '/usr/bin:/bin:/opt/homebrew/bin' },   // scrubbed — no secrets
});
```
| Limit | Value | Purpose |
|---|---|---|
| `ulimit -v` | 262144 KB (256 MB) | memory bomb → `runtime_error "memory limit"` |
| `ulimit -t` | 2 s | CPU spin → `runtime_error "cpu limit"` |
| `ulimit -f` | 2048 blocks (≈1 MB) | output/disk flood → `runtime_error "output limit"` |
| `ulimit -u` | 64 | fork bomb → `runtime_error "process limit"` |

## 5.3 Wall-clock timeout + process-group kill
```ts
const timer = setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch {} }, WALL_MS);
// child spawned with detached:true → negative pid kills the WHOLE group
```
`WALL_MS = 2000` for visible tests, `4000` for the trace/replay run.

## 5.4 Inside the runner: Pyodide
- `loadPyodide({ indexURL: <local vendored path> })` — **vendor the Pyodide assets into `apps/runner/public/pyodide/` at install time** so venue Wi-Fi is never needed at runtime. Add a `postinstall` that copies from `node_modules/pyodide/`.
- Because it is WebAssembly, the sandbox has **no real filesystem** — `/etc/passwd`, `os.environ`, `challenge.json` all simply do not exist. `os`/`socket` are **not importable** in a minimal Pyodide build → network and filesystem attacks fail by construction.
- Set `sys.setrecursionlimit` low (e.g. 2000) so recursion bombs become `RecursionError`, not a hang.
- Capture stdout via a custom `sys.stdout` buffer with a **256 KB hard cap**.

## 5.5 Hardening the API process itself
- Every execution wrapped in `try/catch`; **a crash in one submission must never take down the server** (15 red-team points).
- Add a `/api/health` route and make the judges' page poll it.
- Rate-limit nothing (24h demo), but **log every submission** with duration + killed_by.

---

# §6 — CLASSIFIER (part of 15 pts)

```ts
export type Outcome = 'passed' | 'wrong_output' | 'runtime_error' | 'timeout';

function classify(r: RunResult, expected: unknown): { outcome: Outcome; detail?: string }
```
**Decision order (must not race):**
1. `killed_by === 'wall_clock'` → `timeout`
2. `killed_by === 'memory'` → `runtime_error` + detail `"memory limit"`
3. `killed_by === 'output' | 'disk'` → `runtime_error` + `"output limit"` / `"disk limit"`
4. `killed_by === 'cpu'` → `runtime_error` + `"cpu limit"`
5. `killed_by === 'process'` → `runtime_error` + `"process limit"`
6. `exception_type` present → `runtime_error` (expose **only** the learner's own exception class name; never the hidden expected value)
7. deep-equal(result, expected) → `passed`
8. else → `wrong_output`

- Comparison must be **type-aware**: `70 !== "70"` unless the test declares a string. Normalise: if expected is a string, compare `String(actual)`; if a list, compare element-wise with numeric coercion.
- The statement's example shows visible `expected`/`got` as **strings** (`"70"`, `"15"`, `"7"`) — **match that exactly.**
- **Never** put a hidden test's input, expected value, program output, or exception message anywhere in a response.

---

# §7 — DETECTORS (10 pts)

Five categories, **kept distinct**, deterministic (no LLM in the decision path).

| Category | Rule | Notes |
|---|---|---|
| `unhandled_short_input` | learner raised `IndexError`/`ValueError`/`TypeError` **AND** the submitted input is shorter than the challenge's declared minimum length | Classify from **exception type + input shape**, never from expected output |
| `print_not_return` | `stdout` (trimmed) equals `String(expected)` **AND** the return value is `None` | |
| `mutates_input` | run the same input twice in one sandbox session; results differ, **or** the input object changed after the call | |
| `off_by_one` | numeric result differs from expected by exactly **±1** AND the failing input is **not** at a boundary | |
| `boundary_comparison` | numeric result differs by ±1 AND the failing input **is** at an edge (`k === len`, `k > len`, `n === 0`, `len(items) < 3`, empty list) | |

Optional 6th (allowed by the statement): `wrong_index_direction`.

**Rules:**
- A challenge declares `boundaries: (input) => boolean` so the classifier never hard-codes edge logic.
- Return **at most one primary tag per failing submission** (plus optional secondary), or judges may read it as not "kept distinct."
- **Every detector needs a planted-bug unit test** in `packages/core` (pure functions, no I/O → trivially testable).

---

# §8 — HINT LADDER + PROSE VALIDATOR (10 + 15 pts)

## 8.1 The validator — the enforcement that makes T4 mechanical
```ts
const CODE_PATTERNS = [
  /```/, /^\s*def\s/m, /\breturn\b/, /\bimport\b/, /\bfrom\b.*\bimport\b/,
  /[A-Za-z_]\w*\s*\(/,      // any call-like token  e.g. max(
  /==|!=|>=|<=|->/, /^\s*[A-Za-z_]\w*\s*=[^=]/m, // assignment
];
```
**Run this at storage time.** If a generated hint trips any pattern → **reject it, log the rejection, regenerate with stricter instructions.** Never ship a hint that fails the validator.

> Requirement: *"No hint may reveal the complete solution, even when the learner asks for it."*
> The only code-adjacent thing allowed is **naming a builtin in prose** — e.g. *"Python has a built-in that returns the larger of two numbers"* (no `max`, no call syntax). This is taken verbatim from the statement's own example ladder, so it is compliant.

## 8.2 The ladder model
```ts
type Hint = { index: number; rung: 1|2|3|4; text: string; prompt: string; response: string; rejected_for_code?: boolean };
```
- Rung 1 **nudge** → Rung 2 **specific** → Rung 3 **mechanism** → Rung 4 **name a builtin**
- Minimum 3 hints; 4 is the target.
- If the learner says *"give me the answer" / "just tell me" / "solution please"* → **advance one rung, never collapse.**
- Re-submission after hint N resumes at **N+1** (don't repeat).
- Ship the statement's exact 4-rung ladder for `last-k-total` as the reference implementation.

## 8.3 Deterministic base + optional LLM
Hints and explanations **must work with zero API keys** (§9). Ship hand-written per-challenge ladders for the 4 judge challenges; use the LLM only to *fill gaps*, always through the §8.1 validator.

---

# §9 — EXPLANATIONS (15 pts) — MUST WORK WITHOUT ANY API KEY

## 9.1 Two-tier strategy (critical for reliability)
**Tier 1 — deterministic (always available).** Every failure produces a template explanation built from:
`{passed_count} of {n_visible} visible tests pass. {k} of {m} hidden tests fail: {breakdown}. {kind_of_input_sentence}. {mechanism_sentence}.`
- `kind_of_input_sentence` describes the **kind** — *"All three are cases where k is larger than the number of marks."* — **never the values**.
- `mechanism_sentence` is per-challenge and written by you.

**Tier 2 — LLM enhancement (optional).** If `ANTHROPIC_API_KEY` (or any provider key) is present, rewrite the explanation to be warmer and more specific, **then run it through the §8.1 validator** and re-check secrecy (§11.3). If the validator trips, fall back to Tier 1.

> **Why this matters:** if your API key dies at 08:00 on Day 2, a product that *requires* it scores **0 on 15 points**. A product that degrades gracefully keeps them.

## 9.2 Secrecy rules for explanation text (enforced in code)
- Allowed: *"a case where k is larger than the list"*, *"an empty list"*, *"when the list has exactly 3 items"*
- **Forbidden:** any literal from the hidden test's input, expected output, or the program's output on it, and **the hidden exception message**
- Add `assertNoHiddenLeak(text, hiddenCase)` in the submit route — throws in tests, returns the Tier-1 text in production.

## 9.3 Blind-judge quality bar
Judges rate **correct · specific · not-giveaway** on 0–2. Self-rate 5 explanations with your own team before submitting. **Anything averaging <1.5 must be rewritten.** Write a short `explain.test.ts` that prints the 5 rated explanations so you can read them cold.

---

# §10 — MASTERY + RECURRENCE + NEXT CHALLENGE (10 pts)

## 10.1 Mastery (Beta posterior per concept)
```
α = 1, β = 1                        (prior 0.5)
pass, no hints    → α += 1.0
pass, with hints  → α += 0.35       ← the penalty is the point
fail              → β += 0.6
hint given        → β += 0.15
mastery = α / (α + β)
```
Keyed by the challenge's `concepts[]`. Must move **visibly** across a live session (the judges will check "mastery moves with the evidence").

## 10.2 Recurrence — the rule most teams get wrong
```
recurring(tag)  ⟺  the tag appears in ≥ 2 DIFFERENT challenge_id's for that learner
```
- Count **distinct challenge IDs**, not submissions.
- Failing one challenge five times = **one** data point, **not** recurring.
- **One-off slips must never be flagged.**

## 10.3 Next challenge with a reason
```json
{
  "next_challenge": {
    "challenge_id": "rotate-left",
    "reason": "boundary_comparison has now appeared in 2 different challenges. This one is built around the boundary between k and len(items)."
  }
}
```
If nothing is recurring → pick by **weakest concept**; if all strong → pick the next unseen challenge at the learner's level. **The `reason` string must never be empty.**

---

# §11 — HTTP API (hard requirement — reachable from the start of judging)

Base URL: same origin as the web app (`http://localhost:3000`, or the ngrok URL). **The web UI is served by the same Fastify process** so there is no CORS and only one URL to hand judges.

## 11.1 `POST /api/submit`
Request: `{ learner_id: string, challenge_id: string, code: string }`
Response (**exact shape**):
```json
{
  "submission_id": "s_0142",
  "learner_id": "rohan",
  "challenge_id": "last-k-total",
  "visible": [
    { "test": 1, "call": "last_k_total([10, 20, 30, 40], 2)", "expected": "70", "got": "70", "outcome": "passed" },
    { "test": 2, "call": "last_k_total([5, 5, 5], 3)", "expected": "15", "got": "15", "outcome": "passed" },
    { "test": 3, "call": "last_k_total([7], 1)", "expected": "7", "got": "7", "outcome": "passed" }
  ],
  "hidden": [
    { "test": 1, "outcome": "passed" },
    { "test": 2, "outcome": "passed" },
    { "test": 3, "outcome": "runtime_error" },
    { "test": 4, "outcome": "wrong_output" },
    { "test": 5, "outcome": "wrong_output" },
    { "test": 6, "outcome": "passed" }
  ],
  "mistake_tags": ["unhandled_short_input"],
  "explanation": "All 3 visible tests pass, but 3 of the 6 hidden tests fail: one crashes and two give the wrong total. All three are cases where k is larger than the number of marks. Your loop starts at len(marks) - k, which is negative then.",
  "debug": { "culprit_line": 3, "confidence": "likely", "trace_ref": "sub_0142" }
}
```
> 🔑 **`hidden[]` entries contain `test` and `outcome` ONLY.** No `call`, no `expected`, no `got`, no exception message. `debug` is optional and must contain **only the learner's own data**.

## 11.2 `POST /api/hint`
Request: `{ submission_id: string }` → `{ hint_index: number, rung: number, hint: string, remaining: number }`

## 11.3 `GET /api/learner/:learner_id`
```json
{
  "learner_id": "rohan",
  "recurring_mistakes": ["unhandled_short_input", "boundary_comparison"],
  "one_off_mistakes": ["print_not_return"],
  "mastery": { "lists_indexing": 0.61, "loops_range": 0.42, "boundaries": 0.28 },
  "next_challenge": { "challenge_id": "rotate-left", "reason": "boundary_comparison has now appeared in 2 different challenges. This one is built around the boundary between k and len(items)." },
  "history": [ { "challenge_id": "last-k-total", "at": "2026-10-16T19:04:11Z", "tags": ["unhandled_short_input"], "passed": false, "hints_used": 2 } ]
}
```

## 11.4 Other routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/challenges` | list (no hidden tests) |
| GET | `/api/challenges/:id` | description, starter, concepts, **visible tests only** |
| GET | `/api/ledger` | Hint Ledger — every prompt/response + code-rejection count |
| GET | `/api/health` | liveness (the judges' page polls this) |
| GET | `/api/dev/reset` | reset seed data (judges' page button) |
| GET | `/api/taxonomy` | the taxonomy as JSON (feeds `taxonomy.html`) |
| GET | `/` `/challenge` `/dashboard` `/ledger` `/judges` `/taxonomy` | static web pages |

---

# §12 — FRONTEND + ANIMATION (15 pts "Learning experience")

Plain HTML + ES modules + **GSAP 3.15.0** + **canvas-confetti 1.9.4**. No framework, no build.

## 12.1 Pages
| Page | Purpose | Must contain |
|---|---|---|
| `index.html` | challenge list | ≥10 cards with difficulty + concept chips; beginner-friendly copy |
| `challenge.html` | do a challenge | description, starter code, editor, **Submit**, **Hint**, results |
| `dashboard.html` | the learner's arc | mastery bars, history timeline, recurring mistakes, **"why this next"** |
| `ledger.html` | Hint Ledger | every prompt + response, code-rejection counter |
| `taxonomy.html` | taxonomy (hand-in #3) | 5 categories + detection rule + example + test name |
| `judges.html` | **judges' landing page** | the 4 judge challenges as **1-click "Try it"**; a **"Break it"** button with a preset hostile program; links to ledger/taxonomy/isolation diagram |

## 12.2 Animation choreography (the "crazy learning" feel)
Use **GSAP timelines**, not ad-hoc CSS transitions.

| Moment | Animation |
|---|---|
| Page enter | staggered fade-up of cards, `y: 24 → 0`, `stagger: 0.05`, `ease: power3.out` |
| Submit pressed | button morphs to a progress state; a scanning shimmer across the results panel |
| Results reveal | **per-test rows stagger in** (0.04s), each with its outcome badge scaling `0.8 → 1` |
| All tests pass | 🎉 **confetti burst** (canvas-confetti) + a checkmark that **draws itself** (GSAP `strokeDashoffset`) + mastery bar fills with a counting number |
| Failure | gentle **2px horizontal shake** on the row — **never** a red alarm; the copy stays encouraging |
| Hint requested | hint card expands from the hint button (`scale` + `y`), rung number counts up |
| **Line Map** (OB1) | a highlight **sweeps** to the culprit line: `background` flash + a 1px left border that grows down |
| **Replay** (OB2) | step cards fade in one by one as you scrub; the **first wrong step** gets a red pulse |
| Mastery bars | width tween 0→value, 0.8s `power2.out`, number counts up alongside |
| Recurrence reveal | the "why this next" card rotates in (`rotateX`) — the emotional beat of the demo |
| Ledger | rows expand on click with a height tween |

**Copy rules (this is what "learn rather than copy" means):**
- ✅ *"You're close — this is one boundary case."* / *"3 of your visible tests pass. Let's look at one edge case."*
- ❌ *"Wrong."* / *"You failed."* / red walls of text
- Always end a result with a **next action**: `Try again` · `Get a hint` · `See the next problem for you`

## 12.3 The 3 out-of-the-box features (differentiators)
### OB1 · 🗺️ THE LINE MAP — *which question? → "your bug is on line 3"*
- Parse the learner's code with Python's `ast` **inside the sandbox** (`analysis.py`)
- Return `{ culprit_line, confidence: 'likely'|'very likely', reason }`
- Render inline on their code with the GSAP sweep
- Uses **only their own code + the kind of input** — no hidden values (keeps secrecy intact)
- Click a line → jumps to the matching hint rung

### OB2 · ⏱️ TIME-TRAVEL REPLAY — *see the exact moment it breaks*
- Instrument with `sys.settrace` (or a trace hook) **inside the sandbox** during a dedicated replay run
- Capture **local variable values per step**; mark the first step whose value diverges from the learner's own declared intent
- UI: a scrubber timeline, per-step cards, "slow mode" stepping one iteration at a time
- 🔒 **Only their own runtime values — never the expected value.** This is a hard constraint (secrecy test).

### OB3 · 🐛 BUG FACTORY — *find the bug, don't write the code*
- Generate a **deliberately buggy program from the learner's top recurring tag** (a template per category, with a known culprit line)
- Two modes: **Find it** (click the wrong line) and **Fix it** (edit the code)
- Confirms the bug is located, then asks for the repair
- Counts as a real challenge → feeds mastery + recurrence
- Satisfies the statement's *"choose **or generate** the next challenge"*

---

# §13 — SELF-TEST HARNESS (this is what proves your score)

Plain `tsx` scripts + `node:assert`. `npm run harness` runs all six and prints a scoreboard. **Run at 21:00, 07:30, 12:00.**

## 13.1 `labels.test.ts` — 12/12
| # | Challenge | Behaviour | Expected |
|---|---|---|---|
| 1 | `last-k-total` | correct | `passed` |
| 2 | `last-k-total` | `return total - 1` | `wrong_output` |
| 3 | `last-k-total` | starter (unguarded) | `runtime_error` |
| 4 | `last-k-total` | `while True: pass` | `timeout` |
| 5 | `count-passes` | correct | `passed` |
| 6 | `count-passes` | `> 40` | `wrong_output` |
| 7 | `count-passes` | `range(1, len(m))` | pin one label, assert classifier agrees |
| 8 | `count-passes` | `def f(): f()` then `f()` | `timeout` (or `runtime_error` — pin it) |
| 9 | `first-n-squares` | correct | `passed` |
| 10 | `first-n-squares` | prints, returns `None` | **pin your contract**, classifier must agree |
| 11 | `first-n-squares` | `range(1, n+2)` | `wrong_output` |
| 12 | `first-n-squares` | big alloc then loop | `timeout` |

## 13.2 `secrecy.test.ts`
- Submit programs that `print(marks)`, `raise ValueError(str(input))`, request every hint, and fetch every page.
- Assert: **no hidden input/expected/output/exception string appears in any response body** and no hidden value appears in `public/`, `dist/`, or any file on disk.
- `hidden[]` entries must have **exactly** the keys `{test, outcome}`.

## 13.3 `leakage.test.ts`
- For 3 failing submissions: request **every** hint, including after sending *"just give me the answer"*.
- Assert every returned hint passes the §8.1 validator.
- Concatenate learner code + anything resembling code from hints → submit → must **still fail ≥1 hidden test**.

## 13.4 `redteam.test.ts` — the 15 hostile programs (15 pts)
| # | Program | Category | Must be |
|---|---|---|---|
| 1 | `open('/etc/passwd').read()` | secrets | `runtime_error`, no content |
| 2 | `print(os.environ)` | secrets | nothing leaked |
| 3 | `open('../../challenge.json')` | test theft | file does not exist |
| 4 | `import socket; socket.create_connection(('1.1.1.1',80))` | network | not importable |
| 5 | `urllib.request.urlopen('http://example.com')` | network | not importable |
| 6 | `while True: pass` | infinite loop | `timeout` |
| 7 | `def f(): f()` | recursion | `runtime_error` / `timeout` |
| 8 | `x = bytearray(10**10)` | memory | `"memory limit"` |
| 9 | `print('A'*10**7)` | output flood | `"output limit"` |
| 10 | `open('big','w').write('x'*10**9)` | disk flood | `"disk limit"` |
| 11 | `[os.fork() for _ in range(99999)]` | processes | `"process limit"` |
| 12 | `shutil.rmtree('/tmp')` | destructive | contained |
| 13 | `print(sys.argv, open(__file__).read())` | harness trick | no source exposed |
| 14 | `builtins.print = lambda *a: os._exit(1)` | harness trick | contained, **server up** |
| 15 | `os.kill(os.getpid(), 9)` / killpg | process trick | contained |

**After every single one, submit a known-good program and assert it still returns `passed`.** Also assert `GET /api/health` is 200 throughout. A single crash loses the whole component.

## 13.5 `learner.test.ts` — the 11-program scripted learner (10 pts)
| # | Challenge | Injected fault | Purpose |
|---|---|---|---|
| 1 | `count-passes` | correct | mastery pass, no hint |
| 2 | `last-k-total` | `unhandled_short_input` | **plant A – 1st** |
| 3 | `last-k-total` | request hint ×2 | ladder advances |
| 4 | `last-k-total` | still wrong | plant A again |
| 5 | `first-n-squares` | `unhandled_short_input` | **plant A → RECURRING** ✅ |
| 6 | `first-n-squares` | `boundary_comparison` | **plant B – 1st** |
| 7 | `first-n-squares` | hint ×1 | — |
| 8 | `middle-three` | `print_not_return` | **one-off → must NOT be flagged** ⚠️ |
| 9 | `middle-three` | correct | recovery |
| 10 | `last-k-total` | `boundary_comparison` | **plant B → RECURRING** ✅ |
| 11 | `last-k-total` | correct | pass |

Assert on `GET /api/learner/scripted_learner`:
```json
{ "recurring_mistakes": ["unhandled_short_input", "boundary_comparison"],
  "one_off_mistakes": ["print_not_return"],
  "next_challenge": { "challenge_id": "<not empty>", "reason": "<non-empty, names a recurring tag>" } }
```

## 13.6 `explain.test.ts`
Print the 5 rated explanations + the 4 hint ladders in a single screen so the team can **blind-rate them 0–2** before Round 2.

---

# §14 — SEED DATA (must be present before judging starts)

```
learners: rohan (11 submissions, unhandled_short_input ×2 challenges, boundary_comparison ×2),
          meera (5 submissions), kabir (3 submissions, no recurrence yet)
challenges: all ≥10 with the 4 judge challenges included
ledger: entries for every seeded hint + at least one code-rejection entry
```
Seed on first boot automatically (`npm run seed` also works).

**Seeded `rohan` must already show a recurring mistake + a non-empty next-challenge reason** — that is what the judges will look at in the 15-minute slot.

---

# §15 — ONE COMMAND + PUBLIC URL

```bash
npm install          # installs workspaces; postinstall vendors pyodide + gsap + confetti
npm run seed
npm start            # → http://localhost:3000
npm run url          # → ngrok http 3000   (terminal 2)
```
**Hand judges either the ngrok URL or the laptop showing `localhost:3000`.** Statement allows both.
> ⚠️ Keep the laptop **plugged in** and run `caffeinate -i` so it never sleeps. Restart the server in the morning after the overnight lock.

---

# §16 — BUILD ORDER (each phase ends with an acceptance gate)

| Phase | Build | Gate — do not proceed until |
|---|---|---|
| **P0** | Workspaces, root scripts, vendoring, `/api/health` | `npm run start` serves + health 200 |
| **P1** | `core/types.ts` + `challenge-bank.ts` (4 judge challenges exact) + `classifier.ts` | `labels.test.ts` scaffolding runs |
| **P2** | `apps/runner` — Pyodide exec, timeout, limits, killpg | `while True` → timeout; `open('/etc/passwd')` → runtime_error |
| **P3** | `POST /api/submit` end-to-end + exact JSON shape | **12/12 labels** |
| **P4** | `secrecy.test.ts` + `redteam.test.ts` | 15/15 contained, server alive, zero leaks |
| **P5** | `detectors.ts` + `recurrence.ts` + `mastery.ts` + `/api/learner` | `learner.test.ts` → exactly 2 recurring |
| **P6** | `hints.ts` + validator + `/api/hint` + ledger | `leakage.test.ts` → merged code still fails |
| **P7** | `explain.ts` (deterministic) + optional LLM + secrecy assert | `explain.test.ts` → 0 hidden leaks, avg ≥1.5 |
| **P8** | Frontend pages + **GSAP choreography** | a beginner completes a challenge unaided |
| **P9** | **OB1 Line Map** + **OB2 Replay** | both render real data from the sandbox |
| **P10** | **OB3 Bug Factory** | generates a bug from the learner's recurring tag |
| **P11** | `judges.html` + `TAXONOMY.md` + `README.md` + `docs/` | a stranger can run it with one command |
| **P12** | ngrok + laptop fallback + seed | endpoint reachable from a **different device's network** |

**Rehearsal is part of the plan, not an afterthought** — see §17.

---

# §17 — THE VIVA (20 points, *without notes*)
Memorise and rehearse these four. Say each in **under 40 seconds, standing up, no notes.**

### 1️⃣ Isolation
> "Learner code never runs on the host. It runs inside Pyodide — CPython compiled to WebAssembly — inside a child process. Because it's WebAssembly there is no real filesystem, so file and secret attacks fail by construction rather than by filtering, and `os`/`socket` aren't importable. On top of that I apply OS limits through a `ulimit` wrapper — address space, CPU, file size, process count — and kill the whole process group on wall-clock timeout. Two independent layers."

### 2️⃣ Test harness
> "I built the harness before the features, so I run the judges' own checks on myself: fifteen hostile programs that must all be contained with the server staying up; twelve label cases across three challenges that must all be exact; a secrecy assertion that no hidden value appears in any response or on disk; a hint-leakage test where merging all hint code still fails a hidden test; an eleven-program scripted learner that must surface exactly the two planted recurring mistakes; and my team blind-rating five explanations. I run the whole suite at 21:00, 07:30 and 12:00, so I know my score before I present it."

### 3️⃣ Hint guardrails
> "No hint may contain code, and that's enforced rather than requested — a validator inspects every hint at storage time and rejects anything with a fence, a `def`, an assignment, a call, or an import. So 'the AI never gave the answer' is a property the system cannot violate. The ladder escalates — nudge, specific, mechanism, naming a builtin — and if the learner asks directly it still advances one rung instead of collapsing. Every prompt and response is logged, so the guarantee is auditable, not just claimed."

### 4️⃣ Learner model
> "Two parts. Mastery is a Beta posterior per concept: an unhinted pass moves alpha by one, a hinted pass only 0.35, a fail moves beta, and each hint costs a little — which is why an unhinted pass counts for more. Recurrence is counted across different challenge IDs, not across submissions, so failing one problem five times is one data point, not five. And the next challenge is chosen to target the learner's top recurring mistake, with the reason shown — closing the loop from diagnosis to practice."

---

# §18 — GLOBAL DEFINITION OF DONE
- [ ] `npm install && npm run seed && npm start` works on a **clean clone**
- [ ] `npm run harness` → **12/12 labels · 15/15 contained · 2/2 recurring · leakage pass · 0 leaks**
- [ ] `TAXONOMY.md` on one page
- [ ] README: one command, architecture diagram, results table, licences/attribution
- [ ] `gitleaks detect --source .` clean (no secrets anywhere in history)
- [ ] git committed **every 30 minutes** with timestamped messages — history is your alibi
- [ ] Endpoint reachable from a **different device's network** (ngrok)
- [ ] Zero API keys required to demo the full flow
- [ ] The 4 viva answers rehearsed aloud, cold, in under 2 minutes

---

# §19 — ONE-LINE SUMMARY FOR THE BUILD AGENT

> Build a **TypeScript npm-workspaces monorepo**: a **Fastify API** that owns the hidden tests in memory and runs learner Python in a **Pyodide child process** with `ulimit` + process-group kill; a **`packages/core`** with pure, unit-testable logic (classifier, 5 detectors, hint ladder + prose validator, deterministic explanations, Beta mastery, recurrence); a **plain-HTML frontend animated with GSAP + canvas-confetti**; three out-of-the-box features (**Line Map**, **Time-Travel Replay**, **Bug Factory**); and a **six-suite self-test harness** that reproduces the judges' own scoring tests. **No Docker, no database, no build step, no API key required.**

---

> *"Rohan never needed the answer. He needed someone to point him to the right place to look."*
>
> **OB1 points at the place. OB2 shows why. OB3 makes him stop doing it. The hint guardrail makes sure he never gets the answer.**