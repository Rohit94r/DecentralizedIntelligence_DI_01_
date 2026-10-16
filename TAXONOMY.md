# Debug Dojo — Mistake Taxonomy (hand-in #3)

Every detector is **deterministic** — no LLM decides a tag. Each one reads only (a) what the learner's **own code** did in the sandbox, (b) the declared **shape** of the input (`edge`, `short` in the challenge bank) and (c) the comparison the parent already made. Hidden values never leave the comparison. Source: `packages/core/src/detectors.ts` · unit tests: `packages/core/test/unit.ts` · live page: **`/taxonomy`** · JSON: **`GET /api/taxonomy`**.

| Category | How it is detected | Example bug | Unit test |
|---|---|---|---|
| `unhandled_short_input` | The learner's code raised `IndexError` / `ValueError` / `TypeError` / `ZeroDivisionError` / `KeyError` on a test whose input is declared **shorter than the contract assumes** (empty list, `k > len`, `n = 0`, fewer than three items). Signals: exception **class name** + input shape — never the expected output. | `for i in range(len(marks) - k, len(marks)):` → negative start, `IndexError` when k > len (last-k-total) | `det_short_input` |
| `print_not_return` | The function returned `None`, and what it **printed during the call** equals the expected value. | `print(total)` and no `return` (bf-average, middle-three) | `det_print_not_return` |
| `mutates_input` | The arguments differ from a deep snapshot taken **before** the call, or a second identical call (on a fresh copy) returns something different. | `nums.sort()` sorts the caller's list (second-largest) | `det_mutates_input` |
| `off_by_one` | The result is exactly **one step** from the correct one (±1 · one element too many/few · the window shifted one place) on at least one input that is **not** at a boundary. | `range(1, n + 2)` → one square too many for every n (first-n-squares) | `det_off_by_one` |
| `boundary_comparison` | One-step errors that occur **only** on inputs at a declared boundary (`k == len`, `k > len`, `n == 0`, a mark of exactly 40, fewer than three items, empty) — every non-boundary input passes. Or an exact known boundary-bug signature. | `if m > 40:` — a mark of exactly 40 is a pass (count-passes) | `det_boundary_cmp` |
| `wrong_index_direction` *(optional 6th)* | The result equals what the same computation gives from the **other end** of the input (explicit per-test signature literals), on ≥ 2 tests or on every wrong-output test. | `return items[:2]` — first two, not last two (bf-last-two) | `det_wrong_direction` |

**One tag, kept distinct.** At most one primary tag per failing submission, chosen in a fixed order: `print_not_return` › `mutates_input` › `unhandled_short_input` › exact known-mistake signature › `boundary_comparison` › `off_by_one`. A failing submission with no matching evidence gets no tag (and a generic, still-specific explanation).

**Recurring = the same tag in ≥ 2 _different_ challenge ids** for that learner. Failing one challenge five times is one data point, not five. One-off slips are reported separately (`one_off_mistakes`) and are **never** called recurring.

**Next challenge.** Targets the top recurring tag (a challenge whose `targets` include it, not yet passed, preferring ones where the tag hasn't appeared) and states the reason, e.g. *"boundary_comparison has now appeared in two different challenges (first-n-squares, last-k-total). Next: Sum of Digits. The loop has to keep going right up to the last digit…"*. Nothing recurring → the weakest concept. All strong → the next unseen challenge at the learner's level. The reason is never empty. The **Bug Factory** (`/bug-factory`) additionally *generates* a buggy program from the learner's top tag — the statement's "choose **or generate**".

**Mastery** (per concept, Beta posterior): prior α = β = 1 · unhinted pass α += 1.0 · hinted pass α += 0.35 · fail β += 0.6 · each hint β += 0.15 · mastery = α / (α + β).

*All challenge content and every hidden test are original to this project (no Exercism / MBPP / HumanEval content was adapted).*
