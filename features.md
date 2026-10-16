# 🛠️ DEBUG DOJO — features.md (the complete build spec)

> **DI-01 · "A coding coach that helps you find the bug without handing you the answer."**
> **Scored out of 100 points** · Full statement text in `dojo.md` · Event rules in `README.md`

---

# 0. THE SCORING TABLE — the most important page in this file

This is exactly how you are scored. Every feature in this document exists to win a specific line of this table.

| # | Component | Points | How it is judged |
|---|---|---|---|
| 1 | **Sandbox red-team** | **15** | *Share of hostile programs contained* |
| 2 | **Outcome labels + hidden-test secrecy** | **15** | *Exact labels; no leak of hidden tests* |
| 3 | **Hint leakage** | **10** | *Merged hint code never passes all hidden tests* |
| 4 | **Recurring mistakes + skills** | **10** | *Scripted learner result; mastery moves with the evidence* |
| 5 | **Explanations + hints** | **15** | *Blind judge ratings* (0–2 × 2 judges × 5 failures) |
| 6 | **Learning experience** | **15** | *"Would a struggling beginner use it, and learn rather than copy?"* |
| 7 | **Technical depth + viva** | **20** | *"Explains the isolation, the test harness, the hint guardrails and the learner model — without notes"* |
| | **TOTAL** | **100** | |

### The four hand-ins (by the freeze)
1. **Repo + README + one command that starts everything**
2. **Live URL, or a laptop judges can use, with the API endpoints reachable from the start of judging**
3. **Mistake taxonomy + how each category is detected — on one page**
4. **5-minute demo, then a viva**

---

# 1. HOW EACH COMPONENT IS WON

| Component | Pts | What actually earns it | Features |
|---|---|---|---|
| **Sandbox red-team** | 15 | ~15 hostile programs contained, none reported `passed`, **server stays up**, no secret/test file exposed, next normal submit works | **F1** runner · **F2** kill/label · **F4** parent-memory |
| **Outcome labels + secrecy** | 15 | 12/12 labels exact + zero hidden values ever reaching the learner | **F2** classifier · **F3** challenge bank · **F4** · **F5** API contract |
| **Hint leakage** | 10 | Merge all hint code into learner code → **still fails ≥1 hidden test** | **F6** prose-only ladder |
| **Recurring + skills** | 10 | Scripted learner: both planted mistakes named, one-offs not, next challenge targets a recurring one **with a reason**; mastery moves with evidence | **F7** detectors · **F8** recurrence · **F10** mastery |
| **Explanations + hints** | 15 | 2 blind judges rate 5 failures: **correct · specific · not-giveaway** | **F9** explanations · **F6** ladder quality |
| **Learning experience** | 15 | Would a *struggling beginner* actually use it and **learn rather than copy**? | **F11–F17** + **OB1–OB3** |
| **Viva (no notes)** | 20 | Explain 4 things cold: isolation, test harness, hint guardrails, learner model | **Memorisation plan (§8)** + real depth behind F1/F4/F6/F7/F10 |

### Point-budget sanity check
- **Code-only features (F1–F10) can earn ~65 points.** That is the floor you must clear.
- **Learning experience (15) + viva (20) = 35 points require deliberate, scheduled work.** Nobody gets these by accident.
- **Out-of-the-box features (OB1–OB3) exist to win the 35 "experience + depth" points** faster and more visibly than a plain product can.

---

# 2. THE 35 POINTS MOST TEAMS THROW AWAY

## 2.1 Learning experience — 15 points
Judged by one question: **"would a struggling beginner use it, and learn rather than copy?"**

Judges will ask themselves:
| Question | What makes you pass |
|---|---|
| *Can a beginner actually finish a challenge?* | Clear UI, visible tests, an explanation in human words |
| *Does it feel encouraging, not shaming?* | Language like *"not quite — look at line 2"*, never *"you're wrong"* |
| *Does it stop them copying?* | The answer is genuinely unavailable — and they can feel it |
| *Will they come back tomorrow?* | Visible progress, a reason for the next challenge, a streak |
| *Does it teach, or just grade?* | Explanation + hint + the mistake's *why*, not a verdict |

**The differentiator:** most teams build a grader with hints attached. **You build a teacher.** The evidence is in §5 + §6.

