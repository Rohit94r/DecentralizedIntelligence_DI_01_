/**
 * THE CHALLENGE BANK — static code, never a database table.
 *
 * ██ Hidden tests live ONLY here, in the API process's memory. ██
 * They are explicit literals (not computed from a reference at request time),
 * they are never written to disk at runtime, never sent to the sandbox child
 * (the child gets inputs only), and never serialised to a client except as
 * `{test, outcome}`. `publicChallenge()` is the only shape that leaves.
 *
 * 12 practice challenges · 3 levels · 6 concepts · each ≥3 visible + ≥5 hidden.
 * Plus 6 Bug Factory templates (OB3), one per mistake category.
 * All content and all hidden tests are our own.
 */
import type { Challenge } from "./types.ts";

const LAST_K_TOTAL: Challenge = {
  id: "last-k-total",
  title: "Last K Total",
  fn: "last_k_total",
  signature: "last_k_total(marks, k)",
  difficulty: "medium",
  concepts: ["lists_indexing", "loops_range", "boundaries"],
  description:
    "Return the total of the last k marks in the list. If k is larger than the list, return the total of all the marks.",
  inputs: "marks: a list of whole numbers, possibly empty · k: a whole number, 0 or more",
  starter: `def last_k_total(marks, k):
    total = 0
    for i in range(len(marks) - k, len(marks)):
        total += marks[i]
    return total
`,
  visible: [
    { args: [[10, 20, 30, 40], 2], expected: 70, edge: null, alts: { wrong_index_direction: 30 } },
    { args: [[5, 5, 5], 3], expected: 15, edge: "k_eq_len", alts: { wrong_index_direction: 15 } },
    { args: [[7], 1], expected: 7, edge: "k_eq_len", alts: { wrong_index_direction: 7 } },
  ],
  hidden: [
    { args: [[1, 2, 3], 2], expected: 5, edge: null, alts: { wrong_index_direction: 3 } },
    { args: [[4, 5, 6, 7], 4], expected: 22, edge: "k_eq_len", alts: { wrong_index_direction: 22 } },
    { args: [[4, 5], 5], expected: 9, edge: "k_gt_len", short: true, alts: { wrong_index_direction: 9 } },
    { args: [[10, 20, 30], 4], expected: 60, edge: "k_gt_len", short: true, alts: { wrong_index_direction: 60 } },
    { args: [[5, 5], 3], expected: 10, edge: "k_gt_len", short: true, alts: { wrong_index_direction: 10 } },
    { args: [[10, 20, 30, 40], 2], expected: 70, edge: null, alts: { wrong_index_direction: 30 } },
  ],
  edges: {
    k_eq_len: {
      one: "a case where k is exactly the number of marks",
      many: "cases where k is exactly the number of marks",
      boundary: true,
    },
    k_gt_len: {
      one: "a case where k is larger than the number of marks",
      many: "cases where k is larger than the number of marks",
      boundary: true,
    },
  },
  stepRule: "sum",
  resultNoun: "total",
  targets: ["unhandled_short_input", "boundary_comparison", "off_by_one", "wrong_index_direction"],
  targetReasons: {
    unhandled_short_input:
      "Its hidden tests include lists that are shorter than k, so you have to decide what happens before the loop runs.",
    boundary_comparison: "It is built around the boundary where k reaches the length of the list.",
    off_by_one: "Getting exactly k marks means the start and the stop of your loop must both be right.",
    wrong_index_direction: "It asks for the LAST k marks, so the direction of your window matters.",
  },
  mechanisms: {
    unhandled_short_input: "Line {line} assumes the list holds at least k marks, and on these inputs it doesn't.",
    boundary_comparison:
      "The comparison on line {line} stops one step early, so the mark at the very start of the list is never added.",
    off_by_one: "Your loop visits one position too many or too few, so the total is off by exactly one mark.",
    wrong_index_direction: "Your total comes from the start of the list, but the task asks for the last k marks.",
    generic: "Work one of these cases out by hand and compare it with what your loop adds up.",
    timeout: "On those inputs a loop never reaches its stopping condition.",
    crash: "Your code raises an error before it can return a total.",
  },
  mechanismVariants: [
    {
      tag: "unhandled_short_input",
      when: "len\\(\\s*marks\\s*\\)\\s*-\\s*k",
      text: "Your loop starts at len(marks) - k, which is negative then.",
    },
  ],
  probes: {
    k_gt_len: [[2, 5], 3],
    k_eq_len: [[3, 4, 5], 3],
    default: [[10, 20, 30, 40], 2],
  },
  ladders: {
    // The statement's own model ladder, verbatim.
    unhandled_short_input: [
      "Your three examples never ask for more marks than the list holds. What should `last_k_total` return when k is bigger than the list?",
      "Work out `last_k_total([2, 5], 3)` by hand. Which index does your loop start at, and what does `marks[-1]` mean in Python?",
      "In Python a negative index counts back from the end, so some marks get added twice. Your start index must never go below 0.",
      "Python has a built-in that returns the larger of two numbers. Use it to work out the start index once, before the loop.",
    ],
    boundary_comparison: [
      "Your loop stops at an edge of the list. Which mark is the very first one, and does your loop ever reach it?",
      "Trace your code by hand for a case where k equals the number of marks. List every position you visit — is the first position on that list?",
      "The position of the first mark is zero. A stopping test that only keeps going while the position is above zero quits one step too early.",
      "Change the stopping test so that zero itself still counts as a valid position — the comparison should include its edge.",
    ],
    off_by_one: [
      "Count how many marks your loop actually adds for the first visible example. Is it exactly k?",
      "Write down the start and stop positions your loop produces for a list of four marks and k of two. Which positions should be included?",
      "A range stops just before its second number, so the last position it gives is one less than the stop you wrote.",
      "Make the stop position the length of the list and the start position the length minus k, then count the positions again.",
    ],
    wrong_index_direction: [
      "Look at which end of the list your total comes from. Does the task ask for the first marks or the last ones?",
      "For the first visible example, write out the k marks you add. Are they at the start or the end of the list?",
      "Counting from the end means the window should finish at the final mark and stretch backwards k places.",
      "Python lets a slice start counting from the end of a list when the starting position is negative.",
    ],
    generic: [
      "Pick the first visible example and work it out by hand. Which marks should be added together?",
      "Now add a short print inside your loop and watch which positions it visits. Do they match your hand calculation?",
      "The hidden tests also include lists that are shorter than k. Decide what your function should do then, before the loop starts.",
      "Python has a built-in that adds up all the numbers in a list for you — think about where it could replace your loop.",
    ],
  },
};

