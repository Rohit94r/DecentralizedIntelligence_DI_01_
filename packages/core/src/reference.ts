/**
 * Correct reference solutions. Used ONLY by the harness, to prove that every
 * explicit expected literal in the challenge bank is right (each reference
 * must pass all of its own visible + hidden tests in the real sandbox).
 *
 * The API never imports this file and nothing here is ever served.
 */
export const REFERENCE: Record<string, string> = {
  "last-k-total": `def last_k_total(marks, k):
    if k >= len(marks):
        return sum(marks)
    return sum(marks[-k:]) if k > 0 else 0
`,
  "count-passes": `def count_passes(marks):
    return sum(1 for m in marks if m >= 40)
`,
  "first-n-squares": `def first_n_squares(n):
    return [i * i for i in range(1, n + 1)]
`,
  "middle-three": `def middle_three(items):
    if len(items) < 3:
        return list(items)
    mid = len(items) // 2
    return items[mid - 1:mid + 2]
`,
  "sum-of-digits": `def sum_of_digits(n):
    total = 0
    while n > 0:
        total += n % 10
        n //= 10
    return total
`,
  "count-vowels": `def count_vowels(text):
    return sum(1 for ch in text.lower() if ch in "aeiou")
`,
  "grade-letter": `def grade_letter(score):
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"
`,
  "is-leap-year": `def is_leap_year(year):
    if year % 400 == 0:
        return True
    if year % 100 == 0:
        return False
    return year % 4 == 0
`,
  "second-largest": `def second_largest(nums):
    distinct = sorted(set(nums))
    if len(distinct) < 2:
        return None
    return distinct[-2]
`,
  "rotate-left": `def rotate_left(items, k):
    if not items:
        return []
    k = k % len(items)
    return items[k:] + items[:k]
`,
  "running-max": `def running_max(nums):
    result = []
    for x in nums:
        result.append(x if not result else max(result[-1], x))
    return result
`,
  "unique-in-order": `def unique_in_order(items):
    seen = []
    for x in items:
        if x not in seen:
            seen.append(x)
    return seen
`,
  "bf-count-at-least": `def count_at_least(values, cutoff):
    count = 0
    for v in values:
        if v >= cutoff:
            count += 1
    return count
`,
  "bf-first-and-last": `def first_and_last(items):
    if not items:
        return []
    return [items[0], items[-1]]
`,
  "bf-sum-first-n": `def sum_first_n(nums, n):
    total = 0
    for i in range(n):
        total += nums[i]
    return total
`,
  "bf-average": `def average(nums):
    return sum(nums) / len(nums)
`,
  "bf-sorted-copy": `def sorted_copy(nums):
    return sorted(nums)
`,
  "bf-last-two": `def last_two(items):
    return items[-2:]
`,
};
