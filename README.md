# 🥋 Debug Dojo

**A coding coach that helps you find the bug without handing you the answer.**
DI-01 · Decentralized Intelligence · Kurukshetra 2026 · learner language: **Python**

Debug Dojo runs a beginner's Python **safely**, labels every test honestly (`passed` / `wrong_output` / `runtime_error` / `timeout`), explains failures in plain language **without revealing hidden tests**, gives a **hint ladder that never contains code**, detects which **mistakes recur across different challenges**, picks the **next challenge to fix them — with the reason**, and tracks **mastery per concept** where a pass without hints counts for more.

---

## One command

```bash
npm install && npm start
```

Then open **http://localhost:3000** (learners) and **http://localhost:3000/judges** (judges).
Requirements: **Node 22.13+** (uses the built-in `node:sqlite` and `--permission`). No Docker, no database server, no Python install, **no API key**, no internet at runtime.

- First run builds the web app once (~1 min) and seeds three pseudonymous demo learners (`rohan`, `meera`, `kabir`) by running their scripts through the real sandbox.
- `npm run dev` — the same with hot reload · `npm run url` — public URL via `ngrok http 3000`
- `npm run seed` — reset the demo data · `npm run harness` — run the judges' checks on ourselves

## For the judges — a 15-minute tour

| Where | What you can verify |
|---|---|
| **`/judges`** | The 4 judge challenges as one-click **Try it** · **Break it**: run any of the 15 hostile programs (+ 9 escape attempts) live and watch it contained, the server stay up and the next good submission pass · Rohan's recurrence story · the isolation diagram · copy-paste `curl` for every endpoint · reset button |
| **`/challenge/last-k-total`** | The statement's own example: Rohan's starter → 3/3 visible, hidden `passed, passed, runtime_error, wrong_output, wrong_output, passed`, tag `unhandled_short_input`, the explanation word for word, the **Line Map** on line 3, the hint ladder (ask for the answer — still one rung), the **Time-Travel Replay** |
| **`/dashboard?learner=rohan`** | Two recurring mistakes, one one-off slip, mastery bars + timeline, “why this next” with its reason, history |
| **`/ledger`** | Every prompt and response, and the guardrail's **rejection** count (drafts that quoted code — logged, never shown) |
| **`/taxonomy`** | Hand-in #3 — also [TAXONOMY.md](TAXONOMY.md) |
| **`/bug-factory`** | A buggy program generated from the learner's top mistake: find the line, then fix it |

## The API (same origin — `http://localhost:3000/api/*`, also `:4000` directly)

```bash
curl -s localhost:3000/api/submit -H 'content-type: application/json' \
  -d '{"learner_id":"rohan","challenge_id":"last-k-total","code":"def last_k_total(marks, k):\n    total = 0\n    for i in range(len(marks) - k, len(marks)):\n        total += marks[i]\n    return total\n"}'
```

```json
{
  "submission_id": "s_0020",
  "learner_id": "rohan",
  "challenge_id": "last-k-total",
  "visible": [
    { "test": 1, "call": "last_k_total([10, 20, 30, 40], 2)", "expected": "70", "got": "70", "outcome": "passed" },
    { "test": 2, "call": "last_k_total([5, 5, 5], 3)", "expected": "15", "got": "15", "outcome": "passed" },
    { "test": 3, "call": "last_k_total([7], 1)", "expected": "7", "got": "7", "outcome": "passed" }
  ],
  "hidden": [
    { "test": 1, "outcome": "passed" }, { "test": 2, "outcome": "passed" }, { "test": 3, "outcome": "runtime_error" },
    { "test": 4, "outcome": "wrong_output" }, { "test": 5, "outcome": "wrong_output" }, { "test": 6, "outcome": "passed" }
  ],
  "mistake_tags": ["unhandled_short_input"],
  "explanation": "All 3 visible tests pass, but 3 of the 6 hidden tests fail: one crashes and two give the wrong total. All three are cases where k is larger than the number of marks. Your loop starts at len(marks) - k, which is negative then.",
  "debug": { "culprit_line": 3, "confidence": "very likely", "reason": "This range can start below zero when the input is shorter than your code expects.", "trace_ref": "s_0020", "passed": false, "detail": null, "headline": "Your examples work. A few hidden cases don't — let's look at what they have in common." }
}
```

| Method · route | Purpose |
|---|---|
| `POST /api/submit` `{learner_id, challenge_id, code}` | Run + label + tag + explain. **`hidden[]` is `{test, outcome}` only** (schema-enforced). |
| `POST /api/hint` `{submission_id, message?}` | Next rung: `{hint_index, rung, hint, remaining, note?}` — prose only; "give me the answer" still moves one rung |
| `GET /api/learner/:id` | `{recurring_mistakes, one_off_mistakes, mastery, next_challenge{challenge_id, reason}, history, …}` |
| `GET /api/challenges` · `/api/challenges/:id` | The bank — visible tests only |
| `POST /api/replay` `{submission_id, kind?, args_source?}` | Time-Travel Replay on a public input (or one the learner types) |
| `GET /api/bug-factory/:learner` · `POST /api/bug-factory/locate` | Bug Factory |
| `GET /api/ledger` · `/api/taxonomy` · `/api/redteam` · `/api/stats` · `/api/feed` · `/api/health` | Ledger, taxonomy, hostile corpus, landing numbers, liveness |
| `GET/POST /api/dev/reset` | Re-seed the demo learners |