const COUNT_PASSES: Challenge = {
  id: "count-passes",
  title: "Count Passes",
  fn: "count_passes",
  signature: "count_passes(marks)",
  difficulty: "easy",
  concepts: ["conditionals", "boundaries", "accumulators"],
  description: "Return how many marks are passes. A mark of 40 or more is a pass.",
  inputs: "marks: a list of whole numbers, possibly empty",
  starter: `def count_passes(marks):
    count = 0
    for m in marks:
        if m > 40:
            count += 1
    return count
`,
  visible: [
    { args: [[40, 39, 41]], expected: 2, edge: "at_cutoff" },
    { args: [[10, 20]], expected: 0, edge: null },
    { args: [[45, 46, 47]], expected: 3, edge: null },
  ],
  hidden: [
    { args: [[]], expected: 0, edge: "empty", short: true },
    { args: [[40]], expected: 1, edge: "at_cutoff" },
    { args: [[39, 41]], expected: 1, edge: null },
    { args: [[40, 40, 40]], expected: 3, edge: "at_cutoff" },
    { args: [[-5, 100]], expected: 1, edge: null },
    { args: [[0, 10, 20, 30, 40, 50, 60, 70, 80, 90]], expected: 6, edge: "at_cutoff" },
  ],
  edges: {
    at_cutoff: {
      one: "a case with a mark of exactly 40",
      many: "cases that include a mark of exactly 40",
      boundary: true,
    },
    empty: { one: "an empty list", many: "empty lists", boundary: true },
  },
  stepRule: "numeric",
  resultNoun: "count",
  targets: ["boundary_comparison", "off_by_one", "print_not_return"],
  targetReasons: {
    boundary_comparison: "It is built around a single boundary: a mark of exactly 40 must count as a pass.",
    off_by_one: "Every mark must be visited exactly once to get the count right.",
    print_not_return: "The count has to be handed back to the caller, not printed.",
  },
  mechanisms: {
    boundary_comparison: "Your comparison on line {line} leaves out marks of exactly 40, which are passes.",
    off_by_one: "Your loop skips a mark, so the count comes out one short.",
    generic: "Count the passes by hand for a list with a 40 in it and compare.",
    timeout: "On those inputs your loop never finishes.",
    crash: "Your code raises an error before it can return a count.",
  },
  probes: {
    at_cutoff: [[40, 55]],
    empty: [[]],
    default: [[40, 39, 41]],
  },
  ladders: {
    boundary_comparison: [
      "Your result is off by one only on some lists. What do those lists have in common?",
      "Look at a mark of exactly 40. The task says 40 is a pass — does your test count it?",
      "A strictly-greater test leaves out the value it compares against, so a mark sitting exactly on the pass mark is skipped.",
      "Use the comparison that includes the pass mark itself: at least 40, not more than 40.",
    ],
    off_by_one: [
      "Check whether your loop looks at every mark, including the very first one.",
      "Work out your function by hand for a list of three passing marks. How many marks does your loop actually visit?",
      "A range that begins at one skips the mark at position zero.",
      "Loop over the marks themselves instead of over positions, so none can be skipped.",
    ],
    generic: [
      "Work out the first visible example by hand: which marks pass?",
      "Compare your count with your hand count. Is one particular mark being treated the wrong way?",
      "Every mark that is 40 or above passes — check both the comparison and what gets added to your count.",
      "Your count should start at zero and grow by one for each passing mark.",
    ],
  },
};

const FIRST_N_SQUARES: Challenge = {
  id: "first-n-squares",
  title: "First N Squares",
  fn: "first_n_squares",
  signature: "first_n_squares(n)",
  difficulty: "easy",
  concepts: ["loops_range", "boundaries"],
  description: "Return the list of the first n square numbers: 1, 4, 9, … up to n². When n is 0, return an empty list.",
  inputs: "n: a whole number, 0 or more",
  starter: `def first_n_squares(n):
    squares = []
    for i in range(1, n + 2):
        squares.append(i * i)
    return squares
`,
  visible: [
    { args: [5], expected: [1, 4, 9, 16, 25], edge: null },
    { args: [1], expected: [1], edge: "single" },
    { args: [3], expected: [1, 4, 9], edge: null },
  ],
  hidden: [
    { args: [0], expected: [], edge: "n_zero", short: true },
    { args: [2], expected: [1, 4], edge: null },
    { args: [4], expected: [1, 4, 9, 16], edge: null },
    { args: [6], expected: [1, 4, 9, 16, 25, 36], edge: null },
    { args: [7], expected: [1, 4, 9, 16, 25, 36, 49], edge: null },
    { args: [10], expected: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100], edge: null },
  ],
  edges: {
    n_zero: { one: "a case where n is 0", many: "cases where n is 0", boundary: true },
    single: { one: "a case where n is 1", many: "cases where n is 1", boundary: true },
  },
  stepRule: "list",
  resultNoun: "list",
  targets: ["off_by_one", "boundary_comparison", "unhandled_short_input", "print_not_return"],
  targetReasons: {
    off_by_one: "Getting exactly n squares means the end of your range must be exactly right.",
    boundary_comparison: "Its smallest case, n of 0, must give an empty list.",
    unhandled_short_input: "n can be 0, so your code has to cope with having nothing to build.",
    print_not_return: "The result is a whole list that must be handed back, not printed.",
  },
  mechanisms: {
    off_by_one: "Check where your range stops: it decides exactly which squares get made, and right now that stop is one step off.",
    unhandled_short_input: "Line {line} writes into a position the list doesn't have when n is 0.",
    boundary_comparison: "Your list starts with a square already in it, so when n is 0 it can't come out empty.",
    print_not_return: "Your function prints the squares but hands back nothing.",
    generic: "Compare your list with the expected one square by square.",
    timeout: "On those inputs a loop never reaches its stopping condition.",
    crash: "Your code raises an error before it can return the list.",
  },
  probes: {
    n_zero: [0],
    single: [1],
    default: [3],
  },
  ladders: {
    off_by_one: [
      "Count the squares your function returns for the first visible example. Is it exactly n?",
      "Write down every number your range produces when n is 3. Which ones should be there?",
      "A range stops one before its second number, so the stop you choose decides whether you get one square too many.",
      "The last square should belong to n itself — make the range stop right after n, not later.",
    ],
    unhandled_short_input: [
      "What should your function do when n is 0? Try it by hand before anything else runs.",
      "With n of 0, how long is your list before you put the first square into it?",
      "Putting a value into position zero only works if the list already has a position zero — an empty list has none.",
      "Build the list by adding each square to the end as you go, so an empty result never needs a first slot.",
    ],
    boundary_comparison: [
      "Your function is right for most n. Which value of n is the smallest one allowed?",
      "Work out by hand what your function returns when n is 0. How many squares should there be?",
      "Starting the list with the first square already inside means it can never come out empty.",
      "Start with an empty list and let the loop decide whether any squares belong in it.",
    ],
    generic: [
      "Compare your result with the first visible example, square by square.",
      "Which numbers are you squaring? Write them down for n of 3.",
      "The squares should be of 1, 2 and so on up to n — no more and no fewer.",
      "Keep each square in a list and hand the whole list back at the end.",
    ],
  },
};

