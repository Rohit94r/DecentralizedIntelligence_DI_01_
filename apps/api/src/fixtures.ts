/**
 * Scripted learner programs. Used by the seed (so the demo learners have a
 * real, sandbox-run history) and by harness/learner.test.ts (the 10-point
 * "recurring mistakes" check). Every program is a plausible beginner attempt.
 */
export interface ScriptStep {
  challenge: string;
  /** code to submit, or null for "request hints on the previous submission" */
  code: string | null;
  hints?: number;
  /** what this step is planting */
  plant?: string;
  message?: string;
}

export const P = {
  countPassesCorrect: `def count_passes(marks):
    count = 0
    for m in marks:
        if m >= 40:
            count += 1
    return count
`,
  countPassesBoundary: `def count_passes(marks):
    count = 0
    for m in marks:
        if m > 40:
            count += 1
    return count
`,
  lastKStarter: `def last_k_total(marks, k):
    total = 0
    for i in range(len(marks) - k, len(marks)):
        total += marks[i]
    return total
`,
  lastKStillWrong: `def last_k_total(marks, k):
    total = 0
    start = len(marks) - k
    for i in range(start, len(marks)):
        total = total + marks[i]
    return total
`,
  lastKBoundary: `def last_k_total(marks, k):
    total = 0
    i = len(marks) - 1
    count = 0
    while count < k and i > 0:
        total += marks[i]
        i -= 1
        count += 1
    return total
`,
  lastKCorrect: `def last_k_total(marks, k):
    total = 0
    start = max(0, len(marks) - k)
    for i in range(start, len(marks)):
        total += marks[i]
    return total
`,
  squaresShortInput: `def first_n_squares(n):
    squares = [0] * n
    squares[0] = 1
    for i in range(1, n):
        squares[i] = (i + 1) * (i + 1)
    return squares
`,
  squaresBoundary: `def first_n_squares(n):
    squares = [1]
    i = 2
    while i <= n:
        squares.append(i * i)
        i += 1
    return squares
`,
  squaresOffByOne: `def first_n_squares(n):
    squares = []
    for i in range(1, n + 2):
        squares.append(i * i)
    return squares
`,
  squaresCorrect: `def first_n_squares(n):
    squares = []
    for i in range(1, n + 1):
        squares.append(i * i)
    return squares
`,
  middlePrints: `def middle_three(items):
    if len(items) < 3:
        print(items)
        return
    mid = len(items) // 2
    print(items[mid - 1:mid + 2])
`,
  middleCorrect: `def middle_three(items):
    if len(items) < 3:
        return items
    mid = len(items) // 2
    return items[mid - 1:mid + 2]
`,
  gradeBoundary: `def grade_letter(score):
    if score > 90:
        return "A"
    elif score > 80:
        return "B"
    elif score > 70:
        return "C"
    elif score > 60:
        return "D"
    return "F"
`,
  digitsCorrect: `def sum_of_digits(n):
    total = 0
    while n > 0:
        total += n % 10
        n = n // 10
    return total
`,
  secondLargestSorts: `def second_largest(nums):
    nums.sort()
    return nums[-2]
`,
  vowelsLowercase: `def count_vowels(text):
    count = 0
    for ch in text:
        if ch in "aeiou":
            count += 1
    return count
`,
};

/**
 * The 11-program scripted learner — exactly the statement's T5 shape:
 * plant A (unhandled_short_input) in two different challenges, plant B
 * (boundary_comparison) in two different challenges, one one-off slip
 * (print_not_return) that must NOT be flagged, and a failure repeated on the
 * SAME challenge that must count once.
 */
export const SCRIPTED_LEARNER: ScriptStep[] = [
  { challenge: "count-passes", code: P.countPassesCorrect, plant: "clean pass, no hints" },
  { challenge: "last-k-total", code: P.lastKStarter, plant: "A · unhandled_short_input — 1st challenge" },
  { challenge: "last-k-total", code: null, hints: 2, plant: "ladder advances" },
  { challenge: "last-k-total", code: P.lastKStillWrong, plant: "A again on the SAME challenge — still one data point" },
  { challenge: "first-n-squares", code: P.squaresShortInput, plant: "A · 2nd different challenge → RECURRING" },
  { challenge: "first-n-squares", code: P.squaresBoundary, plant: "B · boundary_comparison — 1st challenge" },
  { challenge: "first-n-squares", code: null, hints: 1 },
  { challenge: "middle-three", code: P.middlePrints, plant: "one-off print_not_return — must NOT be flagged" },
  { challenge: "middle-three", code: P.middleCorrect, plant: "recovery" },
  { challenge: "last-k-total", code: P.lastKBoundary, plant: "B · 2nd different challenge → RECURRING" },
  { challenge: "last-k-total", code: P.lastKCorrect, plant: "pass (after hints)" },
];

export const SEED_LEARNERS: { id: string; days: number; steps: ScriptStep[] }[] = [
  { id: "rohan", days: 3, steps: SCRIPTED_LEARNER },
  {
    id: "meera",
    days: 2,
    steps: [
      { challenge: "count-passes", code: P.countPassesBoundary },
      { challenge: "count-passes", code: null, hints: 2, message: "just tell me the answer" },
      { challenge: "count-passes", code: P.countPassesCorrect },
      { challenge: "grade-letter", code: P.gradeBoundary },
      { challenge: "sum-of-digits", code: P.digitsCorrect },
      { challenge: "second-largest", code: P.secondLargestSorts },
    ],
  },
  {
    id: "kabir",
    days: 1,
    steps: [
      { challenge: "first-n-squares", code: P.squaresOffByOne },
      { challenge: "first-n-squares", code: null, hints: 1 },
      { challenge: "first-n-squares", code: P.squaresCorrect },
      { challenge: "count-vowels", code: P.vowelsLowercase },
    ],
  },
];
