# Layerflow: Teaching Beginners to Debug Instead of Copy

**A white paper by Team Layerflow** · Kurukshetra 2026 · Problem statement **DI-01 "Debug Dojo"** (Decentralized Intelligence) · v1.0 · 17 October 2026

> *"Answer milna problem nahi hai — answer bahut jaldi mil jaana problem hai."*
> The problem isn't that beginners can't get answers. It's that they get them too fast.

---

## Abstract

Beginner programmers today are rarely stuck because help is missing. They are stuck because the help they reach for hands over the finished code, so the skill never forms. **Layerflow** is a Python practice platform built on one rule: **we point, you fix** (*hum point karte hain, aap fix karte ho*). It runs a learner's code in a four-layer sandbox, labels every test honestly, explains failures in plain words **without ever revealing a hidden test**, gives hints that get sharper but **never contain code**, and notices which mistakes *keep coming back* across different problems so it can choose the next problem with a reason. Around that core we built the support a struggling beginner actually needs: a mentor you can call (**Priya**, in a Google-Meet-style room, who presents an animated replay of your own code), an assistant on every page, an architecture reviewer for your real projects, a community where teachers mentor, and a rewards and bug-bounty track that turns consistency into points and real security skills. Our automated harness runs the jury's six checks plus two of our own on every build: 15/15 hostile programs contained, 12/12 labels exact, 0 hidden-test leaks across 896 responses, and 36/36 unit tests passing.

## 1. The problem

DI-01 tells the story of Rohan: his code passes every visible example, fails hidden tests he cannot see, and what he needs is *"someone to point him to the right place to look."* Three failure modes of today's tools make that hard:

1. **Answers arrive too early.** General AI assistants rewrite the function on request. The learner submits, it passes, and the next problem with the same trap fails again.
2. **Feedback is a verdict, not a diagnosis.** "Wrong Answer" plus, often, the exact failing input tells a learner *that* they failed. It doesn't tell them *why*, or that the same mistake has happened three times this week.
3. **Beginners learn alone.** Human mentors don't scale, forums are full of copy-paste solutions, and professional tools (code-quality scanners, bug-bounty platforms) speak in jargon a first-year student can't use.

The jury scores exactly these things: safe execution, honest labels, hidden-test secrecy, hints that don't leak, recurring-mistake detection, explanation quality, learning experience, and technical depth.

## 2. What we built

**2.1 The core: a debugging coach** *(the DI-01 requirements)*