const MIDDLE_THREE: Challenge = {
  id: "middle-three",
  title: "Middle Three",
  fn: "middle_three",
  signature: "middle_three(items)",
  difficulty: "medium",
  concepts: ["lists_indexing", "boundaries"],
  description:
    "Return the middle three items of the list. If the list has fewer than three items, return the whole list.",
  inputs: "items: a list of odd length, or a list with fewer than three items",
  starter: `def middle_three(items):
    mid = len(items) // 2
    return [items[mid - 1], items[mid], items[mid + 1]]
`,
  visible: [
    { args: [[1, 2, 3, 4, 5]], expected: [2, 3, 4], edge: null },
    { args: [[7, 8, 9]], expected: [7, 8, 9], edge: "exactly_three" },
    { args: [[1, 2, 3, 4, 5, 6, 7]], expected: [3, 4, 5], edge: null },
  ],
  hidden: [
    { args: [[]], expected: [], edge: "fewer_than_three", short: true },
    { args: [[4]], expected: [4], edge: "fewer_than_three", short: true },
    { args: [[6, 2]], expected: [6, 2], edge: "fewer_than_three", short: true },
    { args: [[9, 8, 7]], expected: [9, 8, 7], edge: "exactly_three" },
    { args: [[10, 20, 30, 40, 50, 60, 70, 80, 90]], expected: [40, 50, 60], edge: null },
    { args: [[3, 1, 4, 1, 5]], expected: [1, 4, 1], edge: null },
  ],
  edges: {
    fewer_than_three: {
      one: "a list with fewer than three items",
      many: "lists with fewer than three items",
      boundary: true,
    },
    exactly_three: { one: "a list of exactly three items", many: "lists of exactly three items", boundary: true },
  },
  stepRule: "list",
  resultNoun: "list",
  targets: ["unhandled_short_input", "boundary_comparison", "off_by_one", "print_not_return"],
  targetReasons: {
    unhandled_short_input:
      "Lists with fewer than three items must come back unchanged, so you have to check the length before indexing.",
    boundary_comparison: "The line between 'short' and 'long' sits exactly at three items.",
    off_by_one: "The window has to be centred exactly — one place off and every answer shifts.",
    print_not_return: "The middle items must be handed back as a list, not printed.",
  },
  mechanisms: {
    unhandled_short_input: "Line {line} reads positions that a list with fewer than three items doesn't have.",
    off_by_one: "Your window is shifted by one place, so it isn't centred.",
    boundary_comparison: "Your length check sends a list of exactly three items down the wrong path.",
    print_not_return: "Your function prints the middle items but hands back nothing.",
    generic: "Work out the middle position by hand for one of these lists.",
    timeout: "On those inputs a loop never reaches its stopping condition.",
    crash: "Your code raises an error before it can return the middle items.",
  },
  probes: {
    fewer_than_three: [[5, 6]],
    exactly_three: [[7, 8, 9]],
    default: [[1, 2, 3, 4, 5]],
  },
  ladders: {
    unhandled_short_input: [
      "All your visible examples have at least three items. What should happen when the list is shorter than that?",
      "Work out your function by hand for a list of two items. Which positions do you try to read?",
      "Reading a position that the list doesn't have raises an error, and a short list has no middle three.",
      "Check the length before you look for the middle, and hand the list back unchanged when it is too short.",
    ],
    boundary_comparison: [
      "Your function handles long lists. Check the shortest list that still has a middle three.",
      "For a list of exactly three items, does your length test send it down the right path?",
      "A length test that is off by one sends a three-item list to the wrong branch.",
      "Decide whether three items counts as short or not, and make your comparison say exactly that.",
    ],
    off_by_one: [
      "Check which three items you return for the first visible example — are they centred?",
      "Write down the middle position for a list of five items, then the positions on either side of it.",
      "Whole-number division gives the centre position; the items you want are one before it, it, and one after it.",
      "Make your slice start one before the centre and stop two after it.",
    ],
  },
};

const SUM_OF_DIGITS: Challenge = {
  id: "sum-of-digits",
  title: "Sum of Digits",
  fn: "sum_of_digits",
  signature: "sum_of_digits(n)",
  difficulty: "easy",
  concepts: ["loops_range", "accumulators"],
  description: "Return the sum of the decimal digits of n. For example, 123 gives 1 + 2 + 3 = 6. The sum for 0 is 0.",
  inputs: "n: a whole number, 0 or more",
  starter: `def sum_of_digits(n):
    total = 0
    while n > 9:
        total += n % 10
        n = n // 10
    return total
`,
  visible: [
    { args: [123], expected: 6, edge: null, alts: { boundary_comparison: 5 } },
    { args: [9], expected: 9, edge: "single_digit", alts: { boundary_comparison: 0 } },
    { args: [4005], expected: 9, edge: null, alts: { boundary_comparison: 5 } },
  ],
  hidden: [
    { args: [0], expected: 0, edge: "zero", alts: { boundary_comparison: 0 } },
    { args: [7], expected: 7, edge: "single_digit", alts: { boundary_comparison: 0 } },
    { args: [99], expected: 18, edge: null, alts: { boundary_comparison: 9 } },
    { args: [1000], expected: 1, edge: null, alts: { boundary_comparison: 0 } },
    { args: [98765], expected: 35, edge: null, alts: { boundary_comparison: 26 } },
    { args: [10], expected: 1, edge: null, alts: { boundary_comparison: 0 } },
  ],
  edges: {
    single_digit: { one: "a single-digit number", many: "single-digit numbers", boundary: true },
    zero: { one: "a case where n is 0", many: "cases where n is 0", boundary: true },
  },
  stepRule: "numeric",
  resultNoun: "sum",
  targets: ["boundary_comparison", "off_by_one"],
  targetReasons: {
    boundary_comparison: "The loop has to keep going right up to the last digit — the boundary is a number with one digit left.",
    off_by_one: "Every digit must be visited exactly once.",
  },
  mechanisms: {
    boundary_comparison:
      "Your loop condition on line {line} stops while one digit is still left, so the first digit is never added.",
    generic: "Add the digits up by hand for one of these numbers and compare.",
    timeout: "Your loop never reaches its stopping condition — check that the number gets smaller every time.",
    crash: "Your code raises an error before it can return the sum.",
  },
  probes: { single_digit: [5], zero: [0], default: [123] },
  ladders: {
    boundary_comparison: [
      "Try your function on a single-digit number. Does that digit get added?",
      "Trace your loop for a two-digit number and write down which digits are added before it stops.",
      "Your loop stops while one digit is still left, because its test only keeps going while the number is bigger than a single digit.",
      "Keep looping as long as there is any digit left at all — that is, while the number is still above zero.",
    ],
  },
};