## 2.2 Technical depth + viva — 20 points, *without notes*
This is the single biggest line item, and it is won in **rehearsal**, not in code. §8 gives you the four things to memorise, word for word.

---

# 3. COMPLETE FEATURE MAP

| ID | Feature | Points | Effort | Tier |
|---|---|---|---|---|
| **F1** | Safe sandbox runner (Pyodide + rlimits + process-group kill + fallback) | 15 (red-team) | 2.5h | 0 |
| **F2** | Outcome classifier (4 labels, names the limit) | 15 (labels) | 1h | 0 |
| **F3** | Challenge bank (≥10, 3 levels, 4 concepts, 3 visible + 5 hidden) | 15 · 10 | 2h | 0 |
| **F4** | Parent-memory design (hidden tests never on disk) | 15 (secrecy) + 15 | incl. F1 | 0 |
| **F5** | API contract (`/api/submit`, `/api/hint`, `/api/learner/:id`) | hard req | 1.5h | 0 |
| **F6** | Prose-only hint ladder (validator rejects code) | 10 + 15 | 1.5h | 0 |
| **F7** | Five mistake detectors (deterministic) | 10 | 2h | 0 |
| **F8** | Recurrence + next-challenge-with-reason | 10 | 1h | 0 |
| **F9** | Plain-language explanations (never leak values) | 15 | 1.5h | 0 |
| **F10** | Mastery per concept (no-hint pass > hinted pass) | 10 | 45m | 0 |
| **F11** | Learner UI (challenge → editor → results → hints) | 15 (exp) | 2h | 1 |
| **F12** | Encouraging result screen (counts, kind-not-values, no shaming) | 15 (exp) | 1h | 1 |
| **F13** | Learner dashboard (mastery bars, history, "why this next") | 15 (exp) | 1h | 1 |
| **F14** | Hint Ledger (browsable proof) | trust + demo | 45m | 1 |
| **F15** | Taxonomy one-pager (**required hand-in**) | hand-in | 30m | 1 |
| **F16** | Judges' landing page (4 judge challenges one-click + red-team button) | 15 (exp) + demo | 1h | 1 |
| **F17** | Onboarding + first-success moment + streak | 15 (exp) | 1h | 1 |
| **OB1** | 🗺️ **The Line Map** — bug localised to the exact line | 15 · 20 | 2h | 2 |
| **OB2** | ⏱️ **Time-Travel Replay** — step through execution, see where it breaks | 15 · 20 | 2.5h | 2 |
| **OB3** | 🐛 **Bug Factory** — serve a *deliberately buggy* program built from their recurring mistake | 15 · 20 | 2h | 2 |

---

# 4. TIER 0 — Scoring core (clear these first)

### F1 · Safe sandbox runner
- [ ] **Primary:** Pyodide (Python→WASM) in a Node **worker thread**, spawned as a **child process**
- [ ] Wall-clock timeout → terminate worker + **`killpg` SIGKILL the group**
- [ ] stdout/stderr byte cap (~256 KB) → kill on overflow
- [ ] OS limits via shell wrapper: `sh -c 'ulimit -v 262144; ulimit -t 2; ulimit -f 2048; exec node runner.js'` *(Node has no built-in `setrlimit`)*
- [ ] **Fallback:** `python3 -I -S` subprocess, scrubbed env, cwd = empty temp dir, sockets blocked
- [ ] Returns `{stdout, return_value, exception_type, exception_msg, killed_by, duration_ms}`
- [ ] **The route must never crash the server** — try/catch around every execution

**Acceptance:** `while True: pass` → `timeout`. `open('/etc/passwd')` → `runtime_error`, no content. `bytearray(10**10)` → `runtime_error (memory limit)`. Server alive after all three.

---

### F2 · Outcome classifier (pure function)
```
normal exit + match        → passed
normal exit + differs      → wrong_output
raised / bad exit          → runtime_error   (learner's exception class only)
RLIMIT_AS hit              → runtime_error   "memory limit"
RLIMIT_FSIZE hit           → runtime_error   "output limit" / "disk limit"
RLIMIT_CPU hit             → runtime_error   "cpu limit"
wall-clock exceeded        → timeout
```
- [ ] **Check order:** resource-kill → wall-clock → read output (never let them race)
- [ ] Type-aware comparison (`70` ≠ `"70"` unless the test says string)
- [ ] Every limit-caused `runtime_error` **names the limit**