| Capability | How Layerflow does it |
|---|---|
| Run code safely | Pyodide (CPython 3.14 compiled to WebAssembly) in a **fresh disposable process per submission**: Python-level policy, then WebAssembly, then the Node.js permission model with an empty environment, then supervision (wall clock, memory watchdog, output and disk caps). |
| Honest labels | Every test is exactly one of `passed` · `wrong_output` · `runtime_error` · `timeout`, and any limit that stopped it is named. |
| Hidden-test secrecy | Hidden tests live **only in API memory**. The sandbox receives inputs, never expected values. Responses are schema-filtered to `{test, outcome}`, every outgoing sentence passes a leak check, and a database CHECK constraint refuses to store output for a hidden test. |
| Plain-language explanations | *"All 3 visible tests pass, but 3 of the 6 hidden tests fail … All three are cases where k is larger than the number of marks."* It describes the **kind** of input, never its values. |
| Hints, then the answer | **Three hints** (nudge → your line → why it breaks), each written by Groq for the learner's **own code**, so a bug written a different way still gets a hint that fits. A validator **rejects any hint containing code**. "Just give me the answer" moves exactly one hint, never more. **After the third hint, the answer unlocks**: what's wrong in plain words and *your* code with the smallest fix, changed lines highlighted — **run against every visible and hidden test before it's shown**. |
| Mistake taxonomy + recurrence | Five required categories plus an optional sixth (e.g. `unhandled_short_input`, `boundary_comparison`, `print_not_return`). A mistake counts as *recurring* only when it appears in **two different problems**. |
| Mastery + next problem | A Beta-posterior mastery score per concept, where a pass without hints counts for more. The next problem targets the top recurring mistake and **always says why**. |
| Extras | **Line Map** (reads the learner's own code to point at the culprit line) · **Time-Travel Replay** (step-by-step execution on a *safe public input*) · **Bug Factory** (find a planted bug of your own weak type). |

**2.2 Learn together** *(nobody gets stuck alone)*

- **Mentoring.** A Google-Meet-style call with Priya, our AI mentor: a "Ready to join?" lobby, her speaking tile, live captions, mic, camera, raise hand and in-call chat. She explains the result, the line to look at, the mistake's name and a plan, out loud. **✨ Summarise** makes her *present* an animated walkthrough of the learner's own code: the running line lights up, lists become boxes, index variables become pointers that slide (and fall off the end on an `IndexError`), and hidden tests flip in as locked tiles. Priya speaks **English, हिन्दी and मराठी**.
- **Ask Priya.** A chat on every page. On a problem page it knows the problem and the learner's current code. Every AI reply must pass the same no-code, no-leak guard as the hints.
- **Repo & Website Analyse.** Paste a GitHub repo or a website URL and get a health score, the layers your project has or is missing, findings sorted *fix first → polish* (each with the why and the fix), a roadmap, and the target architecture for scaling. Secrets are reported by file and line, **never the value**.
- **Community.** Questions, tips and showcases. Teachers answer with a badge and get a **Teacher desk** showing who needs help and why. Priya gives every new question a first nudge. **Full solutions stay blurred** until you've solved that problem yourself.

**2.3 Earn while you learn** *(why learners come back)*

- **Streak rewards.** 100 points per streak day; 100 points = ₹10. Redeem goodies (stickers to a hoodie, 1,500–12,000 points) or withdraw to UPI from 1,000 points (₹100).
- **Bug Bounty.** Three practice targets, *ShopKart* (shop API), *CampusConnect* (student portal) and *PayLite* (UPI-style wallet), with **16 planted real-world bugs**: SQL injection, IDOR, unverified JWTs, mass assignment, stored XSS, OTP brute force, race-condition double spending and more. Reports are triaged instantly against a secret list. Companies and open-source maintainers can post programs of their own. A narrated explainer teaches what bug bounty is.

## 3. Architecture and guarantees

```
Browser ──/api/*──▶ Next.js 16 (:3000) ──proxy──▶ Fastify 5 API (:4000) ── hidden tests in MEMORY only
                                                     │  code + INPUTS only (never an expected value)
                                                     ▼
                               Runner process — fresh per submission, then discarded
                               node --permission · env = {} · supervisor (time, memory) · Pyodide worker
                                                     │
            SQLite (node:sqlite, WAL, CHECK constraints) ◀── one transaction per submission
            Optional AI (Groq · Gemini · Anthropic) ──▶ guardReply + findLeak ──▶ else the built-in reply ships
```

**Design principles.** (1) *Secret by construction*: a hidden value cannot leak from a process that never received it. (2) *Deterministic first*: every explanation, hint, mentor script and chat reply has a rule-based version, so the product is **complete with zero API keys and works offline**. AI only polishes, and only if it passes the same checks. (3) *Logged*: every prompt and response goes to a Hint Ledger, including drafts the guardrail rejected.

## 4. Evaluation: we run the jury's tests on ourselves

`npm run harness` boots the real product (real API, real sandbox, throw-away database) and runs:

| Suite | Result |
|---|---|
| T1 Sandbox red-team | **15/15** hostile programs + **9/9** extra escape attempts contained; server stays up; the next good submission passes |
| T2 Outcome labels | **12/12** labels exact; every reference solution passes its own tests |
| T3 Hidden-test secrecy | **0 leaks in 896 responses**, 0 in 55 files served to browsers |
| T4 Hint leakage | merge every hint into the learner's code → **4/4 still fail** a hidden test; 0 invalid hints of 20 |
| T5 Recurring mistakes | exactly the 2 planted mistakes flagged; the one-off slip is not; next problem = *Sum of Digits* with a reason |
| T6 Explanations | 5 explanations + 4 hint ladders printed for blind rating; automated floor checks pass |
| T7 Mentor · chat · community · repo *(ours)* | **0/84** chat replies with code, an answer or a hidden value; **0/84** leaking mentor lines; spoilers blurred for non-solvers only |
| T8 Streak · points · bounty · payments *(ours)* | **45/45** checks; bounty secrets never leak |
| Unit tests | **36/36** |

## 5. How we compare

| | AI chat assistants | Practice judges | Code visualisers | AI tutors (no-answer) | Pro tools (code scanners, bounty platforms) | **Layerflow** |
|---|---|---|---|---|---|---|
| Runs your code safely | Partial | ✓ | ✓ | ✗ | n/a | **✓ 4-layer sandbox** |
| Hidden tests stay secret | ✗ | Partial | ✗ | ✗ | n/a | **✓ by construction** |
| Hints that never contain code | ✗ | ✗ | ✗ | ✓ | ✗ | **✓ enforced by a validator** |
| Tracks *recurring* mistakes | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ across problems** |
| Mentor call + visual replay of *your* code | ✗ | ✗ | Partial | ✗ | ✗ | **✓ Meet-style + Summarise** |
| Beginner-friendly project review | Partial | ✗ | ✗ | ✗ | Partial (jargon) | **✓ why + fix + roadmap** |
| Safe bug-bounty practice | ✗ | ✗ | ✗ | ✗ | Partial (experts only) | **✓ 16 planted bugs** |
| Rewards for consistency | ✗ | Partial | ✗ | ✗ | ✗ | **✓ streak → points → ₹** |
| Works with no API key / offline | ✗ | ✗ | ✓ | ✗ | Partial | **✓** |
| Indian languages | Partial | ✗ | ✗ | Partial | ✗ | **✓ English · हिन्दी · मराठी** |

*Based on the publicly documented, typical behaviour of each category as of October 2026. Individual products differ and keep evolving.*

**Our edge in one line:** others either *give* the answer or *grade* the answer. Layerflow **diagnoses the learner**: what went wrong, where, whether it's a habit, and what to practise next. *Galti batao, solution mat do* (show the mistake, not the solution).

## 6. Business model

| Plan | Price | What you get |
|---|---|---|
| **Free** | ₹0, forever | All practice, hints, explanations, replay, community and rewards. Daily limits on the costly parts: 20 Priya chats, 2 mentor calls, 3 repo/website analyses. Beginner bounty program. |
| **Pro** | **₹349 / month** ($4 outside India) | No daily limits, every bounty program, Pro badge. **Prepaid via Razorpay**: each payment adds 30 days, no auto-debit. |
| **Custom** | Talk to us | Colleges and companies, priced per class or team. |
| **Company bug-bounty plans** | Community ₹0 · Starter **₹1,999** · Growth **₹4,999** | A public program page; Starter and Growth unlock a reward pool (10,000 / 30,000 points, i.e. ₹1,000 / ₹3,000 to hunters). |

**Why this works.** Learning itself is never paywalled, and **earning is free on every plan**. We only limit what costs us money (AI calls and analyses). Streak rewards are **capped by design** at ₹10 per learner per day, and company bounty pools are prepaid, so payouts can never exceed revenue. Cash-outs run as an honest demo or a manual UPI queue until payout licensing is in place. Revenue comes from two sides: **students** (Pro) and **organisations** (Custom classrooms + bug-bounty plans), and every bounty program brings in a stream of motivated learners.

## 7. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web | **Next.js 16**, React 19, Tailwind CSS 4, shadcn/ui, motion | Fast, accessible UI; light/dark; en · हिन्दी · मराठी |
| API | **Fastify 5** + TypeScript (run directly by `tsx`) | Response schemas enforce secrecy; one origin, no CORS |
| Sandbox | **Pyodide 314** (CPython 3.14 → WebAssembly), Node.js `--permission`, worker threads | No Docker, no native code, works on any laptop |
| Data | **`node:sqlite`** (WAL, CHECK constraints) | Zero install, one file, constraints as a last line of defence |
| AI (optional) | **Groq** (`gpt-oss-120b`, Whisper), **Gemini** (`3.5-flash-lite`), Anthropic | Free tiers; the first provider that answers wins; always guarded |
| Voice | **ElevenLabs** (`eleven_flash_v2_5`) → browser speech as fallback | Priya sounds real and still works with no key |
| Payments | **Razorpay** Orders + Checkout, HMAC-verified, webhook | India-first, UPI-friendly |
| Testing | Plain `tsx` + `node:assert`: 8 harness suites + unit tests | One command: `npm run harness` |

One command runs everything: `npm install && npm start`. **Node 22.13+ is the only requirement.**

## 8. Roadmap

- **Side-by-side companion app (in development).** A mobile app that sits next to your laptop while you code, bringing the flagship features with you: Priya calls and *Summarise*, streak reminders and rewards, bug-bounty alerts, and community replies.
- **More languages to learn:** JavaScript and Java next, on the same engine (sandbox + taxonomy + hint ladder).
- **Classrooms:** assignments, cohort-level mistake heat-maps and teacher analytics on top of the Teacher desk.
- **Live company programs:** verified organisations, webhooks and licensed payouts for real bug-bounty rewards.

## 9. Conclusion

Layerflow's bet is simple: the fastest way to make a beginner independent is to **never do the thinking for them, and never leave them alone with it either**. The sandbox keeps execution safe, the secrecy design keeps tests honest, the hint validator keeps help from turning into answers, and the recurrence model turns one-off failures into a learning plan. Priya, the community and the rewards make sure the learner keeps coming back. Every claim in this paper is checked by a test that ships with the code.

> *"Seekhna wahi hai jo khud dhoondha ho."* What you find yourself is what you actually learn.

**Try it:** `npm install && npm start` → `http://localhost:3000` (learners) · `/judges` (jury tour) · `npm run harness` (all checks).