const COUNT_VOWELS: Challenge = {
  id: "count-vowels",
  title: "Count Vowels",
  fn: "count_vowels",
  signature: "count_vowels(text)",
  difficulty: "easy",
  concepts: ["strings", "accumulators"],
  description: "Return how many vowels (a, e, i, o, u) are in the text. Capital vowels count too.",
  inputs: "text: a string, possibly empty",
  starter: `def count_vowels(text):
    count = 0
    for ch in text:
        if ch in "aeiou":
            count += 1
    return count
`,
  visible: [
    { args: ["hello"], expected: 2, edge: null },
    { args: ["sky"], expected: 0, edge: null },
    { args: ["Programming"], expected: 3, edge: null },
  ],
  hidden: [
    { args: [""], expected: 0, edge: "empty" },
    { args: ["AEIOU"], expected: 5, edge: "uppercase" },
    { args: ["Rainbow Road"], expected: 5, edge: null },
    { args: ["Umbrella"], expected: 3, edge: "uppercase" },
    { args: ["xyz"], expected: 0, edge: null },
    { args: ["Queueing"], expected: 5, edge: null },
  ],
  edges: {
    uppercase: { one: "a word with a capital vowel", many: "words with capital vowels" },
    empty: { one: "an empty string", many: "empty strings", boundary: true },
  },
  stepRule: "none",
  resultNoun: "count",
  targets: ["print_not_return"],
  targetReasons: { print_not_return: "The count must be handed back to the caller, not printed." },
  mechanisms: {
    generic: "Python compares letters exactly, so a capital vowel and a small one are different characters.",
    timeout: "On those inputs your loop never finishes.",
    crash: "Your code raises an error before it can return a count.",
  },
  probes: { uppercase: ["Ice"], empty: [""], default: ["hello"] },
  ladders: {
    generic: [
      "Your count is right for some words. Look at the words where it is too low — what kind of letters do they have?",
      "Is a capital vowel still a vowel? Check how your test treats one.",
      "Comparing letters is case-sensitive in Python, so a capital vowel doesn't match a small one.",
      "Turn each letter into one case before you compare it, so both kinds match.",
    ],
  },
};

const GRADE_LETTER: Challenge = {
  id: "grade-letter",
  title: "Grade Letter",
  fn: "grade_letter",
  signature: "grade_letter(score)",
  difficulty: "easy",
  concepts: ["conditionals", "boundaries"],
  description:
    'Return the grade for a score: "A" for 90 or more, "B" for 80 or more, "C" for 70 or more, "D" for 60 or more, otherwise "F".',
  inputs: "score: a whole number from 0 to 100",
  starter: `def grade_letter(score):
    if score > 90:
        return "A"
    elif score > 80:
        return "B"
    elif score > 70:
        return "C"
    elif score > 60:
        return "D"
    else:
        return "F"
`,
  visible: [
    { args: [95], expected: "A", edge: null },
    { args: [85], expected: "B", edge: null },
    { args: [42], expected: "F", edge: null },
  ],
  hidden: [
    { args: [90], expected: "A", edge: "on_cutoff" },
    { args: [80], expected: "B", edge: "on_cutoff" },
    { args: [70], expected: "C", edge: "on_cutoff" },
    { args: [60], expected: "D", edge: "on_cutoff" },
    { args: [59], expected: "F", edge: null },
    { args: [100], expected: "A", edge: null },
    { args: [0], expected: "F", edge: null },
  ],
  edges: {
    on_cutoff: {
      one: "a score sitting exactly on a grade boundary",
      many: "scores sitting exactly on a grade boundary",
      boundary: true,
    },
  },
  stepRule: "grade",
  resultNoun: "grade",
  targets: ["boundary_comparison"],
  targetReasons: {
    boundary_comparison: "Four grade boundaries, and a score sitting exactly on one must get the higher grade.",
  },
  mechanisms: {
    boundary_comparison:
      "Your comparisons leave out scores that sit exactly on a boundary, so they drop to the grade below.",
    generic: "Check each grade boundary in the task against your comparisons.",
    timeout: "Your function never finishes on those inputs.",
    crash: "Your code raises an error before it can return a grade.",
  },
  probes: { on_cutoff: [70], default: [95] },
  ladders: {
    boundary_comparison: [
      "Your grades are right away from the boundaries. Try a score sitting exactly on one.",
      "The task says 90 or more is an A. What does your function give for a score of exactly 90?",
      "A strictly-greater test sends a score that sits exactly on a boundary down to the grade below.",
      "Use comparisons that include the boundary score itself, for every grade.",
    ],
  },
};

const IS_LEAP_YEAR: Challenge = {
  id: "is-leap-year",
  title: "Is Leap Year",
  fn: "is_leap_year",
  signature: "is_leap_year(year)",
  difficulty: "medium",
  concepts: ["conditionals", "boundaries"],
  description:
    "Return True if the year is a leap year. A year is a leap year if it divides by 4 — except whole centuries, which are leap years only if they divide by 400.",
  inputs: "year: a whole number, 1 or more",
  starter: `def is_leap_year(year):
    return year % 4 == 0
`,
  visible: [
    { args: [2024], expected: true, edge: null },
    { args: [2023], expected: false, edge: null },
    { args: [1996], expected: true, edge: null },
  ],
  hidden: [
    { args: [1900], expected: false, edge: "century" },
    { args: [2000], expected: true, edge: "century" },
    { args: [2100], expected: false, edge: "century" },
    { args: [1600], expected: true, edge: "century" },
    { args: [2019], expected: false, edge: null },
    { args: [2028], expected: true, edge: null },
  ],
  edges: {
    century: { one: "a whole-century year", many: "whole-century years" },
  },
  stepRule: "none",
  resultNoun: "answer",
  targets: ["print_not_return"],
  targetReasons: { print_not_return: "The answer must be handed back as True or False, not printed." },
  mechanisms: {
    generic: "Whole centuries follow a different rule from other years — check the task again.",
    timeout: "Your function never finishes on those inputs.",
    crash: "Your code raises an error before it can return an answer.",
  },
  probes: { century: [1700], default: [2024] },
  ladders: {
    generic: [
      "Your function is right for most years. Look at years that end in 00.",
      "Is 1700 a leap year? Check the rule for whole centuries in the task, then compare with your function.",
      "Centuries are an exception to the divide-by-four rule, and centuries that divide by 400 are an exception to that exception.",
      "Check the most specific rule first — dividing by 400 — then whole centuries, then the four-year rule.",
    ],
  },
};

