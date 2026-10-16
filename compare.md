# KURUKSHETRA 2026 — THE COMPARISON DECK
### All 13 problem statements, scored on the four things you said matter

> **🔒 FINAL LOCK:** the winning strategy outputs **DI-01 Debug Dojo** (§6). All three files are closed. Escape hatch for a *business-first* strategy is documented in §4.2 and §6.
> **Created:** 16 Oct 2026, 14:50 IST · **Locked:** 14:58 IST · **Kickoff:** 15:30 IST
> **Companion files:** `README.md` (event manual) · `README-TRACK.md` (the final decision + speech + business model)
> **Verdict in one line:** **DI-01 Debug Dojo** — the only statement that is simultaneously *self-scorable*, *nobody else's pick*, *emotionally speaking*, and *a sellable business*. Details in §6.

---

## 0. What this file is (and what it is not)

A side-by-side of **all 13 statements** across the three tracks, judged on **your four stated requirements** plus the four that actually decide a hackathon:

| Your requirement | Column in the matrix |
|---|---|
| "Accurate problem solving" | **Self-verify** — can you prove your own score before the judges do? |
| "Emotional support / emotional speech" | **Story** — is there a human in the statement you can speak about? |
| "Features that attract a better business model" | **Business** — who pays, and for what? |
| "Something that doesn't give anyone this statement" | **Crowd** — how many teams will land here? (lower = better) |

