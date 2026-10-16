# The self-test harness — the judges' six checks, run on ourselves

```bash
npm run harness                                   # boots the real API + real sandbox in-process, temp DB
npm run harness -- --url http://localhost:3000    # the same checks against the running product
npm run harness -- --verbose                      # print every check, not only failures
npm run test:unit                                 # pure core tests (detectors, classifier, validator, bank)
```

Results are written to `harness/results/latest.json`. Each suite can also run alone, e.g. `npx tsx harness/redteam.test.ts`.

| Suite | Judge test | What it asserts |
|---|---|---|
| `redteam.test.ts` | T1 · sandbox red-team (15) | The statement's 15 hostile programs + 9 extra escape attempts (`import js`, subclass walk, frame walk, `random._os`, `eval`, `getattr` with strings, an always-equal object, a loop that swallows the timeout, `pyodide.code.run_js`). For each: no test `passed`, honest outcome + limit name, no secret in the response (a canary env var set in the API process, `/etc/passwd` markers, host paths, the harness source), `GET /api/health` is 200, the next known-good submission still passes. Plus 4 hostile programs in parallel. |
| `labels.test.ts` | T2 · outcome labels (15 with T3) | Four behaviours × three judge challenges — pass / wrong output / error / forever — with **every** visible and hidden label pinned (12 core + 4 extended contracts: print-instead-of-return, `range(1, len)`, the middle-three starter, a syntax error). Then every reference solution must pass all of its own tests, proving each explicit hidden literal is right. |
| `secrecy.test.ts` | T3 · hidden-test secrecy | Programs that print, raise, return and echo their inputs on every challenge; every hint (incl. "give me the answer"), every replay, every page the browser can fetch. Asserts hidden rows are exactly `{test, outcome}`, no hidden literal in any response body, none in the served client bundle / `public/`, and the database refuses (CHECK constraint) to store output for a hidden test. |
| `leakage.test.ts` | T4 · hint leakage (10) | Four failing submissions; request every hint including "just give me the answer" / "solution please". Every hint passes the validator; the ladder climbs exactly one rung per request; ≥ 3 rungs; the next submission resumes at the next rung; then **merge all hint code into the learner's code** (guarded and inline) and submit — it must still fail ≥ 1 hidden test. The validator is also fed real code drafts and must reject them. |
| `learner.test.ts` | T5 · recurring + skills (10) | The 11-program scripted learner (`apps/api/src/fixtures.ts`): plant A `unhandled_short_input` in two challenges, plant B `boundary_comparison` in two challenges, a one-off `print_not_return`, a repeated failure on one challenge. Asserts exactly the two planted tags are recurring, the one-off is not, five failures on one challenge = nothing recurring, the next challenge's reason names a recurring tag, an unhinted pass beats a hinted pass, mastery moves with the evidence. |
| `explain.test.ts` | T6 · explanations + hints (15, human-rated) | Prints five failure explanations and four full ladders as a **blind-rating sheet** (0–2 on correct · specific · not-a-giveaway; rewrite anything < 1.5) and checks the floor automatically: no hidden literal, names the kind of input, no code fence, ≤ 4 sentences, four distinct rungs. |

## When to run it

At every checkpoint (the plan says 21:00, 07:30, 12:00) and after any change to `packages/core` or `apps/runner`. A red row is a bug in the product, never in the judges' test.
