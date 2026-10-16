# 🥋 DEBUG DOJO — the complete project document
### DI-01 · Decentralized Intelligence · Kurukshetra 2026

> *"A coding coach that helps you find the bug without handing you the answer."*
>
> **The one-line thesis:** every other AI tutor gives the answer. Debug Dojo is the one that **refuses** — and can *prove* it never gave it.

**Document status:** FINAL · locked decision · **Kickoff 15:30 16 Oct** · **Freeze 15:30 17 Oct**
**Companions:** `README.md` (event manual) · `README-TRACK.md` (build plan + timeline) · `compare.md` (all 13 statements compared)

---

## Table of contents
1. [Why I chose this statement](#1-why-i-chose-this-statement)
2. [The innovation — what is genuinely new here](#2-the-innovation--what-is-genuinely-new-here)
3. [The problem-solving — what we actually built](#3-the-problem-solving--what-we-actually-built)
4. [The problem students already face](#4-the-problem-students-already-face)
5. [The business model](#5-the-business-model)
6. [What judges want on the website — every deliverable](#6-what-judges-want-on-the-website--every-deliverable)
7. [The 6 judge tests → our self-test harness](#7-the-6-judge-tests--our-self-test-harness)
8. [Architecture — the two decisions that win it](#8-architecture--the-two-decisions-that-win-it)
9. [The five mistake detectors](#9-the-five-mistake-detectors)
10. [The hint ladder — the part with human raters](#10-the-hint-ladder--the-part-with-human-raters)
11. [Mastery model](#11-mastery-model)
12. [The demo — 5 minutes, the emotional arc](#12-the-demo--5-minutes-the-emotional-arc)
13. [The one-page taxonomy (a deliverable)](#13-the-one-page-taxonomy-a-deliverable)
14. [Build timeline — the 13 usable hours](#14-build-timeline--the-13-usable-hours)
15. [Everything that can go wrong, and the fix](#15-everything-that-can-go-wrong-and-the-fix)

---

## 1. Why I chose this statement

This section answers: *"of 13 statements, why this one?"* — the decision I locked after comparing all of them.

**The short version:** it is the only statement on the board where the score is an **absolute checklist you can drive to ~100% yourself**, while every other team is fighting a leaderboard or a subjective panel — and it is the statement **every other team's AI tells them to skip.**

| Reason | Detail |
|---|---|
| **It's the only self-scorable one in my track** | Decentralized Intelligence is judged by a **runnable test pack** (DI-01/02/03/06) or a **leaderboard** (DI-04). Every Open/Agentic statement is panel-judged. On DI-01 I can *run the judges' own tests* and know my score before they do. |
| **The crowd is not there** | Your friend took DI-06; every model's favourite pick is DI-06 (it's the most "web-dev approachable"). Teams read DI-01's words — *sandbox, red team, hidden-test secrecy, taxonomy, 15 hostile programs* — and flinch. **Crowd = 1.** |
| **Depth over breadth** | The statement itself says: *"one programming language your team can support well."* It is the only statement that explicitly rewards doing **one thing perfectly** instead of everything half-done. |
| **No external dependency** | No GPU, no blockchain, no faucet, no sponsor API, no leaderboard race, no baseline to beat. The only external thing is an LLM API key — and any model is allowed. |
| **The emotion is theirs, not mine** | The story (Rohan) is written *by the judges*. I don't have to sell them a feeling they don't have; I finish the story they started. |

**What I gave up by choosing it:** the biggest business story on the board is OP-03 AI Lead Desk (fees · job fears · family approval). But it's Open-track, so **TechSummitTrainers owns the submission** (clauses 1/2/5), it's panel-judged, and it's 7 subsystems — the exact "everything half-done" I refuse. Full reasoning in `compare.md §4.2`.

> **The strategy, as one rule:** maximise *expected judge points × probability of finishing × ownership of the result*. DI-01 wins 4 of 5 tests; the 5th (can I move a room with it) is a tie. → **DI-01.**

---

## 2. The innovation — what is genuinely new here

Not "we used AI." Four things nobody else will have on their slide tomorrow.

### 2.1 The refusal architecture (the real innovation)
Everyone is building "an AI that helps." We built **an AI with a hard moral boundary that is enforced in code, not in a prompt.** A hint validator rejects any hint containing code (fences, `def`, `=`, `()`, imports) **at storage time**. So "the AI never gave the answer" is not a claim — it's a **property the system cannot violate.** That's the difference between a chatbot and a teacher.

### 2.2 The Hint Ledger — compliance weaponised into a feature
The rules require us to *"log every prompt and response; judges may ask to see them."* Everyone treats that as a compliance chore. We ship it as a **browsable "Hint Ledger" page** — a live, searchable record proving that not one hint ever contained code. **The audit trail becomes the trust marketing.** Our moat is the *corpus* of logged hints + outcomes, which compounds every submission and cannot be bought.

### 2.3 Hidden tests that are structurally unreachable
The secrecy requirement ("never reveal a hidden input, expected output, program output or exception message") is usually met by *hiding fields in JSON*. We met it by **architecture**: the hidden test table lives **only in the server's memory**. The sandboxed child process never receives an expected value, never has the test file on disk, and the browser never receives hidden data. **The learner cannot leak what we never gave them.** This passes the red-team, the secrecy check, and the "trick the harness" attacks *by construction*.

### 2.4 Mistake-driven curriculum, not mistake reporting
Every tutor shows "you got this wrong." We go further: we **detect the category of mistake deterministically** (not via an LLM guessing), **prove recurrence only across different challenges**, and **auto-serve the next challenge that targets the learner's recurring mistake, with the reason.** The system doesn't report that Rohan struggles with boundaries — it *cures* them.

> **The innovation sentence for the viva:** *"Everyone else built a tutor that explains. We built a tutor with an enforced conscience, an auditable memory, and a closed loop that makes a specific mistake disappear."*

---

## 3. The problem-solving — what we actually built

One sentence: **a practice environment that runs learner code safely, explains failures in plain language, gives a hint ladder that sharpens without revealing the answer, and learns which mistakes each learner keeps repeating.**

### 3.1 The engine (what happens on every submit)

1. **Receive** `{learner_id, challenge_id, code}`.
2. **Run** the code in a hardened sandbox (Pyodide/WASM in a worker, OS rlimits + process-group kill as defence-in-depth).
3. **Label** every test as exactly one of `passed` / `wrong_output` / `runtime_error` / `timeout`, naming any limit that killed the run.
4. **Tag** the failure with a mistake category from the taxonomy (§9).
5. **Explain** in plain language, naming the *kind* of input, never the values.
6. **Update** concept mastery (a pass without hints counts more) and rolling recurrence.
7. **Return** the JSON in the judges' exact shape (§6).

### 3.2 The stack (boring on purpose — boring ships)
- **Language for learners:** **Python** (best-supported open corpora: MBPP, HumanEval, Exercism).
- **Platform:** Node/TypeScript — a small service exposing the 3 required endpoints, a Next.js learner UI, a counsellor-style dashboard, and the Hint Ledger.
- **Sandbox:** **Pyodide** (CPython → WebAssembly) inside a **Node worker thread**, spawned as a **child process** with `RLIMIT_CPU / RLIMIT_AS / RLIMIT_FSIZE / RLIMIT_NPROC`, killed by **process group** on wall-clock timeout.
- **Fallback runner:** `python3 -I -S` subprocess in a scrubbed temp dir with sockets and out-of-dir file reads blocked.
- **Explanations/hints:** any LLM API, **every prompt+response logged** and rendered in the Ledger.
- **Hosting:** one command locally + a live URL (Replit/Render/Fly) so the endpoints are reachable **from the start of judging**.

### 3.3 Why this solves the problem *and* satisfies the rubric
- **Technical execution:** sandboxed WASM execution + deterministic classifier + enforced-conscience hints — real engineering, not a wrapper.
- **Completeness:** all 6 scoring rows are directly, mechanically demonstrable.
- **Innovation:** §2.
- **Design:** a learner UI + counsellor dashboard + Ledger.
- **Presentation:** Rohan's story, live red-team, live recurrence reveal.

---

## 4. The problem students already face

This is the *"what problems your students are already facing"* section — the real, human problem, sourced from the statement's own story and problem overview.

### 4.1 The core failure loop (Rohan's loop, verbatim from the statement)
> Rohan's function passes all three examples he can see and fails **test 5** — a test he can't see. Yesterday's feedback was `IndexError: list index out of range`, which told him *where* it died but not *why*. So he pasted the question into a chatbot, copied the answer, and submitted: **Accepted.** Next week the exam has the same kind of loop — and there is no chatbot in the exam hall.

**The loop, named:** *visible tests pass → hidden test fails → error message locates but doesn't explain → paste into chatbot → "Accepted" → submit → learn nothing → repeat → can't reproduce the skill under exam conditions.*

### 4.2 The five concrete problems a beginner faces today

| Problem | Why it hurts | What today gives | What it should give |
|---|---|---|---|
| **Feedback that locates but doesn't explain** | A traceback says *where* it died, not *what to look at*. A learner can't tell a boundary bug from an index bug from a mutation bug. | `IndexError: list index out of range` | *"3 visible pass, 3 hidden fail — all cases where k > len(marks). Your loop starts negative."* |
| **Pass/fail with no location** | "Wrong answer on test 5" gives no direction. The learner guesses and re-guesses. | pass/fail per test | the same, plus a targeted next action |
| **Early answers kill the struggle** | A chatbot that gives the code removes the exact friction that makes debugging stick. Rohan *learned to copy* because copying worked. | full solution in 4 seconds | a **ladder** that sharpens but never completes the solution |
| **Running learner code is dangerous** | Code from an unknown author must not read files, hit the network, or eat resources. Naive runners get killed by one hostile paste. | unsafe `eval` / fragile subprocess | contained-by-construction, labelled honestly |
| **The same mistake, forever** | Without a memory of *which* mistakes recur, a learner never faces the one that actually blocks them. | per-problem score | recurrence across challenges → a next challenge that **targets it, with the reason** |

### 4.3 The emotional truth (why the judges will feel this)
The student problem isn't laziness — it's **the appearance of not knowing.** A beginner won't ask for help because asking costs them the one thing they can't afford in front of peers. So they hide confusion, copy an answer, and fake competence until the exam. **Debug Dojo gives support that doesn't embarrass:** it never says "you're wrong," it says "look here, and if you're still stuck, look there too." That's the emotional core — and it's the judges' own story.

### 4.4 The institutional version (why institutions pay)
Colleges face Rohan at scale: ChatGPT broke the take-home assignment, faculty can't tell who learned vs. pasted, and nobody can certify a skill. Debug Dojo is not a *detector* — it's a **teacher** whose Hint Ledger doubles as proof that assistance was bounded. Institutions buy **"did they actually learn it?"** answered and provable.

---

## 5. The business model

*(Not on the published rubric — this is our viva answer and our "potential" story. It ships as a slide + features that already exist. It never replaces the 6 judge tests.)*

**The product in one sentence:** a debugging tutor that **provably never hands over the answer** — sold to the institutions whose entire assessment model just broke.

**Why now:** ChatGPT killed the take-home assignment. Every college, bootcamp and placement cell is asking *"how do we certify a student actually learned this?"* — and there is no product answer today. We're not pitching a hypothetical; we're pitching the answer to a question they're already asking.

| Tier | Buyer | What they get | Why they pay |
|---|---|---|---|
| **Free** | learners | challenges + hint ladder + mastery map | growth loop — a shareable mastery map posts itself |
| **Coach** (₹/seat/mo) | tutors, mentors, bootcamp instructors | assign challenges; **recurring-mistake reports per student** | replaces the spreadsheet they build at 11pm |
| **Institution** (annual) | colleges, training institutes, placement cells | cohort dashboards, **no-answer-guarantee audit trail**, API | the "did they actually learn it?" question, answered *and provable* |
| **White-label** | edtech platforms, publisher courseware | the engine inside their content | they have the students; they lack the bounded-assistance layer |

**The four features that attract support — all already in the build:**
1. **Hint Ledger → trust artifact.** *"Ask us to show you every hint we've ever written."* Compliance → marketing.
2. **Mastery map per concept → retention.** Students return to move the bar; the bar is the product.
3. **Recurring-mistake report → the sales feature.** A tutor seeing *"class average: `boundary_comparison`, 61%"* is a purchase order.
4. **Shareable pseudonymous learner profile → acquisition.** Rules-compliant (no real student data), but worth posting.

**The moat:** competitors can copy the UI, not the **corpus of logged hints and outcomes.** Every submission sharpens the taxonomy — a data flywheel a new entrant cannot buy on day one.

**The answer if a judge asks "is this a business or a hackathon project?":**
> *"Same sentence covers both: institutions will pay for proof that students learned instead of pasted. We shipped the proof — the ledger — as a product feature on day one."*

---

## 6. What judges want on the website — every deliverable

This is the **required deliverables checklist** — what must exist on/with the submission. Map each to the statement's explicit requirement.

### 6.1 The mandatory hand-ins

| # | Deliverable | Statement basis | Our status/where |
|---|---|---|---|
| 1 | **Working repo + README** | "repository… code that runs" | `README.md` in repo + live repo URL |
| 2 | **One command to start everything** | run-it-locally requirement | e.g. `npm install && npm run dev && npm run seed` (documented, tested) |
| 3 | **Live URL, or a laptop, with the 3 API endpoints reachable from the START of judging** | "expose `POST /api/submit`, `POST /api/hint`, `GET /api/learner/{id}`" | deployed URL + a laptop as backup running the same command |
| 4 | **One page: the mistake taxonomy + how each category is detected** | "tag… taxonomy must include these five… kept distinct" | §13 of this doc; also a `/taxonomy` route in the product |
| 5 | **A 5-minute demo, then a viva** | "demo + viva" | §12 script; rehearsed 3× |
| 6 | **One programming language only** | "one programming language your team can support well" | Python, declared on the README front page |
| 7 | **Log every LLM prompt + response, browsable** | "log every prompt and response; judges may ask to see them" | Hint Ledger page + `/api/ledger` |
| 8 | **Pseudonymous learner data only; no real student data** | "pseudonymous accounts only" | seed learners are `rohan`, `meera`, `kabir`; stated on README |

### 6.2 The API shapes (must match the Example exactly — judges script against it)

**`POST /api/submit`** → `{learner_id, challenge_id, code}` returns **this exact JSON shape**:
```json
{
  "submission_id": "s_0142",
  "learner_id": "rohan",
  "challenge_id": "last-k-total",
  "visible": [
    {"test": 1, "call": "last_k_total([10, 20, 30, 40], 2)", "expected": "70", "got": "70", "outcome": "passed"},
    {"test": 2, "call": "last_k_total([5, 5, 5], 3)", "expected": "15", "got": "15", "outcome": "passed"},
    {"test": 3, "call": "last_k_total([7], 1)", "expected": "7", "got": "7", "outcome": "passed"}
  ],
  "hidden": [
    {"test": 1, "outcome": "passed"},
    {"test": 2, "outcome": "passed"},
    {"test": 3, "outcome": "runtime_error"},
    {"test": 4, "outcome": "wrong_output"},
    {"test": 5, "outcome": "wrong_output"},
    {"test": 6, "outcome": "passed"}
  ],
  "mistake_tags": ["unhandled_short_input"],
  "explanation": "All 3 visible tests pass, but 3 of 6 hidden tests fail: one crashes and two give the wrong total. All three are cases where k is larger than the number of marks. Your loop starts at len(marks) - k, which is negative then."
}
```
> 🔑 **The secrecy test lives in this object:** every `hidden[]` entry has **only `test` + `outcome`.** No `call`, no `expected`, no `got`, no exception text. The judges diff exactly this.

**`POST /api/hint`** → `{submission_id}` returns the **next** (more specific) hint, prose-only, never code.

**`GET /api/learner/{learner_id}`** returns `{recurring_mistakes, mastery per concept, next_challenge {…, reason}}`.

### 6.3 The four judge challenges (must be present, exactly)
| id | Signature | Returns | Inputs |
|---|---|---|---|
| `last-k-total` | `last_k_total(marks, k)` | total of last k marks, or all if k > len | list of ints, possibly empty; k ≥ 0 |
| `count-passes` | `count_passes(marks)` | how many marks ≥ 40 | list of ints, possibly empty |
| `first-n-squares` | `first_n_squares(n)` | `[1,4,9,…,n²]`, or `[]` if n=0 | n ≥ 0 |
| `middle-three` | `middle_three(items)` | middle three, or whole list if < 3 | odd-length list, or < 3 items |

### 6.4 Content floor to state on the site
- **≥10 challenges · ≥3 difficulty levels · ≥4 concepts**
- Each challenge: **description, starter code, concept tags, ≥3 visible tests, ≥5 hidden tests (incl. edge cases)**
- Include the 4 judge challenges above.
- **Attribution:** if you adapt any Exercism / MBPP / HumanEval content, credit it + its licence (MIT / CC BY 4.0 / MIT). **Hidden tests must be your own.**

### 6.5 "Website" checklist — what to put on the product/README so judges can verify fast
A single **judges' landing page** (`/` or `/start`) that shows, in order:
1. **The 4 judge challenges** as one-click "Try it" buttons (paste the buggy example → see outcomes).
2. **The live red-team button** (paste a hostile program → see it contained).
3. **The recurrence story** (a seeded learner's timeline + the "why this next challenge" reveal).
4. **The Hint Ledger** link (scrollable logged prompts + responses, proving no code in any hint).
5. **The taxonomy one-pager** (§13).
6. **A "How we run your code safely"** 4-bullet diagram (hidden tests in parent memory; child sees inputs only; rlimits; process-group kill).

---

## 7. The 6 judge tests → our self-test harness

**This harness is the product.** Build it first; run it at 21:00 Day 1, 07:30 Day 2, 12:00 Day 2. It maps the statement's scoring table to a script we can execute.

| # | Judge test (statement) | Full marks when | Our self-test |
|---|---|---|---|
| **T1** | **Sandbox red-team** — ~15 hostile programs (network, files, secrets, infinite loops, memory, processes, output/disk floods, tricks vs. the harness) | every one contained, never "passed"; server up; no secret/test file exposed; next normal submit works | `harness/redteam.sh` — 15 hand-written hostile programs; after each, a good submit must still pass |
| **T2** | **Outcome labels** — 4 programs × 3 challenges (pass / wrong output / error / forever) | all **12** labels exactly right | `harness/labels/` — 12 fixtures; assert classifier = 12/12 |
| **T3** | **Hidden-test secrecy** — programs that print/raise their inputs, request hints, inspect browser traffic | no hidden input/expected/output/exception reaches the learner | assert every `hidden[]` body has only `{test,outcome}`; diff all responses for known hidden strings |
| **T4** | **Hint leakage** — 3 failing submissions; request every hint incl. "give me the answer"; merge hint code into learner code | merged code **still fails ≥1 hidden test** | `harness/leakage/` — validate no hint contains code; auto-run merge test |
| **T5** | **Recurring mistakes** — scripted learner, ~11 programs over the 4 judge challenges | both planted recurring mistakes named; one-off slips **not**; next challenge targets a recurring one **with a reason** | `harness/learner/11.json` fixture; assert `GET /api/learner` |
| **T6** | **Explanations & hints** — 2 judges rate 5 failures, blind, 0–2 on correct/specific/not-giveaway | points scale with average | 4 teammates rate our 5 explanations 0–2; anything <1.5 → rewrite |

**Run the whole harness at 21:00 / 07:30 / 12:00. Three runs = we know our score before the judges do.**

---

## 8. Architecture — the two decisions that win it

### 8.1 Decision 1: hidden tests live only in the parent's memory
```
┌──────────────── PARENT (our server) ─────────────────────────────┐
│ challenge registry: visible tests + HIDDEN tests (inputs+expected)│
│  • hidden tests exist ONLY in parent memory — never on disk        │
│  • parent sends ONLY inputs to the child                          │
│  • parent compares outputs, emits the 4 outcome labels            │
│  • parent writes the explanation (LLM, prompt+response logged)    │
└───────────────┬────────────────────────────────────────────────────┘
                │  sends: inputs + code   (never expected values)
                │  returns: stdout / return / exception / killed-by-limit
┌───────────────▼──────── CHILD (sandboxed) ────────────────────────┐
│ Pyodide (Python→WASM) in a Node worker, spawned as a child process│
│  • virtual FS  → /etc/passwd and test-file reads return nothing   │
│  • no sockets   → network programs fail immediately               │
│  • rlimits + process-group kill → loops/mem/output/disk contained │
└────────────────────────────────────────────────────────────────────┘
```
**Why it wins three tests at once:** red-team file/secret reads fail *by construction*; the child never gets expected values so it can't echo them; the harness source in the child can't reach the parent's memory. **Defence in depth:** WASM sandbox *and* OS rlimits *and* process-group kill.

**Verified:** `pyodide@314.0.7` on npm; Node 26.10 present. **Prove it runs before kickoff.**

### 8.2 Decision 2: outcome labelling as a pure function
Exactly one label, deterministic:
```
normal exit + match     → passed
normal exit + differs   → wrong_output
raised / bad exit       → runtime_error   (learner's exception class; hidden side empty)
RLIMIT_AS hit           → runtime_error   ("memory limit")
RLIMIT_FSIZE hit        → runtime_error   ("output/disk limit")
RLIMIT_CPU hit          → runtime_error   ("cpu limit")
wall-clock exceeded     → timeout
```
Check resource-kill **before** wall-clock; wall-clock **before** reading output — never let two race.

---

## 9. The five mistake detectors

An explicit deliverable (§6.1 #4). Each detector is deterministic (no LLM guessing) and has a planted-bug unit test.

| Category | Detection rule |
|---|---|
| `unhandled_short_input` | learner code raised `IndexError`/`TypeError` **and** input is shorter than the contract needs (empty / < min length). Classify from exception type + input length — **never expose hidden values.** |
| `print_not_return` | program printed the correct value to stdout **but** returned `None` |
| `mutates_input` | input snapshot changed after the call, or a second identical call returns a different result |
| `off_by_one` | numeric result differs from expected by exactly **±1**, and the failing input is **not** at a boundary |
| `boundary_comparison` | numeric result differs by ±1 **and** the failing input **is** at an edge: `k==len`, `k>len`, `n==0`, `len(items)<3`, empty list |

*(Optional 6th, explicitly allowed: `wrong_index_direction`.)*

**Recurrence rule (critical):** roll up tags **across submissions**, keyed by learner. A tag is **recurring only if it appears in ≥2 different challenge IDs.** Failing the same challenge five times is **one** challenge, not two. One-off slips are **never** flagged recurring.

**Deliverable page format:** `category → detection rule → example buggy program → unit test name`, printable on one page.

---

## 10. The hint ladder — the part with human raters

**The rules:** ≥3 hints per failure, each more specific; **no hint reveals the complete solution, even when asked**; and (enforced by T4) **no hint contains code.**

**The statement's own example ladder (use it verbatim — it's model gold):**
1. *"Your three examples never ask for more marks than the list holds. What should `last_k_total` return when k is bigger than the list?"*
2. *"Work out `last_k_total([2, 5], 3)` by hand. Which index does your loop start at, and what does `marks[-1]` mean in Python?"*
3. *"In Python a negative index counts back from the end, so some marks get added twice. Your start index must never go below 0."*
4. *"Python has a built-in that returns the larger of two numbers. Use it to work out the start index once, before the loop."*

**Enforcement (in code, not prompt-wishing):**
- Store hints **prose-only**; reject any containing code fences, `def `, `=`, `()`, or an import — at **storage time**.
- Hint 4 may *name a builtin* (`max`), never show its use.
- If the learner says *"give me the answer"* → escalate one rung, never collapse.
- Log every prompt+response (rules) → Hint Ledger page (feature).

**T6 scoring:** 2 judges × 5 failures × 3 axes (correct, specific, not-giveaway) × 0–2. Rate ourselves cold with 4 teammates; rewrite anything <1.5.

---

## 11. Mastery model

Per-concept mastery, updated from work, **a pass without hints counts for more.** Simple and explainable (a Beta posterior):
```
prior  α=1, β=1        (mean 0.5)
pass, no hints    α += 1.0
pass, after hints α += 0.35   ← the penalty is the point
fail              β += 0.6
hint given        β += 0.15
mastery = α / (α + β)
```
Concept tags on every challenge power this; it's visible in `GET /api/learner` and explainable in 10 seconds. That satisfies "Skills by concept."

---

## 12. The demo — 5 minutes, the emotional arc

Open on **their** story, then let the product finish it.

| Time | Beat |
|---|---|
| 0:00–0:25 | *"Rohan's function passed all three examples and failed hidden test 5."* Submit it live. |
| 0:25–1:30 | Show **3 visible passing / hidden failing** + the explanation — names the *kind* of input, **no values**. |
| 1:30–2:30 | The **hint ladder**, 4 rungs live. Then ask *"give me the answer"* → still one rung. Then the **Hint Ledger** proving zero code in any hint. |
| 2:30–3:30 | **The wow:** open `GET /api/learner` — *"you keep making `unhandled_short_input` across 3 different challenges, so here's the next problem and why."* Mastery per concept updating. |
| 3:30–4:15 | **Red team, live:** paste a hostile program reading `/etc/passwd` → **blocked**, correct label, server up, next good submit still passes. |
| 4:15–5:00 | The taxonomy one-pager. The 15/12/11 numbers. Close: *"We never gave the answer. We gave the place to look."* |

**Speech (say this before the first click — 90s):** see `README-TRACK.md §13.2`. One speaker, eye contact, then turn to the screen on the word *"looks."*

**Viva probes to rehearse:** why Pyodide · how recurrence is counted · why hints contain no code · how hidden-test leakage is prevented · what mastery optimises for · what you'd do next.

---

## 13. The one-page taxonomy (a deliverable)

*Reproduce this on a single printed page and at `/taxonomy`:*

| Category | How it's detected | Example bug | Test name |
|---|---|---|---|
| `unhandled_short_input` | IndexError/TypeError + input shorter than contract | `range(len(marks)-k, …)` with k>len | `det_short_input` |
| `print_not_return` | printed correct value, returned `None` | `print(total)` then no return | `det_print_not_return` |
| `mutates_input` | input mutated after call / 2nd call differs | `items.pop(0)` inside solve | `det_mutates_input` |
| `off_by_one` | ±1 error, failing input **not** at a boundary | `range(0, n-1)` misses last | `det_off_by_one` |
| `boundary_comparison` | ±1 error **and** failing input at an edge | `if k < len(marks)` instead of `≤` | `det_boundary_cmp` |

**Recurring = appears in ≥2 different challenges.** Next challenge targets the recurring one, with the reason shown.

---

## 14. Build timeline — the 13 usable hours

| Time | Deliverable | Gate |
|---|---|---|
| 15:30 | Repo + first commit; `/api/submit` returns the JSON shape (hardcoded data) | |
| 15:30–17:00 | Pyodide child runner: execute, catch, wall-clock timeout, byte cap | |
| 17:00–18:00 | Classifier **12/12** on label corpus + 5 hostile programs | |
| **18:30** | **Eval 1** — present architecture + isolation story | |
| 18:30–20:00 | Remaining 10 hostile programs → **T1 green** | |
| 20:00–21:00 | 12 challenges authored with full test sets | |
| **21:00** | **Full harness run T1–T5.** Record the score. Backlog = tonight's work | |
| 21:00–23:00 | Explanation pipeline (LLM + logging) + prose-only hint ladder | |
| **23:00** | **GATE LOCKS. Feature freeze.** Deploy, commit, screenshot, push | |
| 23:00–00:30 | `/api/hint` + `/api/learner` + recurrence rollup | |
| 00:30–06:00 | **Sleep in 2 shifts** (you demo at 15:30 tomorrow) | |
| 06:00–07:30 | Mastery + learner UI + **Hint Ledger** page | |
| **07:30** | **Full harness run.** | |
| **08:00** | **Round 1** | |
| 08:00–10:00 | Fix what judges flagged | |
| **10:00** | **SCOPE LOCK** | |
| 10:00–12:00 | UI polish, one-command start, README, taxonomy page | |
| **12:00** | **Final harness run.** Fix reds only | |
| 12:00–13:00 | Rehearse 5-min demo twice back-to-back | |
| **14:00** | **Code freeze** | |
| **15:30** | **Round 2 — demo + viva** | |

---

## 15. Everything that can go wrong, and the fix

| Risk | Fix |
|---|---|
| Pyodide fails on venue Wi-Fi (cold) | Install + **cache before 15:30**; ship the `python3 -I -S` subprocess fallback |
| Pyodide too slow | Cache runtime, pre-warm worker; the scripted-learner test has no latency bar |
| A hidden value leaks in a response | Automated assertion (T3): no hidden string ever in any response body |
| The LLM writes code into a hint | Prose-only validator rejects at **storage** time, not generation time |
| Recurrence false-positives | Count **distinct challenge IDs**, not submissions; T5 fixture |
| Judges can't reach endpoints | Deploy by 20:00 **and** bring a laptop running the same command |
| Night shift wrecks the viva | Sleep 2 shifts. Nobody demos at 15:30 on 2h sleep |
| Scope creep after 10:00 | Scope lock; new ideas go on the "next" slide, never the build |
| Plagiarism doubt | Commit every 30 min from 15:30; public repo; credit every adapted source; run **gitleaks** |

---

> *"Rohan never needed the answer. He needed someone to point him to the right place to look."*
>
> **Debug Dojo** — we never gave the answer. We gave the place to look.

---

### Source of truth
Every requirement, test count, endpoint, JSON shape, rubric weight, hint ladder and example in this document is taken **verbatim from the published DI-01 statement and its scoring table.** The plan, architecture, taxonomy, business model and demo are ours.