**Acceptance:** the 12-case corpus (§11.1) → **12/12**.

---

### F3 · Challenge bank
- [ ] **≥10 challenges · ≥3 difficulty levels · ≥4 concepts**
- [ ] Each: description · starter code · concept tags · **≥3 visible · ≥5 hidden (with edge cases)**
- [ ] **The 4 judge challenges exactly:** `last_k_total(marks,k)` · `count_passes(marks)` · `first_n_squares(n)` · `middle_three(items)`
- [ ] **Hidden tests in server memory only — never written to a file the child can read**
- [ ] Concepts: lists/indexing · loops/range · boundaries/conditionals · strings · accumulators
- [ ] Credit adapted Exercism (MIT) / MBPP (CC BY 4.0) / HumanEval (MIT) content

**Acceptance:** all 4 judge challenges present by id; ≥10 challenges with correct metadata.

---

### F4 · Parent-memory design ⭐
```
PARENT: hidden tests (inputs + expected) in MEMORY ONLY
        sends INPUTS ONLY to child → compares results itself
CHILD:  gets code + inputs. No expected values. No test file. No host FS.
```
- [ ] Child never receives an expected value
- [ ] Child's filesystem contains nothing from the challenge definition
- [ ] Comparison happens in the parent
- [ ] **The harness source has no route from child to parent memory**

**Acceptance:** a hostile program cannot produce a hidden value — because it was never given one.

---

### F5 · API contract
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
> 🔑 **`hidden[]` = `{test, outcome}` ONLY.** No `call`, no `expected`, no `got`, no exception text.

**`POST /api/hint`** `{submission_id}` → `{hint_index, hint, remaining}`
**`GET /api/learner/{learner_id}`** → `{recurring_mistakes, mastery, next_challenge:{challenge_id, reason}}`

- [ ] All three **reachable from the start of judging**
- [ ] `submission_id` returned on every submit
- [ ] Automated assert: **no hidden string in any response body**

---

