# Layerflow

**A coding coach that helps you find the bug without handing you the answer.**
Built for problem statement **DI-01 · Debug Dojo** · Decentralized Intelligence · Kurukshetra 2026 · learner language: **Python**

Layerflow runs a beginner's Python **safely**, labels every test honestly (`passed` / `wrong_output` / `runtime_error` / `timeout`), explains failures in plain language **without revealing hidden tests**, gives a **hint ladder that never contains code**, detects which **mistakes recur across different challenges**, picks the **next challenge to fix them — with the reason**, and tracks **mastery per concept** where a pass without hints counts for more.

And nobody learns alone: **Mentoring** puts you on a Google-Meet-style call with **Priya**, an AI mentor who talks you through your mistake and — on **✨ Summarise** — presents an animated, step-by-step replay of *your own code*; **Ask Priya** is a chat on every page that knows which problem you're on; **Repo Analyse** reviews any GitHub project for safety, structure and scalability in plain words; and **Community** lets students help each other while teachers mentor. Every one of them keeps the same rule as the hint ladder: *we point, you fix* — no code, no answers, no hidden tests.

---

## One command

```bash
npm install && npm start
```

Then open **http://localhost:3000** (learners) and **http://localhost:3000/judges** (judges).
Requirements: **Node 22.13+** (uses the built-in `node:sqlite` and `--permission`). No Docker, no database server, no Python install, **no API key**, no internet at runtime.
Optional: free keys for **Groq**, **Gemini** and **ElevenLabs** in a git-ignored `.env` make Priya smarter and give her a real voice — see [Optional AI keys](#optional-ai-keys).

- First run builds the web app once (~1 min) and seeds three pseudonymous demo learners (`yash`, `riya`, `khushi`) by running their scripts through the real sandbox.
- `npm run dev` — the same with hot reload · `npm run url` — public URL via `ngrok http 3000`
- `npm run seed` — reset the demo data · `npm run harness` — run the judges' checks on ourselves

## For the judges — a 15-minute tour

| Where | What you can verify |
|---|---|
| **`/judges`** | The 4 judge challenges as one-click **Try it** · **Break it**: run any of the 15 hostile programs (+ 9 escape attempts) live and watch it contained, the server stay up and the next good submission pass · Yash's recurrence story · the isolation diagram · copy-paste `curl` for every endpoint · reset button |
| **`/challenge/last-k-total`** | The statement's own example: Yash's starter → 3/3 visible, hidden `passed, passed, runtime_error, wrong_output, wrong_output, passed`, tag `unhandled_short_input`, the explanation word for word, the **Line Map** on line 3, the hint ladder (ask for the answer — still one rung), the **Time-Travel Replay** |
| **`/dashboard?learner=yash`** | Two recurring mistakes, one one-off slip, mastery bars + timeline, “why this next” with its reason, history |
| **`/ledger`** | Every prompt and response, and the guardrail's **rejection** count (drafts that quoted code — logged, never shown) |
| **`/taxonomy`** | Hand-in #3 — also [TAXONOMY.md](TAXONOMY.md) |
| **`/bug-factory`** | A buggy program generated from the learner's top mistake: find the line, then fix it |
| **`/mentoring?learner=yash`** | Every problem Yash tried and what went wrong → **Join session** → the Meet-style call: Priya speaks (captions on), **✨ Summarise** plays the animated replay of his code, ask her anything by voice or chat |
| **`/repo`** | Click **This project (works offline)** — score, layers, findings with why + fix, roadmap, the shape to aim for, Ask Priya |
| **`/community`** | Teachers' accepted answers, Priya's first-nudge replies, a blurred spoiler; switch to **Teacher view** for the Teacher desk |

## Learn together — Mentoring · Ask Priya · Repo Analyse · Community

| Feature | What a newcomer gets | The guardrail |
|---|---|---|
| **Mentoring** `/mentoring` | Recent problems with what went wrong in each → **Join session** opens a Google-Meet-style lobby and call with Priya (her photo tile, speaking ring, live captions, mic/camera, raise hand, reactions, in-call chat, hang-up recap). She explains the result, the line to look at, the mistake's name and a plan. **✨ Summarise** makes her *present*: an animated walkthrough of the learner's own code — the running line lights up, lists become boxes, index variables become pointers that slide (and fall off the end on an `IndexError`), changed values flash, hidden tests flip as locked tiles. Play / pause / step / scrub / speed, narrated. English, हिन्दी, मराठी. | Built only from the stored explanation, the Line Map and a replay on a **public probe** input; every spoken line passes `findLeak`; it ends with "I'll never hand you the code". |
| **Ask Priya** (every page) | A floating chat: explains Python ideas in simple words anywhere; on a problem page it knows the problem and the learner's current code and helps with *that*. Voice in and out. | On a problem: prose only — every model reply passes `guardReply` (the hint validator + leak check) or the built-in reply ships; "give me the answer" is always answered deterministically, one rung. |
| **Repo Analyse** `/repo` | Paste a GitHub link (or analyse this checkout offline): health score + grade, health per area, the layers present/missing as an animated diagram, findings sorted *fix first → polish* (each with why + fix + files + what to learn), strengths, a roadmap, the target layered architecture for scaling, Priya's spoken review, and Q&A about the report. | Secrets are reported by file and line only — values are never copied; only committed files are judged. |
| **Community** `/community` | Questions, tips, discussions, showcases; filters and search; votes; accepted answers; teachers with badges and a **Teacher desk** (who needs help and why, open questions); Priya gives every new question a first nudge. | A post containing a solution is **blurred** for anyone who hasn't solved that problem (they can still reveal it); Priya's replies pass the same validator. |

## The API (same origin — `http://localhost:3000/api/*`, also `:4000` directly)

```bash
curl -s localhost:3000/api/submit -H 'content-type: application/json' \
  -d '{"learner_id":"yash","challenge_id":"last-k-total","code":"def last_k_total(marks, k):\n    total = 0\n    for i in range(len(marks) - k, len(marks)):\n        total += marks[i]\n    return total\n"}'
```

```json
{
  "submission_id": "s_0020",
  "learner_id": "yash",
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
| `GET /api/mentor/:learner` · `POST /api/mentor/session` `{learner_id, challenge_id, lang?}` | Mentoring overview · a session script (segments + visuals) and the replay it presents |
| `POST /api/chat` `{message, learner_id?, history?, lang?, context{page, challenge_id?, code?, repo_report_id?}}` | Ask Priya → `{reply, suggestions, source, model, intent}` |
| `GET /api/voice/status` · `POST /api/voice/tts` `{text}` · `POST /api/voice/stt` (raw audio) | Which voice is live · ElevenLabs MP3 (204 → browser voice) · Groq Whisper transcript (204 → browser recognition) |
| `POST /api/repo/analyze` `{url}` or `{local: true}` · `GET /api/repo/reports[/:id]` | Repo Analyse |
| `GET/POST /api/community/posts` · `GET /api/community/posts/:id` · `POST …/:id/replies` · `POST …/:id/accept` · `POST /api/community/vote` · `GET /api/community/people` · `GET /api/community/teacher-desk` · `GET/POST /api/profile` | Community |
| `GET/POST /api/dev/reset` | Re-seed the demo learners (and the demo community) |

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
- **Learn together:** 🎥 **Mentoring** (Meet-style call + animated Summarise) · 💬 **Ask Priya** (chat on every page) · 🧱 **Repo Analyse** (architecture review of any repo) · 👥 **Community** (students + teachers, spoilers blurred).

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
| T7 mentor · chat · community · repo (ours) | **0/84** chat replies with code / answer / hidden value · **0/84** leaking mentor lines · spoilers blurred for non-solvers only · AI first replies prose-only · Repo Analyse offline |
| Core unit tests | **29/29** (a planted-bug test per detector, classifier order, validator, bank self-check, chat guard, mentor script, spoiler check, repo analysis) |

## Repository

```
apps/
  api/      Fastify API — routes, sandbox pool, seed, optional LLM tier,
            learning.ts (mentor · chat · repo · community services), lib/ai.ts (Groq/Gemini/Anthropic),
            lib/voice.ts (ElevenLabs TTS · Groq Whisper STT), lib/repo-fetch.ts (GitHub REST / local git)
  runner/   the sandbox child: supervisor.mjs · worker.mjs (Pyodide) · harness.py
  web/      Next.js 16 + Tailwind 4 + shadcn/ui + motion — landing + 10 app pages, en/हिन्दी/मराठी, light/dark
            components/mentor (MeetRoom, VisualSummary) · components/chat (ChatWidget)
packages/
  core/     pure logic: challenge bank (hidden tests), classifier, detectors, hints + validator,
            explanations, secrecy, mastery, recurrence, engine, mentor script, chatbot + guard,
            repo analysis, community rules · test/unit.ts
  db/       node:sqlite store — schema.sql (WAL, CHECK constraints)
harness/    the six judge suites + T7 (mentor · chat · community · repo) + all.ts scoreboard
docs/       architecture · test-harness · viva · EVENT-MANUAL (the event field manual)
TAXONOMY.md hand-in #3 · prompt.md the full build spec · dojo.md / features.md / README-TRACK.md planning docs
```

**Stack:** Node 22.13+ · TypeScript run directly by `tsx` · npm workspaces · Fastify 5 · Pyodide 314 (CPython 3.14 → WebAssembly) · `node:sqlite` · Next.js 16 · React 19 · Tailwind CSS 4 · shadcn/ui · motion · NumberFlow · cobe · canvas-confetti. Optional: `@anthropic-ai/sdk` (Tier-2 polish, off without `ANTHROPIC_API_KEY`) · Groq + Gemini (OpenAI-compatible REST, no SDK) · ElevenLabs REST · browser Web Speech API.

## Optional AI keys

Put any of these in a **`.env`** at the repo root (git-ignored; the API loads it at start-up). All have free tiers; none is required.

| Key | What it turns on | Without it |
|---|---|---|
| `GROQ_API_KEY` | Priya's chat + mentor Q&A + repo review with `openai/gpt-oss-120b` (falls back to `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`); speech-to-text with `whisper-large-v3-turbo`; Hindi/Marathi mentor sessions | Built-in replies; the browser's own speech recognition |
| `GEMINI_API_KEY` | The same, with `gemini-3.5-flash-lite` (next in `LAYERFLOW_AI_ORDER`) | — |
| `ELEVENLABS_API_KEY` | Priya's voice (`eleven_flash_v2_5`) | The browser's built-in voice |
| `GITHUB_TOKEN` | Repo Analyse beyond 60 GitHub requests/hour, and private repos | Public repos, 60 requests/hour |

Every model reply on a problem must pass `guardReply` (no code, no answer, no hidden value) or the built-in reply is shown; every call is logged in the Hint Ledger (`kind = chat · mentor · repo`).

**Tier-2 polish for explanations and hints:** the product is complete with **zero API keys** — every explanation and hint has a deterministic Tier 1. If `ANTHROPIC_API_KEY` is set, explanations and hints may be reworded by `claude-opus-5-5` (configurable with `LAYERFLOW_LLM_MODEL`); the model only ever sees the public task, the learner's own code and the already-safe Tier-1 draft, and its text must pass the same validator and leak check or Tier 1 ships. Every prompt and response is logged in the Hint Ledger. See [.env.example](.env.example).

## Data & privacy

Pseudonymous learner ids only (`yash`, `riya`, `khushi`, or any nickname) — no accounts, no real student data. The camera and microphone in Mentoring are only switched on when you click them; video never leaves the browser, and audio is only sent for transcription when you tap the mic. One SQLite file at `apps/api/data/layerflow.db` (gitignored); delete it or run `npm run seed` to reset.

## Credits

All 18 challenges, their hidden tests and every hint are original to this project — no Exercism / MBPP / HumanEval content was adapted. The web app's design system, landing-page structure, illustrations, videos and fonts come from our team's [VH26-IMPIC](https://github.com/icancodefyi/VH26-IMPIC) frontend. The mentor and teacher portraits come from our team's [Apply](https://github.com/rohit94r/Apply-saas) product, whose mock-interview Meet room inspired the mentoring call.
