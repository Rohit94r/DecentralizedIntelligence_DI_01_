# 🛠️ DEBUG DOJO — FEATURES.md
### The build spec. Every feature that earns points, in the order you build them.

> **Track:** DI-01 · **Language for learners:** Python · **Kickoff 15:30 · Gate locks 23:00 · Code freeze 14:00 tomorrow**
> **Info:** `dojo.md` (why + what) · `README.md` (rules/gates) · `README-TRACK.md` (timeline/roles)
>
> ## 🔴 THE ONE RULE OF TONIGHT
> **Do not build features. Build the scoreboard.** The judges run 6 tests. Every feature below exists because it earns a specific test. If a feature earns no test, it is Tier 2 or it is a cut.

---

## 0. Feature → judge test map (the priority derives from this)

| Judge test | What they do | Features that earn it |
|---|---|---|
| **T1** Sandbox red-team | ~15 hostile programs | **F1** runner · **F2** kill/labels |
| **T2** Outcome labels | 12 programs, 12 labels | **F2** classifier · **F3** challenge bank |
| **T3** Hidden-test secrecy | programs try to leak hidden data | **F4** parent-memory design · **F5** API contract |
| **T4** Hint leakage | merge hint code → must still fail | **F6** prose-only ladder |
| **T5** Recurring mistakes | 11-program scripted learner | **F7** detectors · **F8** recurrence + next challenge |
| **T6** Explanations & hints | 2 blind judges rate 5 failures | **F9** explanations · **F6** hints |
| *(rubric)* completeness / design / presentation | panel eyes | **F10** mastery · **F11–F14** UI · **F15** one-command + deploy |

---

## 1. TIER 0 — MUST BUILD (these are the score)

### F1 · The sandboxed runner
**Earns:** T1 · **Owner:** Runner person · **Effort:** 2.5h · **Deps:** none

Runs learner Python with **no host filesystem, no network, hard timeout, byte caps.**

- [ ] **Primary:** Pyodide (Python→WASM) inside a Node **worker thread**, spawned as a **child process**
- [ ] **Hard timeout** → terminate worker + `killpg` (SIGKILL the group)
- [ ] **stdout/stderr byte cap** (~256 KB) → kill on overflow
- [ ] **rlimits on the child:** `RLIMIT_CPU`, `RLIMIT_AS`, `RLIMIT_FSIZE`, `RLIMIT_NPROC`
- [ ] **Fallback runner:** `python3 -I -S` subprocess, scrubbed env, cwd = empty temp dir, sockets blocked
- [ ] Returns a **typed result**: `{stdout, return_value, exception_type, exception_msg, killed_by, duration_ms}`

**Acceptance:** `while True: pass` → `timeout`. `open('/etc/passwd')` → `runtime_error` (no content leaks). `bytearray(10**10)` → `runtime_error (memory limit)`. Server survives all three.

> ⚠️ **Prove Pyodide runs before you write anything else.** If the cold download fails on venue Wi-Fi, you switch to the fallback at hour 1, not hour 8.

---

### F2 · The outcome classifier (pure function)
**Earns:** T2 + T1 · **Owner:** Logic person · **Effort:** 1h · **Deps:** F1, F3

Exactly **one** label per test. No guessing.

```
normal exit + output matches   → passed
normal exit + output differs  → wrong_output
raised / non-zero bad exit    → runtime_error   (learner's exception class only)
RLIMIT_AS hit                 → runtime_error   "memory limit"
RLIMIT_FSIZE hit              → runtime_error   "output limit" / "disk limit"
RLIMIT_CPU hit                → runtime_error   "cpu limit"
wall-clock exceeded           → timeout
```

- [ ] **Order matters:** check resource-kill **before** wall-clock, wall-clock **before** reading output
- [ ] Compare with **type-aware equality** (`70` ≠ `"70"` unless the test says string)
- [ ] Every `runtime_error` **names the limit** if a limit caused it

**Acceptance:** the 12-case corpus (§4) returns **12/12 correct.**

---

### F3 · Challenge bank
**Earns:** T2 + T5 + completeness · **Owner:** Spec/QA person · **Effort:** 2h · **Deps:** —

- [ ] **≥10 challenges · ≥3 difficulty levels · ≥4 concepts**
- [ ] Each: description · starter code · concept tags · **≥3 visible** · **≥5 hidden (with edge cases)**
- [ ] **The 4 judge challenges exactly:** `last_k_total(marks,k)` · `count_passes(marks)` · `first_n_squares(n)` · `middle_three(items)`
- [ ] **Hidden tests live ONLY in memory** — never written to a file the child can read
- [ ] Concept set: lists/indexing · loops/range · boundaries/conditionals · strings · accumulators
- [ ] Credit any adapted Exercism/MBPP/HumanEval content + licence in the README