### F6 · Prose-only hint ladder
- [ ] **Validator at storage time** — reject hints containing ```` ``` ````, `def `, `=`, `()`, `import`, `return`
- [ ] Escalation: nudge → specific → mechanism → name a builtin (`max`), never its use
- [ ] *"Give me the answer"* → **still escalate one rung**, never collapse
- [ ] Re-submission after hint N resumes at N+1
- [ ] Ship the statement's model ladder verbatim for `last_k_total`

**Acceptance:** merge all hint code into learner code → **still fails ≥1 hidden test.**

---

### F7 · Five detectors (deterministic, no LLM guessing)
| Category | Rule | Unit test |
|---|---|---|
| `unhandled_short_input` | `IndexError`/`TypeError` **and** input shorter than contract | `det_short_input` |
| `print_not_return` | printed correct value, returned `None` | `det_print_not_return` |
| `mutates_input` | input mutated after call, or 2nd call differs | `det_mutates_input` |
| `off_by_one` | differs by exactly **±1**, failing input **not** at a boundary | `det_off_by_one` |
| `boundary_comparison` | differs by ±1 **and** input **is** at an edge (`k==len`, `k>len`, `n==0`, `len<3`, empty) | `det_boundary_cmp` |

- [ ] Keep all five **distinct**
- [ ] Detect from **exception type + input shape** — never from expected output
- [ ] Optional 6th: `wrong_index_direction`
- [ ] **Hand-in:** the one-page taxonomy

---

### F8 · Recurrence + next challenge
- [ ] Tags rolled up across submissions by `learner_id`
- [ ] **Recurring = same tag in ≥2 DIFFERENT `challenge_id`s** *(5 failures of one challenge = 1, not 5)*
- [ ] **One-off slips never flagged recurring**
- [ ] Next challenge targets a recurring mistake **and says why**
- [ ] Nothing recurring → next challenge by weakest concept

**Acceptance:** the 11-program fixture (§11.3) → exactly the 2 planted recurring mistakes, no one-offs, non-empty reason.

---

### F9 · Plain-language explanations
- [ ] One LLM call per failing submission → 2–4 sentences
- [ ] **Name the kind of input, never the values** ✅ *"a case where k is larger than the list"* ❌ *"when k=7 and marks=[3]"*
- [ ] **Log every prompt + response** → F14 Ledger
- [ ] Seed a strong template per mistake category for cold-start quality
- [ ] **Self-rate:** 4 teammates score 5 explanations 0–2 on *correct · specific · not-giveaway*. **<1.5 → rewrite**

---

### F10 · Mastery per concept
```
α=1, β=1
pass, no hints   → α += 1.0
pass, with hints → α += 0.35     ← the penalty is the point
fail             → β += 0.6
hint given       → β += 0.15
mastery = α / (α + β)
```
- [ ] Keyed by concept tags · visible in `GET /api/learner` · explainable in 10 seconds
- [ ] Drives "next challenge" when nothing is recurring

---

# 5. TIER 1 — Learning experience (15 points)

### F11 · Learner UI
Challenge list → challenge page (description, starter code, editor, **Submit**, **Hint**) → result screen.
- [ ] A beginner can finish a challenge **without asking for help** — that is the test

### F12 · Encouraging result screen ⭐ *(this is where "learn rather than copy" is won)*
- [ ] Plain counts: *"3 visible passed · 3 hidden failed"* — never a red wall of text
- [ ] Name the **kind** of failing input, never values
- [ ] Encouraging voice: *"You're close — this is one boundary case"*, never *"wrong"*
- [ ] Always offer a **next action**: retry · hint · related concept
- [ ] Mistake tag shown as a **badge**, not a verdict

### F13 · Learner dashboard
- [ ] Mastery bars per concept
- [ ] History timeline: what you tried, what changed
- [ ] **"Why this challenge for you"** card (from F8)
- [ ] A visible *"you improved"* moment (mastery delta since first attempt)

### F14 · Hint Ledger
- [ ] Browsable list of every prompt + response, filterable by learner/submission
- [ ] A visible **"code detected" rejection count** — *proof the guardrail fires*
- [ ] Turns a compliance rule into your most convincing demo artefact

### F15 · Taxonomy one-pager (**required hand-in**)
`category → detection rule → example buggy program → unit test name`, printable.

### F16 · Judges' landing page
- [ ] The **4 judge challenges as one-click "Try it"** buttons
- [ ] A **"Break it"** button with a preset hostile program
- [ ] Links: Hint Ledger · taxonomy · the isolation diagram
- [ ] Lets judges verify themselves instead of asking you

### F17 · Onboarding + first success + streak
- [ ] 30-second start: pick level → first challenge
- [ ] Engineer a **first win in under 3 minutes**
- [ ] Never let a beginner's first screen be an error
- [ ] A gentle "come back tomorrow" nudge with their exact recurring mistake

---

# 6. TIER 2 — THE 3 OUT-OF-THE-BOX FEATURES 🌟

These are not in the statement. They exist to win the **35 experience + depth points** by making the product something a panel has never seen — and they are all built on data you already have.

## OB1 · 🗺️ THE LINE MAP — *"your bug is on line 2"*
**Wins:** Learning experience · Explanations · Viva
**Problem it solves:** a plain-language explanation tells the learner *what* is wrong. It never tells them *where*. So they re-read the whole function and guess.

**What it does:** after a failure, **annotate their actual code inline** — highlight the culprit line(s) and attach a short reason to each.
```
1  def last_k_total(marks, k):
2      total = 0
3 ▸    for i in range(len(marks) - k, len(marks)):   ← starts negative when k > len(marks)
4          total += marks[i]
5      return total
```
- [ ] Parse the learner's code with Python's `ast` (run inside the sandbox) → map failing behaviour to a line
- [ ] Confidence indicator (**"likely" / "very likely"**) — honest, not magical
- [ ] **Never** reveals hidden values — only *their own* code and the *kind* of input
- [ ] Click a line → jumps to the matching hint rung

**Why it's out-of-box:** every other coding tutor gives a paragraph. **This gives a map.** It is the literal *"point him to the right place to look"* from the statement's own story, made visual.

---

## OB2 · ⏱️ TIME-TRAVEL REPLAY — *"see the exact moment it breaks"*
**Wins:** Learning experience · Technical depth · Demo
**Problem it solves:** a beginner's mental model of a loop is usually wrong. Telling them "line 3 is wrong" doesn't help if they don't see the negative index.

**What it does:** a step-through visualisation of their code's execution — variable values at each iteration — with **the first wrong step marked**.
```
step 3   i = -2   marks[-2] = 30   total = 30   ← first wrong value
step 4   i = -1   marks[-1] = 40   total = 70
step 5   i = 0    marks[0]  = 10   total = 80   ← over-counted
```
- [ ] Instrument the sandbox: capture local variable values per step (trace hook)
- [ ] Only **their own** runtime values — **never** an expected value (**T3 stays safe**)
- [ ] Timeline scrubber; click any step to inspect
- [ ] "Slow mode" — step through one iteration at a time

**Why it's out-of-box:** it turns *"kya galat hai"* into *"maine dekha kaise galat hota hai"* — the exact moment the statement says learning sticks. **It is also the single most demo-able thing you will build.**

---

## OB3 · 🐛 BUG FACTORY — *"find the bug, don't write the code"*
**Wins:** Learning experience · Recurring mistakes · Differentiation
**Problem it solves:** writing a function from scratch is hard; *finding* one bug is a learnable, focused skill — and it's literally what the product is named after. But practice sites only ever ask you to write.

**What it does:** the system **serves a deliberately buggy program — generated from that learner's own recurring mistake** — and asks them to locate and fix it.
```
🐛 Bug Factory — you keep hitting: boundary_comparison
Find the bug and fix it.
    def count_passes(marks):
        if m > 40:              ← hint: the boundary is 40 itself
            return 1
        return 0