const SECOND_LARGEST: Challenge = {
  id: "second-largest",
  title: "Second Largest",
  fn: "second_largest",
  signature: "second_largest(nums)",
  difficulty: "medium",
  concepts: ["lists_indexing", "conditionals"],
  description:
    "Return the second largest DIFFERENT value in the list, or None if there are fewer than two different values. Don't change the list you are given.",
  inputs: "nums: a list of whole numbers, possibly empty",
  starter: `def second_largest(nums):
    nums.sort()
    return nums[-2]
`,
  visible: [
    { args: [[3, 1, 4]], expected: 3, edge: null },
    { args: [[10, 20]], expected: 10, edge: null },
    { args: [[5, 9, 2, 7]], expected: 7, edge: null },
  ],
  hidden: [
    { args: [[]], expected: null, edge: "too_short", short: true },
    { args: [[42]], expected: null, edge: "too_short", short: true },
    { args: [[7, 7, 7]], expected: null, edge: "all_same" },
    { args: [[4, 4, 1]], expected: 1, edge: "duplicates" },
    { args: [[-3, -1, -2]], expected: -2, edge: "negatives" },
    { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9]], expected: 8, edge: null },
  ],
  edges: {
    too_short: { one: "a list with fewer than two numbers", many: "lists with fewer than two numbers", boundary: true },
    all_same: { one: "a list where every number is the same", many: "lists where every number is the same" },
    duplicates: { one: "a list where the largest number appears twice", many: "lists where the largest number appears more than once" },
    negatives: { one: "a list of negative numbers", many: "lists of negative numbers" },
  },
  stepRule: "none",
  checkInputUnchanged: true,
  resultNoun: "value",
  targets: ["mutates_input", "unhandled_short_input"],
  targetReasons: {
    mutates_input: "It is easy to solve by rearranging the caller's list — the tests check that you don't.",
    unhandled_short_input: "Lists with fewer than two numbers must give None instead of crashing.",
  },
  mechanisms: {
    mutates_input: "Line {line} sorts the caller's list in place, so their list is changed after your function returns.",
    unhandled_short_input: "Line {line} reads the second-from-last item, which a list with fewer than two numbers doesn't have.",
    generic: "Second largest means the second largest DIFFERENT value — repeats of the largest don't count.",
    timeout: "Your function never finishes on those inputs.",
    crash: "Your code raises an error before it can return a value.",
  },
  probes: { too_short: [[8]], duplicates: [[6, 6, 2]], all_same: [[3, 3]], default: [[3, 1, 4]] },
  ladders: {
    mutates_input: [
      "After your function runs, look at the list you passed in. Is it still in the order you gave it?",
      "Call your function on a list, then print that same list afterwards. What changed?",
      "Sorting a list in place rearranges the caller's list too, because both names point at the very same list.",
      "Work on a sorted copy instead of the original — Python has a built-in that hands back a new sorted list and leaves the old one alone.",
    ],
    unhandled_short_input: [
      "What should happen when there aren't two different numbers to choose from?",
      "Try your function by hand on a list with just one number. Which position do you read?",
      "Asking for the second-from-last item of a list that has fewer than two items raises an error.",
      "Count the different values first, and hand back None when there are fewer than two.",
    ],
    generic: [
      "Your answer is right when all the numbers are different. What if the biggest number appears twice?",
      "Work out by hand what the second largest different value is in a list where the top number repeats.",
      "Second largest means the second largest distinct value, so repeats of the largest don't count.",
      "Remove the repeats first — Python has a built-in collection that keeps only one copy of each value.",
    ],
  },
};

const ROTATE_LEFT: Challenge = {
  id: "rotate-left",
  title: "Rotate Left",
  fn: "rotate_left",
  signature: "rotate_left(items, k)",
  difficulty: "hard",
  concepts: ["lists_indexing", "boundaries"],
  description:
    "Return a NEW list with the first k items moved to the end. k can be larger than the list — then it keeps wrapping around. Don't change the list you are given.",
  inputs: "items: a list, possibly empty · k: a whole number, 0 or more",
  starter: `def rotate_left(items, k):
    return items[k:] + items[:k]
`,
  visible: [
    { args: [[1, 2, 3, 4, 5], 2], expected: [3, 4, 5, 1, 2], edge: null },
    { args: [["a", "b", "c"], 1], expected: ["b", "c", "a"], edge: null },
    { args: [[7, 8], 0], expected: [7, 8], edge: null },
  ],
  hidden: [
    { args: [[], 3], expected: [], edge: "empty", short: true },
    { args: [[1, 2, 3], 3], expected: [1, 2, 3], edge: "k_eq_len" },
    { args: [[1, 2, 3], 4], expected: [2, 3, 1], edge: "k_gt_len" },
    { args: [[1, 2, 3, 4], 6], expected: [3, 4, 1, 2], edge: "k_gt_len" },
    { args: [[9], 5], expected: [9], edge: "k_gt_len" },
    { args: [[5, 6, 7, 8, 9], 1], expected: [6, 7, 8, 9, 5], edge: null },
  ],
  edges: {
    empty: { one: "an empty list", many: "empty lists", boundary: true },
    k_eq_len: { one: "a case where k equals the length of the list", many: "cases where k equals the length of the list", boundary: true },
    k_gt_len: {
      one: "a case where k is larger than the length of the list",
      many: "cases where k is larger than the length of the list",
      boundary: true,
    },
  },
  stepRule: "list",
  checkInputUnchanged: true,
  resultNoun: "list",
  targets: ["boundary_comparison", "unhandled_short_input", "mutates_input", "off_by_one"],
  targetReasons: {
    boundary_comparison: "This one is built around the boundary between k and len(items).",
    unhandled_short_input: "An empty list is allowed, so your code must cope before doing any arithmetic.",
    mutates_input: "The result must be a NEW list — the caller's list has to stay untouched.",
    off_by_one: "One position too far or too short shows up immediately in a rotation.",
  },
  mechanisms: {
    boundary_comparison:
      "When k is larger than the list, your slices don't wrap around, so the list comes back rotated by the wrong amount.",
    unhandled_short_input: "Line {line} divides by the length of the list, which is zero for an empty list.",
    mutates_input: "Line {line} changes the caller's list instead of building a new one.",
    off_by_one: "Your rotation is one place off.",
    generic: "Rotate one of these lists by hand, one step at a time, and compare.",
    timeout: "Your function never finishes on those inputs.",
    crash: "Your code raises an error before it can return the rotated list.",
  },
  probes: { k_gt_len: [[1, 2], 3], k_eq_len: [[4, 5], 2], empty: [[], 2], default: [[1, 2, 3, 4, 5], 2] },
  ladders: {
    boundary_comparison: [
      "Your rotation works while k is smaller than the list. What should happen when k goes past the end?",
      "Rotating a list of three items by three puts everything back where it started. So what should rotating by four look like?",
      "Rotating by k is the same as rotating by the remainder of k divided by the length, because each full turn changes nothing.",
      "Python has an operator that gives the remainder of a division — use it to shrink k before you slice, and remember that an empty list has no length to divide by.",
    ],
    unhandled_short_input: [
      "What happens to your code when the list is empty?",
      "Work through your function by hand for an empty list and k of 2. Which step fails?",
      "Dividing by the length of an empty list means dividing by zero, which Python refuses to do.",
      "Handle the empty list first and hand it straight back before doing any arithmetic.",
    ],
    mutates_input: [
      "After calling your function, look at the list you passed in. Has it changed?",
      "Print the caller's list before and after the call. Which of your lines changes it?",
      "Removing and adding items changes the caller's list, because your function received that very list, not a copy.",
      "Build and hand back a brand new list made from two pieces of the original.",
    ],
  },
};