## How it works

```
Browser ──/api/*──▶ Next.js (:3000) ──proxy──▶ Fastify API (:4000) ── hidden tests in MEMORY only
                                                   │  sends code + INPUTS only (never an expected value)
                                                   ▼
                                     Runner process — fresh per submission, then discarded
                                     node --permission · env = {} · empty temp cwd · (POSIX: ulimit + pgroup)
                                        ├─ supervisor thread: wall clock → interrupt → terminate · memory watchdog
                                        └─ worker thread: Pyodide (CPython → WebAssembly) + harness.py
                                             AST policy · restricted built-ins · import allowlist · 256 KB stdout · 1 MB scratch disk
```

- **Isolation, four layers:** Python policy → WebAssembly (no filesystem, no fork, JS bridge cut) → Node permission model + empty env → supervision (timeouts, memory, disposable processes). Details: [docs/architecture.md](docs/architecture.md).
- **Hidden-test secrecy by construction:** the child never receives an expected value; responses are schema-filtered; every outgoing text passes a leak check; the DB has a CHECK constraint that refuses to store output for a hidden test.
- **Deterministic diagnosis:** five detectors + the optional sixth, one primary tag per failure — [TAXONOMY.md](TAXONOMY.md).
- **Hints:** hand-written ladders (the statement's own ladder for `last-k-total`, verbatim) + a validator that rejects code at storage time.
- **Learner model:** Beta mastery per concept; recurrence across *distinct* challenges; next challenge with a reason; Bug Factory generation.
- **Three extras:** 🗺️ **Line Map** (AST of the learner's code → the culprit line) · ⏱️ **Time-Travel Replay** (`sys.settrace` on a public input, first wrong step flagged) · 🐛 **Bug Factory** (find the bug, then fix it).

## Self-test results — `npm run harness`

<!-- harness-results -->
| Check | Result |
|---|---|
| T1 sandbox red-team | **15/15** hostile programs contained · **9/9** extra escape attempts · server up throughout · next good submit passes after each |
| T2 outcome labels | **12/12** labels exact (every visible + hidden label pinned) · 4/4 extended contracts · 18/18 reference solutions pass their own tests |
| T3 hidden-test secrecy | **0** leaks across every response, the client bundle and the DB · hidden rows exactly `{test, outcome}` |
| T4 hint leakage | **4/4** merged programs still fail a hidden test · **0** hints with code · one rung per request |
| T5 recurring + skills | exactly the 2 planted mistakes recurring · one-off not flagged · reason names the tag · mastery moves with evidence |
| T6 explanations | 5 explanations + 4 ladders printed for blind rating; automated floor checks pass |
| Core unit tests | **20/20** (a planted-bug test per detector, classifier order, validator, bank self-check) |

## Repository

```
apps/
  api/      Fastify API — routes, sandbox pool, seed, optional LLM tier
  runner/   the sandbox child: supervisor.mjs · worker.mjs (Pyodide) · harness.py
  web/      Next.js 16 + Tailwind 4 + shadcn/ui + motion — landing + 7 app pages, en/हिन्दी/मराठी, light/dark
packages/
  core/     pure logic: challenge bank (hidden tests), classifier, detectors, hints + validator,
            explanations, secrecy, mastery, recurrence, engine · test/unit.ts
  db/       node:sqlite store — schema.sql (WAL, CHECK constraints)
harness/    the six judge suites + all.ts scoreboard
docs/       architecture · test-harness · viva · EVENT-MANUAL (the event field manual)
TAXONOMY.md hand-in #3 · prompt.md the full build spec · dojo.md / features.md / README-TRACK.md planning docs
```

**Stack:** Node 22.13+ · TypeScript run directly by `tsx` · npm workspaces · Fastify 5 · Pyodide 314 (CPython 3.14 → WebAssembly) · `node:sqlite` · Next.js 16 · React 19 · Tailwind CSS 4 · shadcn/ui · motion · NumberFlow · cobe · canvas-confetti. Optional: `@anthropic-ai/sdk` (Tier-2 polish, off without `ANTHROPIC_API_KEY`).

## Optional LLM tier

The product is complete with **zero API keys** — every explanation and hint has a deterministic Tier 1. If `ANTHROPIC_API_KEY` is set, explanations and hints may be reworded by `claude-opus-5-5` (configurable with `DOJO_LLM_MODEL`); the model only ever sees the public task, the learner's own code and the already-safe Tier-1 draft, and its text must pass the same validator and leak check or Tier 1 ships. Every prompt and response is logged in the Hint Ledger. See [.env.example](.env.example).

## Data & privacy

Pseudonymous learner ids only (`rohan`, `meera`, `kabir`, or any nickname) — no accounts, no real student data. One SQLite file at `apps/api/data/dojo.db` (gitignored); delete it or run `npm run seed` to reset.

## Credits

All 18 challenges, their hidden tests and every hint are original to this project — no Exercism / MBPP / HumanEval content was adapted. The web app's design system, landing-page structure, illustrations, videos and fonts come from our team's [VH26-IMPIC](https://github.com/icancodefyi/VH26-IMPIC) frontend.