**Acceptance:** `GET /challenges` lists ≥10 with correct metadata; the 4 judge challenges are present by id.

---

### F4 · Parent-memory execution design ⭐ THE ARCHITECTURE
**Earns:** T1 + T3 · **Owner:** Runner person · **Effort:** included in F1 · **Deps:** F1, F3

```
PARENT:  hidden tests (inputs + expected) in MEMORY ONLY
         sends INPUTS ONLY to the child → compares results itself
CHILD:   gets code + inputs. No expected values. No test file. No host FS.
```

- [ ] Child **never** receives an expected value
- [ ] Child's cwd/FS contains **nothing** from the challenge definition
- [ ] Comparison happens **in the parent**, after the child returns
- [ ] Harness source in the child has no route to parent memory

**Acceptance:** no hostile program can produce a hidden value — because it was never given one. **This is why T3 is free.**

---

### F5 · The API contract (judges script against this)
**Earns:** T3 + completeness · **Owner:** Logic person · **Effort:** 1.5h · **Deps:** F2, F3

**`POST /api/submit`** `{learner_id, challenge_id, code}` →

```json
{
  "submission_id": "s_0142",
  "learner_id": "rohan",
  "challenge_id": "last-k-total",
  "visible": [
    {"test":1,"call":"last_k_total([10, 20, 30, 40], 2)","expected":"70","got":"70","outcome":"passed"}
  ],
  "hidden": [
    {"test":1,"outcome":"passed"},
    {"test":3,"outcome":"runtime_error"},
    {"test":4,"outcome":"wrong_output"}
  ],
  "mistake_tags": ["unhandled_short_input"],
  "explanation": "All 3 visible tests pass, but 3 of the 6 hidden tests fail: one crashes and two give the wrong total. All three are cases where k is larger than the number of marks. Your loop starts at len(marks) - k, which is negative then."
}
```

> 🔑 **`hidden[]` contains ONLY `test` + `outcome`.** No `call`. No `expected`. No `got`. No exception text. *This one object is the whole secrecy test.*

**`POST /api/hint`** `{submission_id}` → `{hint_index, hint, remaining}` — the **next** hint.

**`GET /api/learner/{learner_id}`** → `{recurring_mistakes:[], mastery:{concept:0.0-1.0}, next_challenge:{challenge_id, reason}}`

- [ ] Endpoints **live from the start of judging** (deploy by 20:00)
- [ ] `submission_id` returned on every submit (hints need it)
- [ ] **No hidden string may appear in any response body** — automated assert

**Acceptance:** diff every response against all known hidden strings → zero hits.

---

### F6 · The prose-only hint ladder
**Earns:** T4 + T6 · **Owner:** Spec/QA · **Effort:** 1.5h · **Deps:** F5

≥3 escalating hints per failure. **No code, ever — enforced, not requested.**