const RUNNING_MAX: Challenge = {
  id: "running-max",
  title: "Running Max",
  fn: "running_max",
  signature: "running_max(nums)",
  difficulty: "hard",
  concepts: ["accumulators", "lists_indexing"],
  description:
    "Return a list where each position holds the largest number seen so far. For [1, 3, 2, 5] that is [1, 3, 3, 5]. An empty list gives an empty list.",
  inputs: "nums: a list of whole numbers (they may be negative), possibly empty",
  starter: `def running_max(nums):
    result = []
    best = 0
    for x in nums:
        if x > best:
            best = x
        result.append(best)
    return result
`,
  visible: [
    { args: [[1, 3, 2, 5]], expected: [1, 3, 3, 5], edge: null },
    { args: [[4, 4, 4]], expected: [4, 4, 4], edge: null },
    { args: [[2, 9]], expected: [2, 9], edge: null },
  ],
  hidden: [
    { args: [[]], expected: [], edge: "empty", short: true },
    { args: [[-5, -2, -9]], expected: [-5, -2, -2], edge: "negatives" },
    { args: [[7]], expected: [7], edge: null },
    { args: [[3, 1, 2, 0]], expected: [3, 3, 3, 3], edge: null },
    { args: [[-1, 0, -3, 4]], expected: [-1, 0, 0, 4], edge: "negatives" },
    { args: [[10, 20, 30]], expected: [10, 20, 30], edge: null },
  ],
  edges: {
    negatives: { one: "a list that starts with negative numbers", many: "lists that start with negative numbers" },
    empty: { one: "an empty list", many: "empty lists", boundary: true },
  },
  stepRule: "none",
  resultNoun: "list",
  targets: ["unhandled_short_input", "print_not_return"],
  targetReasons: {
    unhandled_short_input: "Starting from the first number is natural — but the list can be empty.",
    print_not_return: "The whole running list must be handed back, not printed.",
  },
  mechanisms: {
    generic: "Your running maximum starts at a value that negative numbers can never beat.",
    unhandled_short_input: "Line {line} reads the first number, which an empty list doesn't have.",
    timeout: "Your function never finishes on those inputs.",
    crash: "Your code raises an error before it can return the list.",
  },
  probes: { negatives: [[-4, -8]], empty: [[]], default: [[1, 3, 2, 5]] },
  ladders: {
    generic: [
      "Your function works when the numbers are positive. Try it by hand on a list of negative numbers.",
      "What is the biggest value seen so far before you have looked at any number at all?",
      "Starting the running maximum at zero means a negative number can never beat it.",
      "Start the running maximum from the first number in the list itself, not from a made-up value.",
    ],
  },
};

const UNIQUE_IN_ORDER: Challenge = {
  id: "unique-in-order",
  title: "Unique In Order",
  fn: "unique_in_order",
  signature: "unique_in_order(items)",
  difficulty: "hard",
  concepts: ["lists_indexing", "accumulators"],
  description:
    "Return a NEW list with the repeats removed, keeping each value the first time it appears. Don't change the list you are given.",
  inputs: "items: a list of numbers or strings, possibly empty",
  starter: `def unique_in_order(items):
    i = 0
    while i < len(items):
        if items[i] in items[:i]:
            items.pop(i)
        else:
            i += 1
    return items
`,
  visible: [
    { args: [[1, 2, 1, 3]], expected: [1, 2, 3], edge: null },
    { args: [["a", "a", "b"]], expected: ["a", "b"], edge: null },
    { args: [[5]], expected: [5], edge: null },
  ],
  hidden: [
    { args: [[]], expected: [], edge: "empty", short: true },
    { args: [[2, 2, 2, 2]], expected: [2], edge: "all_same" },
    { args: [[3, 1, 3, 1, 2]], expected: [3, 1, 2], edge: null },
    { args: [[0, -1, 0, -1]], expected: [0, -1], edge: null },
    { args: [["x", "y", "z"]], expected: ["x", "y", "z"], edge: null },
    { args: [[1, 2, 3, 2, 1]], expected: [1, 2, 3], edge: null },
  ],
  edges: {
    empty: { one: "an empty list", many: "empty lists", boundary: true },
    all_same: { one: "a list where every item is the same", many: "lists where every item is the same" },
  },
  stepRule: "none",
  checkInputUnchanged: true,
  resultNoun: "list",
  targets: ["mutates_input"],
  targetReasons: {
    mutates_input: "It is built so that the obvious in-place solution changes the caller's list — you have to build a new one.",
  },
  mechanisms: {
    mutates_input: "Line {line} removes items from the caller's list, so their list is changed after your function returns.",
    generic: "Remove the repeats by hand for one of these lists and compare.",
    timeout: "One of your loops never reaches its stopping condition.",
    crash: "Your code raises an error before it can return the list.",
  },
  probes: { all_same: [[4, 4]], empty: [[]], default: [[1, 2, 1, 3]] },
  ladders: {
    mutates_input: [
      "Your answers look right, but check the list you were given after your function finishes.",
      "Print the caller's list before and after calling your function. Are they the same?",
      "Removing items from the list you were handed changes the caller's list, because it is the very same list.",
      "Start a brand new empty list and only add each value the first time you see it.",
    ],
  },
};