```
- [ ] Generate the buggy program from the learner's **top recurring tag** (template per category)
- [ ] "Find it" mode (click the wrong line) **and** "Fix it" mode (edit the code)
- [ ] Confirm the bug is actually found, then ask for the fix
- [ ] Counts as a real challenge — feeds mastery and recurrence
- [ ] Satisfies *"choose **or generate** the next challenge"* from the statement

**Why it's out-of-box:** it inverts the practice loop, it is **personalised by construction**, and it attacks the exact mistake the learner keeps making. Nobody else will have a *Bug Factory*.

---

### How the three compose into one demo beat
> Submit → **Line Map** points at the line → **Time-Travel** shows the wrong step → **Bug Factory** serves the next problem built from that mistake → dashboard shows mastery rising.
>
> That single 60-second arc is what a "Learning experience" judge is looking for.

---

# 7. TIER 3 — Only if you are ahead

- Concept belt/rank system (bronze → black belt per concept) · spaced-repetition scheduler · cohort/teacher heatmap · multilingual UI · PostgreSQL · Docker

---

# 8. THE 4 THINGS TO MEMORISE FOR THE VIVA (20 points, *without notes*)

The statement says you must explain **these four, without notes**. Rehearse until you can say each in 30 seconds. Write them out, say them aloud, film yourself.

### 1️⃣ "Explain your isolation."
> *"Learner code never runs on the host. It runs inside Pyodide — CPython compiled to WebAssembly — in a worker thread inside a child process. Because it's WebAssembly, the sandbox has no real filesystem, so file and secret attacks fail by construction, not by filtering. On top of that I apply OS limits — address space, CPU, file size, process count — through a `ulimit` wrapper, and kill the whole process group on wall-clock timeout. Two independent layers."*

### 2️⃣ "Explain your test harness."
> *"Six tests, and I built the harness first so I could run the judges' own checks on myself: fifteen hostile programs that must all be contained with the server staying up; twelve label cases — four behaviours across three challenges — that must all be labelled exactly; a secrecy assertion that no hidden value ever appears in any response; a hint-leakage test where merging all hint code still fails a hidden test; an eleven-program scripted learner that must surface exactly the two planted recurring mistakes; and my own team blind-rating five explanations. I run the whole harness at 21:00, 07:30 and 12:00, so I know my score before I present it."*

### 3️⃣ "Explain your hint guardrails."
> *"No hint may contain code — and that's enforced, not requested. A validator inspects every hint at storage time and rejects anything containing a fence, a `def`, an assignment, a call, or an import. So 'the AI never gave the answer' is a property the system cannot violate. The ladder escalates — nudge, then specific, then mechanism, then naming a builtin like `max` — and if the learner asks for the answer directly, it still advances one rung instead of collapsing. And every prompt and response is logged, so it's auditable."*

### 4️⃣ "Explain your learner model."
> *"Two parts. Mastery is a Beta posterior per concept — a pass with no hints moves α by one, a pass after hints only 0.35, a fail moves β, and every hint costs a little. That's why an unhinted pass counts for more. Recurrence is counted across *different* challenge IDs, not across submissions — so failing the same problem five times is one data point, not five. And the next challenge is chosen to target the learner's top recurring mistake, with the reason shown, which closes the loop from diagnosis to practice."*

**Rehearsal rule:** say all four **out loud, from memory, standing up, in under 2 minutes total.** Do it before every demo. The last hour before Round 2 is for *this*, not for new code.

---

# 9. PRODUCT + TECHNOLOGY

| Layer | Use | Why |
|---|---|---|
| Platform | **TypeScript / Node 26** | Already installed |
| Server | **Fastify** (+ `@fastify/static`) | JSON-schema validation → the judges' exact shape validates itself |
| Sandbox | **Pyodide** (npm) | Python→WASM; **no real filesystem** → red-team fails by construction |
| Sandbox control | `worker_threads` + `child_process` + `sh -c 'ulimit …'` | Hard terminate + OS limits (Node has no `setrlimit`) |
| Code analysis | Python **`ast`** inside the sandbox | Powers **OB1 Line Map** |
| Trace | Python **`sys.settrace`** / trace hook inside sandbox | Powers **OB2 Replay** |
| Frontend | **Plain HTML + vanilla JS** in `public/` | No build step, no CORS, one URL |
| Editor | `<textarea>` → CodeMirror later | Get tests green first |
| LLM | Any API (Anthropic / Gemini / Groq) | *"any model or API is fine"* |
| Storage | In-memory + JSON file persistence | Postgres is a distraction tonight |
| Harness | Plain Node scripts with `assert` | No test framework needed |
| Public URL | **ngrok** (installed ✅) + laptop backup | Free, instant |
| Source | git, commit every 30 min | Judges read history |

> ⚠️ **Claude Pro ≠ API credits.** You need an API key for explanations/hints (T6, 15 pts). Free options: Gemini AI Studio or Groq. **Test one real explanation tonight** — without it, 15 points are zero.

---

# 10. DATA MODEL

```ts
Challenge  { id, title, difficulty, concepts[], description, starter_code,
             visible_tests[], hidden_tests[] }      // hidden: server memory ONLY