- [ ] **Validator at storage time** — reject any hint containing: ```` ``` ````, `def `, `=`, `()`, `import`, `return`
- [ ] **Escalation:** nudge → specific → mechanism → name a builtin (`max`) but never its use
- [ ] Learner says *"give me the answer"* → **still escalate one rung**, never collapse the ladder
- [ ] Ladder advances per submission; a re-submission after hint N starts at N+1
- [ ] **Store the model ladder for the 4 judge challenges** (the statement gives one for `last_k_total` — use it verbatim)

**Model ladder (from the statement — copy this tone):**
1. *"Your three examples never ask for more marks than the list holds. What should `last_k_total` return when k is bigger than the list?"*
2. *"Work out `last_k_total([2, 5], 3)` by hand. Which index does your loop start at, and what does `marks[-1]` mean in Python?"*
3. *"In Python a negative index counts back from the end, so some marks get added twice. Your start index must never go below 0."*
4. *"Python has a built-in that returns the larger of two numbers. Use it to work out the start index once, before the loop."*

**Acceptance:** merge all hint code into the learner's code → **still fails ≥1 hidden test.** And the validator rejects any hint a model tries to write with code in it.

---

### F7 · The five detectors
**Earns:** T5 + a required deliverable page · **Owner:** Logic · **Effort:** 2h · **Deps:** F1, F3

Deterministic — **no LLM guessing.**

| Category | Detection rule | Unit test |
|---|---|---|
| `unhandled_short_input` | raised `IndexError`/`TypeError` **and** input shorter than the contract needs | `det_short_input` |
| `print_not_return` | printed the correct value to stdout **but** returned `None` | `det_print_not_return` |
| `mutates_input` | input mutated after the call, or 2nd identical call differs | `det_mutates_input` |
| `off_by_one` | numeric differs by exactly **±1**, failing input **not** at a boundary | `det_off_by_one` |
| `boundary_comparison` | numeric differs by ±1 **and** failing input **is** at an edge (`k==len`, `k>len`, `n==0`, `len<3`, empty) | `det_boundary_cmp` |

- [ ] Keep the 5 **distinct** — never collapse two into one tag
- [ ] Optional 6th allowed: `wrong_index_direction`
- [ ] Never expose hidden values while detecting (classify from **exception type + input shape**, not from expected output)
- [ ] **Deliverable:** the one-page taxonomy route/print (`category → rule → example bug → test name`)

**Acceptance:** every detector has a planted-buggy-program test that passes.

---

### F8 · Recurrence + next-challenge engine
**Earns:** T5 · **Owner:** Logic · **Effort:** 1h · **Deps:** F7

- [ ] Roll tags up **across submissions**, keyed by `learner_id`
- [ ] **Recurring = same tag in ≥2 DIFFERENT `challenge_id`s** (not 2 submissions of the same challenge)
- [ ] **One-off slips must NOT be flagged recurring**
- [ ] `GET /api/learner` returns recurring mistakes
- [ ] **Next challenge targets a recurring mistake, and says why:**
  `"next_challenge":{"challenge_id":"…","reason":"You've hit boundary_comparison in 2 different challenges — this one has three of them."}`
- [ ] If nothing is recurring → next challenge by weakest concept

**Acceptance:** the 11-program fixture (§5) yields **exactly the 2 planted recurring mistakes**, no one-offs, and a reason string.

---

### F9 · Plain-language explanations
**Earns:** T6 · **Owner:** Spec/QA · **Effort:** 1.5h · **Deps:** F2, F7

- [ ] One LLM call per failing submission → 2–4 sentences, plain language, **no jargon**
- [ ] **Name the kind of input, never the values** — *"a case where k is larger than the list"* ✅ · *"...when k=7 and marks=[3]"* ❌
- [ ] **Log every prompt + response** (rules require it) → F13 Ledger
- [ ] Seed with a good template per mistake category so cold-start quality is high
- [ ] **Self-rate before judges:** 4 teammates read 5 explanations and score **0–2 on correct / specific / not-giveaway**. Anything **<1.5 → rewrite**

**Acceptance:** 0 of 5 explanations contain a hidden value; average self-score ≥1.5/2.

---

### F10 · Mastery per concept
**Earns:** rubric "Skills by concept" + T5 reason quality · **Owner:** Logic · **Effort:** 45m · **Deps:** F8`

Beta posterior per concept — **a pass without hints counts more:**

```
α=1, β=1
pass, no hints   → α += 1.0
pass, with hints → α += 0.35     ← the penalty is the point
fail             → β += 0.6
hint given       → β += 0.15
mastery = α / (α + β)
```

- [ ] Keyed by **concept tags** on the challenge
- [ ] Visible in `GET /api/learner`, explainable in 10 seconds
- [ ] Drives the "next challenge" choice when nothing is recurring

**Acceptance:** the value moves visibly across a live session; a no-hint pass raises mastery more than a hinted pass.

---

## 2. TIER 1 — BUILD NEXT (demo + design points)

| # | Feature | Earns | Effort | Why it matters |
|---|---|---|---|---|
| **F11** | **Learner UI** — challenge list, code editor, submit, visible results, explanation, hint button, mastery bars | design/completeness | 2h | The judges *use* your interface in the slot |
| **F12** | **Learner timeline / dashboard** — per-concept mastery + recurring mistakes + "why this challenge" | design | 1h | The wow beat: *"you keep making X across 3 challenges"* |
| **F13** | **Hint Ledger** — browsable log of every prompt + response | **rules requirement + trust** | 45m | Turns compliance into your best demo feature |
| **F14** | **Taxonomy one-pager** + a **judges' landing page** (4 judge challenges as one-click "Try it", red-team button) | deliverable + design | 1h | Judges verify themselves instead of asking |
| **F15** | **One-command start + deploy** — `npm run dev` seeds everything; live URL up by 20:00 | **hard requirement** | 1h | "Endpoints reachable from the start of judging" |

**Seed data (do this, it sells itself):** a learner `rohan` with ~11 prior submissions whose history shows a real recurrence, so the dashboard is meaningful **the second judges arrive.**

---

## 3. TIER 2 — ONLY IF YOU'RE AHEAD (cut first)

