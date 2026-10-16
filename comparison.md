# 🔒 FINAL DECISION — DI-01 · Debug Dojo
### The one page. Do not re-open this decision.

> **Lock:** 16 Oct 2026, ~16:15 IST · **Verified against:** the official **"Decentralized Intelligence Track.pdf"** (31 pp, all 5 DI statements) + the live site + `compare.md` (all 13 statements).
>
> ## ➤ SUBMIT THIS: **DI-01 — Debug Dojo**
> **Track:** Decentralized Intelligence · **Judging:** live demo + judge test pack · **Language:** Python
>
> Form answer, if it asks for one line: **"Decentralized Intelligence — DI-01 Debug Dojo."**

---

## The 3-line defence (if a mentor/organiser asks "why this one?")

1. **It's the only DI statement I can self-score.** DI-01 is judged by a runnable **test pack** (6 concrete tests). No leaderboard to race (DI-04), no Dice baseline to beat (DI-02), no GPU required.
2. **It's the least-picked.** Your friend and every AI's default answer go to DI-06. Teams flinch at DI-01's words — *sandbox, red-team, hidden-test secrecy, taxonomy* — so the field is thin (**crowd ≈ 1**).
3. **It's the only spec that says do one thing perfectly** — *"one programming language your team can support well"* — which is exactly the winning strategy.

---

## Why not the other 4 DI statements (verified from the PDF)

| PS | The blocker (verbatim from the PDF) | Verdict |
|---|---|---|
| **DI-02** NeuroScope 3D | Must hit **Mean Dice within 0.05** of the organisers' baseline on ≥10 held-out cases + affine/anisotropy maths + 8-case failure pack | ❌ research-grade bar, not a 13-hr project |
| **DI-03** LiveSub | Must beat the organisers' **WER/CER baseline** across 4 Indian languages at ≤3s median latency, in a Manifest V3 extension | ❌ baseline + streaming = unwinnable in 13 hrs |
| **DI-04** Chimney Census | **T4 GPU**, 4 GB dataset, leaderboard (mAP@0.5 rotated boxes), "Inspector's Brief" | ⚠️ only if GPU + ≥30% data by 15:00 — else it's a 0 |
| **DI-06** Pay-per-call | Clean & self-verifiable (x402 + testnet USDC) | ⛔ **your friend + every AI already picked it** — saturated |
| **DI-05** | — | **does not exist** (confirmed: 0 mentions in the PDF) |

---

## Why not the other tracks (from `compare.md`)

- **Open (OP-01…06):** panel-judged **and** the terms make TechSummitTrainers the *"sole and exclusive property"* owner of your submission — you cannot publish/share/sell/reuse it. (OP-03 AI Lead Desk is the best raw story/business on the board but this clause kills ownership.)
- **Agentic AI (W-PS-1/2):** only 2 statements → densest field; panel-judged; W-PS-1's live messaging demo has a human-in-the-loop sponsor dependency.

---

## What "winning" means here (the strategy, locked)

> **Maximise expected judge points × probability of finishing × ownership of the result.**

| Test | DI-01 |
|---|---|
| Know my score before judges? | **Yes** (run the test pack) |
| Field thin? | **Yes** (crowd ≈ 1) |
| Can finish + run harness 3× before freeze? | **Yes** (6 testable subsystems) |
| Do I own it? | **Yes** (DI has no sponsor IP clause) |
| Can I move a room with it? | **Yes** — *Rohan*, the judges' own story |

**5 / 5.** → **DI-01.**

---

## The 60-second version (read once, then build)

Build a coach that runs learner Python safely, explains failures in plain language, gives a hint ladder that **never contains code**, detects **recurring** mistake types, and serves the **next challenge that fixes them, with the reason**. Its edge: **hidden tests live only in the server's memory** — the sandbox never receives an expected value, so secrecy and the red-team pass *by construction*. Its proof: a browsable **Hint Ledger** showing no hint ever contained code.

**Full build plan, architecture, timeline, demo script, business model → `dojo.md` + `README-TRACK.md`.**

---

> *"Rohan never needed the answer. He needed someone to point him to the right place to look."*

**Go build it. The decision is closed.**