Submission { id, learner_id, challenge_id, code, results[], mistake_tags[],
             explanation, hint_count, created_at }
Hint       { submission_id, index, text, prompt, response, rejected_for_code }
Learner    { id, mastery{}, history[], recurring[] }
EventLog   { ts, prompt, response, model, rejection_count }
BugSeed    { mistake_tag, buggy_code, culprit_line, hint }
```

- [ ] Pseudonymous learners only (`rohan`, `meera`, `kabir`) — **no real student data**
- [ ] JSON file persistence; no database

---

# 11. SELF-TEST HARNESS SPECS

## 11.1 The 12-label corpus
| # | Challenge | Behaviour | Expected |
|---|---|---|---|
| 1 | `last_k_total` | correct | `passed` |
| 2 | `last_k_total` | returns `total-1` | `wrong_output` |
| 3 | `last_k_total` | unguarded index, k>len | `runtime_error` |
| 4 | `last_k_total` | `while True: pass` | `timeout` |
| 5 | `count_passes` | correct | `passed` |
| 6 | `count_passes` | `> 40` not `>= 40` | `wrong_output` |
| 7 | `count_passes` | `range(1, len(m))` | pin + assert |
| 8 | `count_passes` | infinite recursion | `timeout` |
| 9 | `first_n_squares` | correct | `passed` |
| 10 | `first_n_squares` | prints instead of returns | **pin your contract, make classifier agree** |
| 11 | `first_n_squares` | `n+1` bound | `wrong_output` |
| 12 | `first_n_squares` | huge alloc then loop | `timeout` |

## 11.2 The ~15 hostile programs (red-team, 15 pts)
| # | Program | Category | Must be |
|---|---|---|---|
| 1 | `open('/etc/passwd').read()` | secrets | `runtime_error`, no content |
| 2 | `print(os.environ)` | secrets | nothing leaked |
| 3 | `open('../../challenge.json')` | test theft | no such file exists |
| 4 | `socket.create_connection(...)` | network | no sockets |
| 5 | `urllib.request.urlopen(...)` | network | no network |
| 6 | `while True: pass` | infinite loop | `timeout` |
| 7 | recursive self-call | recursion | `runtime_error`/timeout |
| 8 | `bytearray(10**10)` | memory | "memory limit" |
| 9 | `print('A'*10**7)` | output flood | "output limit" |
| 10 | write 1 GB file | disk flood | "disk limit" |
| 11 | `os.fork()` × 99999 | processes | RLIMIT_NPROC |
| 12 | `shutil.rmtree(...)` | destructive | contained |
| 13 | `open(__file__).read()` | harness trick | no source exposed |
| 14 | monkeypatch `print` → `os._exit(1)` | harness trick | contained, **server up** |
| 15 | kill own process group | process trick | contained |

**After every one: a known-good submission must still pass. The server must never die.**

## 11.3 The 11-program scripted learner (10 pts)
| # | Challenge | Fault | Purpose |
|---|---|---|---|
| 1 | `count_passes` | correct | mastery pass, no hint |
| 2 | `last_k_total` | `unhandled_short_input` | **plant A – 1st** |
| 3 | `last_k_total` | hint ×2 | ladder advances |
| 4 | `last_k_total` | still wrong | plant A again |
| 5 | `first_n_squares` | `unhandled_short_input` | **plant A → RECURRING** ✅ |
| 6 | `first_n_squares` | `boundary_comparison` | **plant B – 1st** |
| 7 | `first_n_squares` | hint ×1 | — |
| 8 | `middle_three` | `print_not_return` | **one-off → must NOT be flagged** ⚠️ |
| 9 | `middle_three` | correct | recovery |
| 10 | `last_k_total` | `boundary_comparison` | **plant B → RECURRING** ✅ |
| 11 | `last_k_total` | correct | pass |

**Expected:** `recurring_mistakes: ["unhandled_short_input","boundary_comparison"]`, `print_not_return` absent, `next_challenge.reason` non-empty and naming a recurring tag.

---

# 12. DELIVERABLES CHECKLIST (the four hand-ins)

| # | Hand-in | Status |
|---|---|---|
| 1 | Repo + README + **one command** (`npm install && npm run dev`) | ☐ |
| 2 | **Live URL** (ngrok) **or a laptop** with all three endpoints, up **before judging starts** | ☐ |
| 3 | **Taxonomy one-pager** — category, detection rule, example, test name | ☐ |
| 4 | **5-min demo + viva** — including the 4 memorised answers (§8) | ☐ |

---

# 13. ✂️ CUT LIST

| Cut | Why |
|---|---|
| Multiple learner languages | Spec says **one** — Python only |
| Auth / accounts / passwords | Pseudonymous IDs are enough |
| Payments, tiers, pricing page | Business model is a **slide**, not a sprint |
| Model fine-tuning | Any API is allowed; just log it |
| Leaderboards / social feed | No points |
| Mobile app | Judges use a desktop browser |
| Docker / Postgres / Redis | One command is the requirement |
| Fancy animation | Polish the 70 code points first |

---

# 14. DEFINITION OF DONE (every feature)

1. ✅ Its **acceptance check** passes
2. ✅ `node harness/*.mjs` is **no worse** than before
3. ✅ `gitleaks detect --source .` clean
4. ✅ **Committed with a timestamp** — `git commit -m "T21:00: 12/12 labels"`
5. ✅ One line added to the README's "what works" list

---

# 15. HOW THE 100 POINTS ARE WON — one page to memorise

| Pts | Component | Won by |
|---|---|---|
| **15** | Sandbox red-team | WASM sandbox + OS limits + killpg + never crash |
| **15** | Labels + secrecy | Deterministic classifier + **hidden tests in parent memory** |
| **10** | Hint leakage | Prose-only validator enforced at storage time |
| **10** | Recurring + skills | 5 detectors + recurrence across **distinct** challenges + Beta mastery |
| **15** | Explanations + hints | Plain-language, kind-not-values, blind-rated ≥1.5 |
| **15** | Learning experience | Encouraging UI + Line Map + Replay + Bug Factory + "why this next" |
| **20** | Technical depth + viva | The 4 memorised answers (§8), said cold |

> **Build order that respects the points:** `F1→F2→F3→F4→F5` (30 pts) → `F6` (10) → `F7→F8→F10` (10) → `F9` (15) → **`F11–F17 + OB1–OB3` (15)** → **rehearse §8 (20)**.

---

> *"Rohan never needed the answer. He needed someone to point him to the right place to look."*

**OB1 points at the place. OB2 shows why. OB3 makes him stop doing it. F6 makes sure he never gets the answer.** 🏆