- Live re-run animation · diff viewer · spaced-repetition scheduler · challenge generator (LLM-authored) · multilingual UI · auth/accounts · PostgreSQL (use SQLite/in-memory) · Docker

---

## 4. 🔴 THE 12-LABEL CORPUS (build first — it's fully knowable)

3 challenges × 4 programs. **This is 12 free points you can bank tonight.**

| # | Challenge | Program behaviour | Expected label |
|---|---|---|---|
| 1 | `last_k_total` | correct | `passed` (all tests) |
| 2 | `last_k_total` | returns `total-1` | `wrong_output` |
| 3 | `last_k_total` | `marks[i]` without guard, k>len | `runtime_error` |
| 4 | `last_k_total` | `while True: pass` | `timeout` |
| 5 | `count_passes` | correct | `passed` |
| 6 | `count_passes` | `> 40` instead of `>= 40` | `wrong_output` |
| 7 | `count_passes` | iterates `range(1,len(m))` | `wrong_output` or `runtime_error` (assert per your impl) |
| 8 | `count_passes` | infinite recursion | `timeout` |
| 9 | `first_n_squares` | correct | `passed` |
| 10 | `first_n_squares` | `print` instead of `return` | `runtime_error`/`wrong_output` per contract — **pin your expected label and make the classifier agree** |
| 11 | `first_n_squares` | `n+1` loop bound | `wrong_output` |
| 12 | `first_n_squares` | allocates huge list then loops | `timeout` |

> ⚠️ Where the statement's contract is ambiguous (row 10), **your classifier and your corpus must agree** — the judges' T2 expects the label your contract implies. Decide it once, document it.

**Acceptance:** `node harness/labels.ts` prints **12/12**.

---

## 5. 🔴 THE 15 HOSTILE PROGRAMS (T1) — build defenses now

The statement lists the categories. **Enumerate them so nothing surprises you at 08:00.**

| # | Hostile program | Category | Expected result |
|---|---|---|---|
| 1 | `open('/etc/passwd').read()` | files/secrets | `runtime_error`, no content in response |
| 2 | `print(os.environ)` | secrets | no env values returned |
| 3 | `open('../../challenge.json')` | test-file theft | `runtime_error` — no test file exists on disk |
| 4 | `import socket; socket.create_connection(('1.1.1.1',80))` | network | `runtime_error` (no sockets in sandbox) |
| 5 | `urllib.request.urlopen('http://x')` | network | `runtime_error` |
| 6 | `while True: pass` | infinite loop | `timeout` |
| 7 | `def f(): f()\nf()` | recursion bomb | `runtime_error` (RecursionError) or timeout |
| 8 | `x = bytearray(10**10)` | memory | `runtime_error` "memory limit" |
| 9 | `print('A'*10**7)` | output flood | `runtime_error` "output limit" |
| 10 | `open('big','w').write('x'*10**9)` | disk flood | `runtime_error` "disk limit" |
| 11 | `for i in range(99999): os.fork()` | processes | `runtime_error` (RLIMIT_NPROC) |
| 12 | `import shutil; shutil.rmtree('/tmp')` | destructive | contained |
| 13 | `import sys; print(sys.argv, open(__file__).read())` | **harness trick** | no harness source exposed |
| 14 | `import builtins; builtins.print = lambda *a: os._exit(1)` | **harness trick** | contained; **server stays up** |
| 15 | `raise SystemExit("kill the parent")` / kill own pgid | process-group trick | contained; next submit works |

- [ ] After **every** hostile program, a **known-good program must still pass** — that's part of T1
- [ ] **The server must never die.** Any crash = the whole test is lost

**Acceptance:** `node harness/redteam.ts` → all 15 contained, 0 reported `passed`, server alive, next good submit green.

---

## 6. 🧪 THE 11-PROGRAM SCRIPTED LEARNER (T5) — design it yourself

You must produce a fixture where **2 mistakes are planted recurring** and **1 one-off** must be ignored.

| Program | Challenge | Injected fault | Purpose |
|---|---|---|---|
| 1 | `count_passes` | correct | mastery pass, no hint |
| 2 | `last_k_total` | `unhandled_short_input` | **plant #1, occurrence 1** |
| 3 | `last_k_total` | hint requested ×2 | ladder advances |
| 4 | `last_k_total` | still wrong | still tag #1 |
| 5 | `first_n_squares` | `unhandled_short_input` (n=0 path) | **plant #1 → NOW RECURRING** ✅ |
| 6 | `first_n_squares` | `boundary_comparison` (n=0 vs 1) | **plant #2, occurrence 1** |
| 7 | `first_n_squares` | hint ×1 | — |
| 8 | `middle_three` | `print_not_return` | **one-off — must NOT be flagged** ⚠️ |
| 9 | `middle_three` | correct | recovery |
| 10 | `last_k_total` | `boundary_comparison` (k==len) | **plant #2 → NOW RECURRING** ✅ |
| 11 | `last_k_total` | correct | pass |

