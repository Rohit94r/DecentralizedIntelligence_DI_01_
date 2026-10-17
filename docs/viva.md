# The viva — four answers, said cold (≤ 40 s each)

The statement asks for exactly four things **without notes**: isolation, the test harness, the hint guardrails, the learner model. These match what the code actually does.

### 1 · Isolation
> "Learner code never runs in our server. Each submission gets a fresh child process that we throw away afterwards. Inside it, Python runs in Pyodide — CPython compiled to WebAssembly — so there is no real filesystem and no fork: reading /etc/passwd fails by construction. On top of that the child is started with Node's permission model, so even JavaScript inside it can't read host files or start processes, and with an empty environment, so there are no secrets to steal. The Python layer blocks dunder access and imports outside an allowlist. A supervisor thread interrupts Python on the wall clock and kills it on a memory spike. And the hidden tests never enter the child at all — it only ever gets inputs; the parent compares."

### 2 · The test harness
> "I built the judges' checks into `npm run harness` and run them on myself. Fifteen hostile programs plus nine escape attempts — every one contained, the server still healthy, and the next good submission still passing. Twelve pinned labels across three challenges, plus every reference solution passing its own tests so I know the hidden literals are right. A secrecy scan of every response, the client bundle and the database. A hint-leakage test that merges all hint code into the buggy program and checks it still fails. An eleven-program scripted learner that must surface exactly the two planted recurring mistakes. And a sheet of five explanations my team blind-rates."

### 3 · Hint guardrails
> "No hint may contain code — and that's enforced, not requested. Every hint, hand-written or LLM-written, goes through a validator at storage time that rejects fences, definitions, assignments, comparisons, calls, slices and imports. When the system tries a sharper hint that quotes the learner's own line, the validator rejects it, we log the rejection in the Hint Ledger, and the prose version ships. There are three hints — nudge, your line, why it breaks — and 'give me the answer' still moves exactly one rung. With a Groq key each hint is written for the learner's own code, so a judge who rewrites the bug a different way still gets a hint that fits — and every draft goes through the same validator, with one retry before the hand-written rung ships. Only after the third hint does a separate answer step unlock: it shows what's wrong and the learner's own code with the smallest fix — and we never show a fix we haven't run: it goes through every visible and hidden test in the sandbox first. Every prompt and response is in the ledger, so it's auditable."

### 4 · The learner model
> "Two parts. Mastery is a Beta posterior per concept: an unhinted pass adds one to alpha, a hinted pass only 0.35, a fail adds 0.6 to beta and every hint costs 0.15 — so passing without help counts almost three times as much. Recurrence counts *different* challenge ids: failing one problem five times is one data point. The next challenge targets the top recurring mistake and says why — or the Bug Factory generates a buggy program built from that exact mistake."

## Probes to expect
- *Why Pyodide and not a subprocess?* — WebAssembly removes the filesystem and processes by construction; filtering a real CPython is a blacklist race.
- *How do you know a hidden value can't leak?* — the child never receives one; responses are schema-filtered; text passes `findLeak`; the harness scans responses, the bundle and the DB.
- *What if the LLM writes code?* — it never ships: same validator, same secrecy check, Tier 1 is the fallback, and the product needs no key.
- *Why node:sqlite?* — zero install, WAL for parallel judges, works with the network cable pulled.
- *What next?* — teacher cohort heatmaps of recurring tags, spaced repetition on recurring mistakes, more languages.
