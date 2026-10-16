/** Sample data for the landing page showcase (the live product uses the API). */
export const masteryBoard = [
  { name: "meera", mastery: 78, cleared: 9, streak: 6, rank: 1, color: "#5e2ac4", initial: "M" },
  { name: "rohan", mastery: 64, cleared: 7, streak: 3, rank: 2, color: "#359462", initial: "R" },
  { name: "kabir", mastery: 58, cleared: 5, streak: 1, rank: 3, color: "#c64e27", initial: "K" },
  { name: "ananya", mastery: 55, cleared: 5, streak: 4, rank: 4, color: "#0ea5e9", initial: "A" },
  { name: "dev", mastery: 49, cleared: 3, streak: 2, rank: 5, color: "#94cd59", initial: "D" },
];

export const heatmapData: number[][] = (() => {
  let seed = 2026;
  const next = () => {
    seed = (seed * 16807 + 11) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const weeks: number[][] = [];
  for (let w = 0; w < 52; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const roll = next();
      let level = 0;
      if (roll > 0.3) level = 1;
      if (roll > 0.55) level = 2;
      if (roll > 0.78) level = 3;
      if (roll > 0.92) level = 4;
      if (d >= 1 && d <= 5 && level > 0 && next() > 0.4) level = Math.min(4, level + 1);
      week.push(level);
    }
    weeks.push(week);
  }
  return weeks;
})();

/** Share of diagnosed failures per mistake category (sample cohort). */
export const mistakeTags = [
  { name: "unhandled_short_input", color: "#c64e27", count: 41 },
  { name: "boundary_comparison", color: "#f59e0b", count: 37 },
  { name: "off_by_one", color: "#359462", count: 29 },
  { name: "print_not_return", color: "#0586d2", count: 18 },
  { name: "mutates_input", color: "#7B35F0", count: 12 },
  { name: "wrong_index_direction", color: "#ec4899", count: 6 },
];

export const progressStats = { hostile: "15/15", labels: "12/12", leaks: 0, recurring: 2 };

export const weeklyPractice = [
  { day: "Mon", attempts: 14 },
  { day: "Tue", attempts: 9 },
  { day: "Wed", attempts: 18 },
  { day: "Thu", attempts: 11 },
  { day: "Fri", attempts: 16 },
  { day: "Sat", attempts: 22 },
  { day: "Sun", attempts: 7 },
];

export const streakData = { currentStreak: 6, longestStreak: 11, weeklyGoalPercent: 72 };

export const LAST_K_STARTER = `def last_k_total(marks, k):
    total = 0
    for i in range(len(marks) - k, len(marks)):
        total += marks[i]
    return total`;

/** The statement's own model ladder, verbatim — what the real product serves for this bug. */
export const MODEL_LADDER = [
  "Your three examples never ask for more marks than the list holds. What should last_k_total return when k is bigger than the list?",
  "Work out last_k_total([2, 5], 3) by hand. Which index does your loop start at, and what does marks[-1] mean in Python?",
  "In Python a negative index counts back from the end, so some marks get added twice. Your start index must never go below 0.",
  "Python has a built-in that returns the larger of two numbers. Use it to work out the start index once, before the loop.",
];

export const LADDERS: Record<string, { fn: string; tag: string; rungs: string[] }> = {
  "last-k-total": { fn: "last_k_total", tag: "unhandled_short_input", rungs: MODEL_LADDER },
  "count-passes": {
    fn: "count_passes",
    tag: "boundary_comparison",
    rungs: [
      "Your result is off by one only on some lists. What do those lists have in common?",
      "Look at a mark of exactly 40. The task says 40 is a pass — does your test count it?",
      "A strictly-greater test leaves out the value it compares against, so a mark sitting exactly on the pass mark is skipped.",
      "Use the comparison that includes the pass mark itself: at least 40, not more than 40.",
    ],
  },
  "first-n-squares": {
    fn: "first_n_squares",
    tag: "off_by_one",
    rungs: [
      "Count the squares your function returns for the first visible example. Is it exactly n?",
      "Write down every number your range produces when n is 3. Which ones should be there?",
      "A range stops one before its second number, so the stop you choose decides whether you get one square too many.",
      "The last square should belong to n itself — make the range stop right after n, not later.",
    ],
  },
};