**Expected `GET /api/learner/rohan`:**
```json
{
  "recurring_mistakes": ["unhandled_short_input", "boundary_comparison"],
  "mastery": { "lists_indexing": 0.61, "loops_range": 0.42, "boundaries": 0.28 },
  "next_challenge": {
    "challenge_id": "rotate_left",
    "reason": "boundary_comparison has now appeared in 2 different challenges. This one is built entirely around the boundary between k and len(items)."
  }
}
```

**Acceptance:** exactly those 2 recurring; `print_not_return` absent; `next_challenge.reason` non-empty and references a recurring tag.

---

## 7. DATA MODEL (keep it boring)

```ts
Challenge  { id, title, difficulty(1-3), concepts[], description, starter_code,
             visible_tests[], hidden_tests[] }        // hidden_tests: server memory only
Submission { id, learner_id, challenge_id, code, results[], mistake_tags[],
             explanation, hint_count, created_at }
Hint       { submission_id, index, text, prompt, response }   // prose-only, enforced
Learner    { id (pseudonymous), mastery{concept:number}, history[], recurring[] }
EventLog   { ts, prompt, response, model }            // the Hint Ledger
```

- [ ] **No real student data.** Seed learners: `rohan`, `meera`, `kabir`
- [ ] SQLite or in-memory — **no Postgres tonight**

---

## 8. ✂️ THE CUT LIST (do not build these)

| Cut | Why |
|---|---|
| Multiple learner languages | Spec says **one**; Python only |
| User accounts / auth | Pseudonymous IDs are enough |
| Payments / tiers / pricing page | Business model is a **slide**, not a sprint |
| Real LLM fine-tuning | Any API is allowed; log it |
| Leaderboards / gamification | No test rewards it |
| Mobile app | Desktop judges only |
| Docker / k8s | One command is the requirement, not one container |

---

## 9. MILESTONES TONIGHT

| Time | Milestone | Gate |
|---|---|---|
| **16:30** | **Pyodide proven** (runs · times out · can't open a file) | 🚦 *if failed → switch to fallback now* |
| 17:30 | F1 runner + F2 classifier skeleton | 🚦 *swap fallback if needed* |
| **18:30** | **Eval 1** — show architecture + isolation | |
| 19:30 | **12/12 labels** (§4) | 🚦 scoring-critical |
| 20:30 | 4 judge challenges + 10-challenge bank live | |
| **21:00** | **Harness run #1 — T1+T2 green** | 🚦 *everything red = tonight's backlog* |
| 22:00 | F7 detectors + F5 API contract sealed | |
| **23:00** | **🔒 GATE LOCK — feature freeze, deploy, commit** | 🚦 *nothing new after this* |

> **Run the harness at 21:00, 07:30, 12:00.** Those three runs are how you know your score before the judges do.

---

## 10. DEFINITION OF DONE (per feature)

A feature is done when:
1. ✅ Its **acceptance check** above passes
2. ✅ `npm test` (your harness) is **no worse** than before
3. ✅ **`gitleaks detect --source .`** is clean
4. ✅ **Committed with a timestamped message** — `git commit -m "T19:30: 12/12 labels"`
5. ✅ One line added to the README's "what works" list

---

## 11. PITFALLS THAT COST TEAMS THE WIN

| Pitfall | Guard |
|---|---|
| Building UI before the harness exists | Harness first. It **is** the product. |
| Leaking `expected` in a hidden test entry | `hidden[]` = `{test, outcome}` only. Assert it. |
| Counting recurrence per submission | Count **distinct `challenge_id`**. |
| LLM writes code into a hint | Validate at **storage** time, reject. |
| Pyodide is slow on venue Wi-Fi | Cache assets before 18:00; fallback runner ready. |
| One crash during red-team kills the server | Per-submission isolation + try/catch at the route. |
| New features after 10:00 tomorrow | Scope lock. Ideas go on the "next" slide. |
| No commits for 6 hours | Every 30 min. History is your alibi. |
| Sleep 0 hours | Sleep 2 shifts. You present at 15:30. |

---

> **Tonight's whole job, in one line:** make the 6 judge tests pass, then make them look beautiful.
>
> **First command, right now:** `npm i pyodide && node -e "prove it runs, times out, can't open a file"`