/* ───────────────────────── Bug Factory templates (OB3) ─────────────────────────
 * One deliberately buggy program per mistake category, each with a known
 * culprit line. "Find it" (click the line) then "Fix it" (a real challenge
 * with real hidden tests — it feeds mastery and recurrence like any other).
 */

const BF_BOUNDARY: Challenge = {
  id: "bf-count-at-least",
  title: "Bug Factory · Count At Least",
  fn: "count_at_least",
  signature: "count_at_least(values, cutoff)",
  difficulty: "easy",
  concepts: ["conditionals", "boundaries"],
  description: "Return how many values are AT LEAST the cutoff. This program has one bug. Find the line, then fix it.",
  inputs: "values: a list of whole numbers, possibly empty · cutoff: a whole number",
  starter: `def count_at_least(values, cutoff):
    count = 0
    for v in values:
        if v > cutoff:
            count += 1
    return count
`,
  visible: [
    { args: [[5, 10, 15], 10], expected: 2, edge: "at_cutoff" },
    { args: [[1, 2, 3], 5], expected: 0, edge: null },
    { args: [[8, 9], 1], expected: 2, edge: null },
  ],
  hidden: [
    { args: [[], 3], expected: 0, edge: "empty" },
    { args: [[7], 7], expected: 1, edge: "at_cutoff" },
    { args: [[4, 4, 4], 4], expected: 3, edge: "at_cutoff" },
    { args: [[10, 20, 30], 25], expected: 1, edge: null },
    { args: [[0, -1, -2], -1], expected: 2, edge: "at_cutoff" },
    { args: [[6, 6, 7], 6], expected: 3, edge: "at_cutoff" },
  ],
  edges: {
    at_cutoff: { one: "a case where a value equals the cutoff", many: "cases where a value equals the cutoff", boundary: true },
    empty: { one: "an empty list", many: "empty lists", boundary: true },
  },
  stepRule: "numeric",
  resultNoun: "count",
  targets: ["boundary_comparison"],
  targetReasons: { boundary_comparison: "It was generated from your boundary_comparison mistakes." },
  mechanisms: {
    boundary_comparison: "The comparison on line {line} leaves out values equal to the cutoff.",
    generic: "Count by hand for a list that contains the cutoff itself.",
  },
  probes: { at_cutoff: [[3, 5], 3], default: [[5, 10, 15], 10] },
  ladders: {},
  bugFactory: { tag: "boundary_comparison", culpritLine: 4, lesson: "A strictly-greater test leaves out the cutoff value itself." },
  unlisted: true,
};

const BF_SHORT: Challenge = {
  id: "bf-first-and-last",
  title: "Bug Factory · First and Last",
  fn: "first_and_last",
  signature: "first_and_last(items)",
  difficulty: "easy",
  concepts: ["lists_indexing", "boundaries"],
  description:
    "Return a list holding the first and the last item. A list with one item gives that item twice; an empty list gives an empty list. One bug — find it, then fix it.",
  inputs: "items: a list, possibly empty",
  starter: `def first_and_last(items):
    first = items[0]
    last = items[-1]
    return [first, last]
`,
  visible: [
    { args: [[1, 2, 3]], expected: [1, 3], edge: null },
    { args: [["a", "b"]], expected: ["a", "b"], edge: null },
    { args: [[5, 6, 7, 8]], expected: [5, 8], edge: null },
  ],
  hidden: [
    { args: [[]], expected: [], edge: "empty", short: true },
    { args: [[9]], expected: [9, 9], edge: "single" },
    { args: [[0, 0]], expected: [0, 0], edge: null },
    { args: [[3, 1, 4, 1, 5]], expected: [3, 5], edge: null },
    { args: [[-1, -2]], expected: [-1, -2], edge: null },
  ],
  edges: {
    empty: { one: "an empty list", many: "empty lists", boundary: true },
    single: { one: "a list with one item", many: "lists with one item", boundary: true },
  },
  stepRule: "list",
  resultNoun: "list",
  targets: ["unhandled_short_input"],
  targetReasons: { unhandled_short_input: "It was generated from your unhandled_short_input mistakes." },
  mechanisms: { unhandled_short_input: "Line {line} reads the first item, which an empty list doesn't have." },
  probes: { empty: [[]], default: [[1, 2, 3]] },
  ladders: {},
  bugFactory: { tag: "unhandled_short_input", culpritLine: 2, lesson: "Reading position 0 of an empty list raises IndexError." },
  unlisted: true,
};

const BF_OFF_BY_ONE: Challenge = {
  id: "bf-sum-first-n",
  title: "Bug Factory · Sum First N",
  fn: "sum_first_n",
  signature: "sum_first_n(nums, n)",
  difficulty: "easy",
  concepts: ["loops_range", "accumulators"],
  description: "Return the total of the first n numbers in the list (n is never larger than the list). One bug — find it, then fix it.",
  inputs: "nums: a list of whole numbers · n: a whole number from 0 to the length of the list",
  starter: `def sum_first_n(nums, n):
    total = 0
    for i in range(n - 1):
        total += nums[i]
    return total
`,
  visible: [
    { args: [[1, 2, 3, 4], 2], expected: 3, edge: null },
    { args: [[5, 5, 5], 3], expected: 15, edge: null },
    { args: [[10], 1], expected: 10, edge: null },
  ],
  hidden: [
    { args: [[1, 1, 1, 1], 4], expected: 4, edge: null },
    { args: [[2, 4, 6], 0], expected: 0, edge: "n_zero" },
    { args: [[3, 6, 9, 12], 3], expected: 18, edge: null },
    { args: [[7, 8], 1], expected: 7, edge: null },
    { args: [[100, 200, 300], 2], expected: 300, edge: null },
  ],
  edges: { n_zero: { one: "a case where n is 0", many: "cases where n is 0", boundary: true } },
  stepRule: "sum",
  resultNoun: "total",
  targets: ["off_by_one"],
  targetReasons: { off_by_one: "It was generated from your off_by_one mistakes." },
  mechanisms: { off_by_one: "The range on line {line} stops one number too early, so one number is never added." },
  probes: { default: [[1, 2, 3, 4], 2] },
  ladders: {},
  bugFactory: { tag: "off_by_one", culpritLine: 3, lesson: "A range stops just before its stop value." },
  unlisted: true,
};