Plus: **Judge** (how it's scored), **Risk** (what has to go right), **Depth** (can it be solved *perfectly* or only partially?).

**Sourcing note (upgraded — this deck is now fully sourced):** all 13 statements are assessed from their **complete published requirement lists**, extracted from the site's embedded statement data. Open statements carry **6–8 numbered requirements** each; Agentic AI statements publish a **15-point rubric** (Functional Completeness · Quality of Execution · Thought, Effort & Creativity — 1–5 each, max 15) and mandate a **live working demo**; DI statements publish full specs and scoring tables. **Nothing in this deck is from memory.**

---

## 1. The board at a glance

| Track | Statements | Sponsor | Judging style | Prize pull |
|---|---|---|---|---|
| **TRACK-01 Open** | OP-01 … OP-06 (6) | **TechSummitTrainers** | Panel / demo | ⚠️ **Your code is assigned to them** (§7) |
| **TRACK-02 Agentic AI** | W-PS-1, W-PS-2 (2) | **Worcflow** | Panel / demo | Only **2** statements → densest field |
| **TRACK-03 Decentralized Intelligence** | DI-01, 02, 03, 04, 06 (5) | *none* | **Judge test pack** | Objective, runnable checks |

**Track descriptions (verbatim from the site):**
- **Open** — *"Build without boundaries. Tackle real-world challenges with groundbreaking software and creative solutions across any domain."*
- **Agentic AI** — *"Autonomous agents, multi-agent workflows, and intelligent decision-making systems reshaping modern computing."*
- **Decentralized Intelligence** — *"Intelligence without a single point of control. Build systems where data, models and decisions are shared across many participants, from blockchains to federated and edge AI."*

**Event facts:** ₹2,20,000+ pool · rubric = **innovation · technical execution · completeness · design · presentation** · 3 gates (Eval 1 Day 1 18:30 → Round 1 Day 2 08:00 → Round 2 + demo Day 2 15:30).

> ⚠️ **The single most important structural fact:** only **Decentralized Intelligence** is judged by a **runnable test pack or a live leaderboard.** Every other statement is judged by a panel. That means DI is the only track where **you can know your score before the judges do** — which is exactly what "accurate problem solving" means at a hackathon.

---

## 2. THE MASTER MATRIX

**Legend:** Score **1–5** (5 = best) · **Crowd**: 1 = almost nobody picks it, 5 = everyone picks it · **Self-verify**: can you test your own score? · **Depth**: can it be finished *perfectly*?

| ID | Statement | Track | Judge | Self-verify | Risk | Story | Business | Crowd | Depth | **Verdict** |
|---|---|---|---|---|---|---|---|---|---|---|
| **DI-01** | **Debug Dojo** | DI | test pack | **5** | **2** | **5** | 4 | **1** | **5** | ✅ **PICK THIS** |
| DI-06 | Pay-per-call Agent Economy | DI | test pack | 4 | 3 | 2 | 3 | **5** | 4 | ⛔ Crowd (your friend + every GPT) |
| DI-04 | Chimney Census | DI | leaderboard | 5 | 5 | 4 | 3 | 3 | 3 | ⚠️ The "crazy" gamble — gate in §9 |
| DI-03 | LiveSub | DI | test pack | 3 | 4 | **5** | 4 | 2 | 2 | ❌ Must beat their WER baseline |
| DI-02 | NeuroScope 3D | DI | test pack | 3 | **5** | 4 | 3 | 2 | 1 | ❌ Dice within 0.05 + affine maths |
| **W-PS-2** | **AI Career Coach** | Agentic | panel | 2 | 3 | 4 | **5** | 4 | 3 | 🥈 Best non-DI (emotion + business) |
| W-PS-1 | AI Group Project Coordinator | Agentic | panel | 2 | 4 | 3 | 3 | 4 | 3 | ⚠️ Sponsor API is human-initiated |
| OP-06 | Placement Hub | Open | panel | 2 | 2 | **5** | **5** | 3 | 3 | ⚠️ Great story — but Open IP clause |
| OP-02 | Adaptive Learning & Assessment | Open | panel | 2 | 3 | 4 | 4 | 3 | 2 | ⚠️ **DI-01's sandbox, institution-side** + replay + explain-your-code — Open IP clause |
| OP-05 | Verified Course Material Studio | Open | panel | 3 | 2 | 2 | 4 | 3 | 4 | ⚠️ "Prove code works" is testable — Open IP |
| OP-01 | Institute Operations Copilot | Open | panel | 1 | 3 | 2 | 4 | 4 | 2 | Open IP clause |
| **OP-03** | **AI Lead Desk** | Open | panel | 1 | 4 | **5** | **5** | 3 | 2 | ⚠️ **Best raw story + business — but the IP clause kills ownership** (§4.2) |
| OP-04 | Reel Studio | Open | panel | 2 | 3 | 3 | 4 | 3 | 3 | Open IP clause |

**Read it like this:** the top-right block is where the points are. **DI-01 is the only row that is strong on all five of *your* columns at once** — and the only one with `Crowd = 1` *and* `Depth = 5`.

---

## 3. Per-statement cards

### TRACK-01 · Open — *6 statements · panel-judged · sponsored by TechSummitTrainers*

> **Universal caveat:** the Open-track terms assign your submission to TechSummitTrainers. You cannot publish or reuse it. Full clause summary in §7. If you want to own your work, this track is the wrong door.

**OP-01 · Institute Operations Copilot** — *"Training institutes run on spreadsheets, WhatsApp groups and memory."*
Build an institute admin platform with an AI ops copilot (batches, trainer schedules, hybrid attendance, fee instalments, recordings). **Business: real B2B SaaS.** Story: none. Crowd: high — "AI copilot for a CRM" is the most-built app in India.

**OP-02 · Adaptive Learning and Assessment Portal** — *"Online assessments are nearly meaningless when an answer can be pasted from an AI tool."*
Adaptive learning + assessment that judges *how* a student arrives at an answer. **Emotionally strong topic — it is DI-01's problem from the institution's side.** But it is a full LMS + adaptive engine in 24h, and it's panel-judged.

**OP-03 · AI Lead Desk** — *"Enquiries arrive from WhatsApp, calls, Instagram, forms and walk-ins… often late at night and as voice notes in Hindi or Marathi."*
Lead management with an AI admissions counsellor. **Business: the clearest money story of the six.** Code-mixed Hinglish voice handling is the hard part. Panel-judged, crowded category.

**OP-04 · Reel Studio** — *"A good 60-second reel takes hours to edit."*
Turns class recordings into branded vertical videos; must handle Hinglish and un-mangle code. **Demo-friendly and visual** — good for "design" points. Business plausible. Crowd: medium.

**OP-05 · Verified Course Material Studio** — *"AI-drafted lessons often contain code that does not compile."*
Generates course material **and proves every code sample actually runs.** ⭐ *This has a genuinely testable core (run the code!) — the closest the Open track gets to self-verification.* Story: weak.

**OP-06 · Placement Hub** — *"Freshers send one generic resume full of claims they cannot back up."*
Matches students to openings on **verified evidence**, and helps them write "tailored, entirely truthful resumes." **The most emotionally resonant Open statement** (graduate anxiety + honesty) and a real business (colleges + recruiters pay). Panel-judged, and the verification engine is a big build.

### TRACK-02 · Agentic AI — *2 statements · panel-judged · sponsored by Worcflow*

> **Structural risk:** with only two statements, this track's field is the densest. Also, sponsor statements attract teams chasing a sponsor prize.

**W-PS-1 · AI Group Project Coordinator** — *"Keep a college group project moving… through a real messaging platform."*
An agent that chases pending tasks, reads replies, spots blockers. **Dependency risk:** Worcflow ingestion is human-initiated (I verified this earlier) — the "real messaging platform" loop is not fully automatable, which weakens a live demo.

**W-PS-2 · AI Career Coach** — *"Show what your portfolio proves, and what it does not."*
Compares a student's **demonstrated GitHub skills** against real job requirements, finds evidence-backed gaps, re-scores when repos change. **Emotion: high (career anxiety). Business: high (career services, colleges, bootcamps).** Self-verification: low (panel + GitHub API judgement). This is the strongest non-DI option and the right fallback if you leave DI (§9).

### TRACK-03 · Decentralized Intelligence — *5 statements · test pack / leaderboard · no sponsor*

**DI-01 · Debug Dojo** ⭐ — *"A coding coach that helps you find the bug without handing you the answer."*
> **The story (verbatim from the statement):** *"Rohan is in his first semester. His function should return the total of the last k marks in a list. It works on all three of his examples. The practice site says: Wrong Answer on test 5. Test 5 is hidden… So he does what everyone in his hostel does: pastes the question into a chatbot, copies the answer."*

Runs code in a constrained sandbox → explains failure in plain language → ≥3 escalating hints that **never** contain code → tags mistakes into a taxonomy → detects **recurring** mistakes → serves the next challenge to fix them, and says why. **Judged by 6 concrete tests (15 hostile programs, 12 outcome labels, secrecy, hint-leakage, an 11-program scripted learner, 2 blind human raters).** Full build plan: `README-TRACK.md`. → **Full card in §6.**

**DI-02 · NeuroScope 3D** — *"See a brain tumour in 3D, measure it, and know how far to trust it."*
> **Story:** *"Ishita… volunteers at a radiology teaching lab… a model can colour every voxel…"*

Segmentation + 3D web viewer + uncertainty. **Killer:** you must land within **0.05 Dice** of the organisers' baseline, with correct affine maths, anisotropy handling and an 8-case failure pack. That is a research-grade bar. ❌

**DI-03 · LiveSub** — *"Real-time multilingual subtitles for any YouTube video."*
> **Story:** *"Aai is 68 and lives in Pune. Her neighbour keeps sending her Tamil cooking videos; she speaks Marathi and Hindi, and the videos have no captions at all."*

**The single best human story on the entire board.** Also the hardest technical bar: beat the organisers' **WER/CER baseline** across 4 Indian languages at ≤3s median latency (their baseline: Whisper large-v3-turbo + IndicTrans2), inside a Manifest V3 browser extension. Emotion 5, winnability 2. ❌

**DI-04 · Chimney Census** — *"Find and classify every brick kiln from space."*
> **Story:** *"Every November, Inspector Farida Khan… opens the same file: 312 registered brick kilns in her district. Everyone in the office knows the real number is higher."*

Oriented object detection on satellite imagery + a leaderboard + an **Inspector's Brief** naming the 20 kilns to visit first. **The only statement where you can watch your own rank** (2 submissions/hour). Needs a GPU + a 4 GB dataset download. This is the "crazy, done properly" option — gate in §9.

**DI-06 · Pay-per-call Agent Economy** — *"A marketplace where agents hire agents and pay per request in stablecoins."*
> **Story:** *"At 2 AM, a research agent called Scout needs three things… None of them works for free, and none will sign a monthly contract with a piece of software."*

HTTP 402 payments on Base Sepolia, x402 SDKs, a facilitator, faucet-funded testnet USDC. Technically clean and fully self-verifiable. **But it is now the single most-recommended statement on the board** — your friend has it, and every model hands teams the same answer. ⛔ *Crowd, not quality, kills it.*

---

## 4. Head-to-heads

### 4.1 DI-01 Debug Dojo vs DI-06 Pay-per-call — the crowd decision

| Criterion | DI-01 Debug Dojo | DI-06 Pay-per-call |
|---|---|---|
| Judge format | 6 tests, mostly mechanical | test pack, ~9 checks |
| Self-verifiable | **Yes — you can run every test yourself** | Yes |
| External dependencies | **none but an LLM key** | facilitator, faucet, testnet, SDKs |
| Fails if… | Pyodide won't run (fixable in 20 min) | testnet/faucet hiccups at demo time |
| Human story | **Rohan — judges wrote it; every faculty member knows him** | Scout at 2 AM (abstract) |
| Business model | edtech + **academic-integrity audit trail** | agent-to-agent payments (speculative) |
| Crowd today | **≈1** | **≈5 — saturated** |
| Judging subjectivity | low (4/6 tests mechanical) | low |
| **Net** | **Wins on story, crowd, risk, business** | Wins on nothing once the crowd is accounted for |

**Why the crowd is the deciding column:** in a judged field, finishing *third-best at a popular problem* scores worse than *best at an unpopular one*. DI-06's problem is not that it is weak — it is that **you would be eval-number-forty on the same demo.**

### 4.2 OP-03 AI Lead Desk vs DI-01 Debug Dojo — the "LDT" question

**OP-03 is much stronger than its one-line summary suggests.** Its published requirements are: multilingual voice + text in (English / Hindi / Marathi, *including mid-sentence switches*) · answers **strictly** from a knowledge base the institute controls · **never invents discounts, fees or placement guarantees — even when pressed** · a short adaptive aptitude check inside the conversation, then a demo-class booking into a real calendar slot · **cross-channel identity resolution** (a form from *"Rahul Patil"* and a WhatsApp message from *"राहुल पाटील"* are the same person) · a next-best-action engine · a counsellor dashboard with **detected objections (fees, job fears, family approval)** and instant human takeover · optional telephony + Instagram DMs + conversion reporting.

**Yes — it is the most emotionally loaded *business* statement on the board.** Not because of a backstory, but because of three words in requirement #6: **fees · job fears · family approval.** Those are the three real anxieties of every Indian family making an education decision. And requirement #2 — *"never invent… even when pressed"* — is an integrity story a panel will remember for weeks.

| Criterion | **OP-03 AI Lead Desk** | **DI-01 Debug Dojo** |
|---|---|---|
| Emotional material | **5** — a voice note at 11:47pm; fees, job fears, family approval | **5** — Rohan; the judges wrote it themselves |
| Business model | **5** — lead → admission is *direct revenue*; #7 sells the exact metric (by source, counsellor, objection) | 4 — Hint Ledger + institutions |
| **Who owns your work** | ❌ **TechSummitTrainers** (clauses 1, 2, 5) | ✅ **You** |
| Judging | panel (subjective) | **runnable test pack** |
| Know your score before judges? | No | **Yes** |
| Subsystems to build in ~13h | **7** | 6, all testable |
| Shape | **Breadth → "everything half-done"** | **Depth → one thing perfected** |
| Crowd today | 3 (CRM copilots are common) | **1** |
| Perfectly solvable? | No | **Yes** |

**The three reasons OP-03 loses *for you*:**

1. **Ownership is fatal to the business case.** Clause 1: the Submission becomes TechSummitTrainers' *"sole and exclusive property."* Clause 2: you assign all copyright, worldwide, full term. Clause 5: you *"may not publish, share, sell or reuse the Submission's code"* without written permission. **The statement with the best business model is the one place you cannot take a business from.**
2. **Breadth beats you.** Seven subsystems in ~13 usable hours produces exactly what you told me you refuse: *"everything done, nothing finished."*
3. **No self-scoring.** Panel-judged → you cannot know your score before 15:30 tomorrow.

> **Verdict, finally, unchanged:** if your goal is *"the demo that moves the room"* → OP-03. If your goal is *"the project I can solve perfectly, own, and prove I won"* → **DI-01.** You told me: *"solve perfectly, not everything half-done."* That one sentence picks DI-01.

**If you have already decided on OP-03** — respect. Then cut scope ruthlessly to the requirements that carry all the emotion: **#1 (multilingual voice in) · #2 (answers only from the knowledge base, never invents) · #6 (dashboard with detected objections)**, plus **#4 (identity merge)**, because *"Rahul" = "राहुल"* is the scene that lands in the room. Drop #3, #5, #7. And **read clauses 1, 2 and 5 before you commit.**

**Related discovery — why OP-02 also matters:** OP-02 Adaptive Learning & Assessment contains DI-01's sandbox core almost verbatim — *"run coding assessments in a secure sandbox against hidden test cases, in multiple languages, containing hostile submissions (infinite loops, file system access, network calls)"* — plus keystroke replay, integrity signals, and "explain your code" questions. **It is DI-01 from the institution's side** — but on the Open track, under the same IP clause, with an even larger scope.

---

## 5. Head-to-head: DI-01 vs W-PS-2 (the only real challenger)

| Criterion | **DI-01 Debug Dojo** | W-PS-2 AI Career Coach |
|---|---|---|
| Track | Decentralized Intelligence | Agentic AI (2 statements only) |
| Judging | **runnable test pack** | panel |
| Can you verify your score? | **Yes, exhaustively** | No |
| Story / emotional speech | **Very high — Rohan** | High — graduate anxiety |
| Business model | Strong (institutions, audit trail) | **Very strong** (careers, colleges) |
| Crowd | **Low** | High (career-coach is a cliché build) |
| Track depth | 5 statements, objective | 2 statements, subjective |
| **Ask yourself** | *"Can I prove I won before they score me?"* | *"Do I want the safest story on the panel?"* |

**Verdict:** W-PS-2 is the best choice **if and only if** you want to compete on narrative in a subjective track against a crowded field. DI-01 is better on **every mechanically decidable dimension** — and still has an emotional speech that lands harder, because the judges wrote it themselves.

---

## 6. THE VERDICT — 🔒 LOCKED

**Your winning strategy, stated as one rule:** maximise the probability of winning the 24 hours you actually have. The score is not *"how good is the idea"* — it is **expected judge points × probability of finishing × ownership of the result.** Applied to the board:

| Strategy test | Winner |
|---|---|
| Can I know my score before the judges do? | **DI-01** (runnable test pack) — OP-03 cannot |
| Is the field thin? | **DI-01** (crowd 1) — OP-03 is 3 |
| Can I finish it *and* run my full test harness 3× before freeze? | **DI-01** (6 testable subsystems) — OP-03 has 7 judgement-only ones |
| Do I own what I build? | **DI-01** — OP-03 goes to TechSummitTrainers (clauses 1/2/5) |
| Can I speak about it so it moves a room? | **tie** — Rohan ↔ *fees · job fears · family approval* |

**Rule output → DI-01.** It wins four tests of five, and the fifth is a tie, not a loss.

> ⚠️ **Escape hatch (one word flips this lock):** if your strategy is **business-first, trophy-second**, the rule outputs **OP-03 AI Lead Desk** instead — see §4.2 for its scope-cut and §7 for the ownership cost.

> # 🏆 DI-01 · Debug Dojo
> **Decentralized Intelligence · "A coding coach that helps you find the bug without handing you the answer."**

**Why it wins on your four requirements:**

| Your requirement | How DI-01 satisfies it |
|---|---|
| **Accurate problem solving** | 6 judge tests; 4 are mechanical (labels, secrecy, leakage, recurrence). You build the harness, so you *know* your score. No baseline to beat, no leaderboard race, no sponsor API. |
| **Emotional speech** | Rohan's story, written by the judges. The 90-second opening speech is in `README-TRACK.md §13.2` and is aimed at the exact people in the room who have met Rohan. |
| **Business model that attracts support** | The **Hint Ledger** — a compliance requirement — becomes the moat: *"prove your AI never gave the answer."* Tiers, buyers and the four support-attracting features are in `README-TRACK.md §13.3`. |
| **"Nobody else gets this statement"** | `Crowd = 1`. Teams read "sandbox, red team, hidden-test secrecy, taxonomy" and walk away. Perceived difficulty high, actual difficulty manageable. |

**And the meta-reason:** you have Claude Code Pro. Building is no longer your bottleneck — **spec fidelity is.** DI-01 is the only statement whose spec is a *finite, enumerable, self-administerable checklist*. You can spend 13 hours iterating against your own scoreboard instead of guessing what a panel wants.

**Objective bonus:** `gitleaks` on your repo protects the "code written during the event" rule, and DI has no sponsor IP clause.

---

## 7. Why the Open track is a trap (the IP clause)

Open statements are sponsored by **TechSummitTrainers**, and its published terms are a **10-clause assignment of your submission** — the sponsor ends up owning the work; you cannot freely publish or reuse it. For a team that wants a portfolio piece, a startup seed, or a GitHub repo to point at, that is a bad trade — *regardless of how good the statement is.* OP-02 and OP-06 would otherwise rank highly.

> **Verify before committing:** whether the Agentic AI (Worcflow) statements carry the same or softer terms. If Worcflow's terms are open, **W-PS-2 rises.**

---

## 8. …but if you must leave DI-01, switch like this

| Situation | Switch to | Why |
|---|---|---|
| You want maximal emotion + business with no DI risk | **W-PS-2 AI Career Coach** | Best non-DI; §5 |
| You want the Open track despite the IP clause | **OP-06 Placement Hub** (or OP-02) | Strongest stories/markets there |
| You want the most demo-able Open build | **OP-04 Reel Studio** | Visual, fast "design" points |
| You want an objective, self-verifiable core in the Open track | **OP-05 Verified Course Material Studio** | "Proves every code sample runs" |
| You want to gamble everything | **DI-04 Chimney Census** | See §9 |

---

## 9. The one written gate for the "crazy" option (DI-04)

DI-04 is genuinely spectacular — a public leaderboard you can watch all night, and an Inspector's Brief that names the kilns Farida should raid first. **Take it only if, by 15:00 today, all three are true:**

1. A **working T4-class GPU runtime** is open and tested *on your machine/session*, and
2. **≥30 % of the dataset** is already on disk, and
3. You have a **working baseline submission** to the public leaderboard.

If any of those is false at 15:00 → **it is a zero. Take DI-01.** Do not "start DI-04 and see."

---

## 10. Rankings, ranked

**By emotional story:** DI-03 (Aai) > **DI-01 (Rohan)** = DI-04 (Farida) > **OP-03 (fees · job fears · family approval)** > OP-06 > DI-02 = DI-06 > W-PS-2 > rest

**By business model:** **OP-03** > W-PS-2 = OP-06 > **DI-01** > OP-01/02/05 > DI-03 > OP-04 > DI-06 > DI-04 > DI-02

**By "can I prove my own score?":** DI-01 > DI-04 > DI-06 > OP-05 > DI-02/03 > everything panel-judged

**By uniqueness (1 = nobody):** **DI-01** > DI-02/03 > DI-04 > OP-05/06 > W-PS-1 > DI-06 > OP-01/03

**Overall, weighted to win this specific event:** **DI-01** > W-PS-2 > DI-04 > OP-06 > DI-06 > OP-02 > DI-03 > OP-05 > W-PS-1 > OP-04 > DI-02 > OP-01 > OP-03

---

## 11. Known vs unknown (so you don't act on a guess)

| Known (verified) | Unknown (verify yourself) |
|---|---|
| 13 statements across 3 tracks; tracks/sponsors as above | Which statements other teams registered for |
| DI judged by **test pack / leaderboard**; others by panel | Per-track team counts |
| Rubric: innovation, execution, completeness, design, presentation | Whether judging is per-track or mixed |
| Open-track IP terms assign submissions to TechSummitTrainers | Worcflow (Agentic) terms |
| DI full requirement text (test counts, taxonomy, endpoints) — **and now OP/W full requirement lists too** | Whether OP judging matches the Agentic 15-point rubric |
| ₹2,20,000+ pool; 3 gates and their times | Per-rank prize split (never published) |

---

## 12. Next step

1. Read `README-TRACK.md §13.2` — **memorise the speech.**
2. Read `README-TRACK.md §6` — **the 6 judge tests are the product.**
3. Read `README-TRACK.md §14` — **the environment checks you must finish before 15:30.**
4. Keep this file open during Round 2 — if a judge asks *"why not the other tracks?"*, §4, §5 and §7 are your answer.

> *"Rohan never needed the answer. He needed someone to point him to the right place to look."*