const BF_PRINT: Challenge = {
  id: "bf-average",
  title: "Bug Factory · Average",
  fn: "average",
  signature: "average(nums)",
  difficulty: "easy",
  concepts: ["accumulators"],
  description: "Return the average of the numbers (the list is never empty). One bug — find it, then fix it.",
  inputs: "nums: a non-empty list of numbers",
  starter: `def average(nums):
    total = 0
    for x in nums:
        total += x
    print(total / len(nums))
`,
  visible: [
    { args: [[2, 4]], expected: 3.0, edge: null },
    { args: [[1, 2, 3]], expected: 2.0, edge: null },
    { args: [[10]], expected: 10.0, edge: null },
  ],
  hidden: [
    { args: [[5, 5, 5, 5]], expected: 5.0, edge: null },
    { args: [[1, 2]], expected: 1.5, edge: null },
    { args: [[0, 0, 9]], expected: 3.0, edge: null },
    { args: [[-2, 2]], expected: 0.0, edge: null },
    { args: [[7, 8, 9]], expected: 8.0, edge: null },
  ],
  edges: {},
  stepRule: "none",
  floatResult: true,
  resultNoun: "average",
  targets: ["print_not_return"],
  targetReasons: { print_not_return: "It was generated from your print_not_return mistakes." },
  mechanisms: { print_not_return: "Line {line} shows the average on screen, but the function hands back nothing." },
  probes: { default: [[2, 4]] },
  ladders: {},
  bugFactory: { tag: "print_not_return", culpritLine: 5, lesson: "Printing shows a value; only returning hands it back." },
  unlisted: true,
};

const BF_MUTATES: Challenge = {
  id: "bf-sorted-copy",
  title: "Bug Factory · Sorted Copy",
  fn: "sorted_copy",
  signature: "sorted_copy(nums)",
  difficulty: "easy",
  concepts: ["lists_indexing"],
  description: "Return a NEW sorted list, leaving the list you were given unchanged. One bug — find it, then fix it.",
  inputs: "nums: a list of numbers, possibly empty",
  starter: `def sorted_copy(nums):
    nums.sort()
    return nums
`,
  visible: [
    { args: [[3, 1, 2]], expected: [1, 2, 3], edge: null },
    { args: [[5]], expected: [5], edge: null },
    { args: [[2, 2, 1]], expected: [1, 2, 2], edge: null },
  ],
  hidden: [
    { args: [[]], expected: [], edge: null },
    { args: [[9, 8, 7, 6]], expected: [6, 7, 8, 9], edge: null },
    { args: [[-1, 3, 0]], expected: [-1, 0, 3], edge: null },
    { args: [[4, 4]], expected: [4, 4], edge: null },
    { args: [[10, 1, 5, 3]], expected: [1, 3, 5, 10], edge: null },
  ],
  edges: {},
  stepRule: "none",
  checkInputUnchanged: true,
  resultNoun: "list",
  targets: ["mutates_input"],
  targetReasons: { mutates_input: "It was generated from your mutates_input mistakes." },
  mechanisms: { mutates_input: "Line {line} sorts the caller's own list instead of a copy." },
  probes: { default: [[3, 1, 2]] },
  ladders: {},
  bugFactory: { tag: "mutates_input", culpritLine: 2, lesson: "Sorting in place changes the caller's list." },
  unlisted: true,
};

const BF_DIRECTION: Challenge = {
  id: "bf-last-two",
  title: "Bug Factory · Last Two",
  fn: "last_two",
  signature: "last_two(items)",
  difficulty: "easy",
  concepts: ["lists_indexing"],
  description: "Return the LAST two items as a list (or the whole list if it has fewer than two). One bug — find it, then fix it.",
  inputs: "items: a list, possibly empty",
  starter: `def last_two(items):
    return items[:2]
`,
  visible: [
    { args: [[1, 2, 3]], expected: [2, 3], edge: null, alts: { wrong_index_direction: [1, 2] } },
    { args: [["a", "b", "c", "d"]], expected: ["c", "d"], edge: null, alts: { wrong_index_direction: ["a", "b"] } },
    { args: [[5, 6]], expected: [5, 6], edge: null, alts: { wrong_index_direction: [5, 6] } },
  ],
  hidden: [
    { args: [[7]], expected: [7], edge: null, alts: { wrong_index_direction: [7] } },
    { args: [[]], expected: [], edge: null, alts: { wrong_index_direction: [] } },
    { args: [[1, 2, 3, 4, 5]], expected: [4, 5], edge: null, alts: { wrong_index_direction: [1, 2] } },
    { args: [[9, 8, 7]], expected: [8, 7], edge: null, alts: { wrong_index_direction: [9, 8] } },
    { args: [[0, 1, 0]], expected: [1, 0], edge: null, alts: { wrong_index_direction: [0, 1] } },
  ],
  edges: {},
  stepRule: "list",
  resultNoun: "list",
  targets: ["wrong_index_direction"],
  targetReasons: { wrong_index_direction: "It was generated from your wrong_index_direction mistakes." },
  mechanisms: { wrong_index_direction: "The slice on line {line} takes items from the start, not the end." },
  probes: { default: [[1, 2, 3]] },
  ladders: {},
  bugFactory: { tag: "wrong_index_direction", culpritLine: 2, lesson: "A slice from the start gives the first items, not the last." },
  unlisted: true,
};

export const CHALLENGES: Challenge[] = [
  COUNT_PASSES,
  FIRST_N_SQUARES,
  SUM_OF_DIGITS,
  COUNT_VOWELS,
  GRADE_LETTER,
  LAST_K_TOTAL,
  MIDDLE_THREE,
  IS_LEAP_YEAR,
  SECOND_LARGEST,
  ROTATE_LEFT,
  RUNNING_MAX,
  UNIQUE_IN_ORDER,
  BF_BOUNDARY,
  BF_SHORT,
  BF_OFF_BY_ONE,
  BF_PRINT,
  BF_MUTATES,
  BF_DIRECTION,
];

/** The four judge challenges, exactly as the statement specifies them. */
export const JUDGE_CHALLENGE_IDS = ["last-k-total", "count-passes", "first-n-squares", "middle-three"] as const;

const BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

export function getChallenge(id: string): Challenge | undefined {
  return BY_ID.get(id);
}

export function listedChallenges(): Challenge[] {
  return CHALLENGES.filter((c) => !c.unlisted);
}

export function bugFactoryChallenges(): Challenge[] {
  return CHALLENGES.filter((c) => c.bugFactory);
}
