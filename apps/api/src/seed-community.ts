/**
 * Demo community: three teachers, the AI mentor, the three seed students, and
 * a handful of threads that show every feature — a teacher's accepted answer,
 * an AI-mentor reply, a tip, a class discussion, a showcase, and a spoiler
 * that stays blurred until you've solved that problem yourself.
 *
 * Text only uses values that are already public (task descriptions, visible
 * tests) — the harness checks it like every other response.
 */
import { MENTOR, spoilerCheck } from "@layerflow/core";
import type { LayerflowStore } from "@layerflow/db";

const H = 3_600_000;

export function seedCommunity(store: LayerflowStore, now = Date.now()): void {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * H).toISOString();

  store.upsertProfile({ id: MENTOR.id, display_name: "Priya", role: "mentor_ai", avatar: MENTOR.avatar, bio: "Layerflow's AI mentor. Guides you to the bug — never hands you the code.", at: at(200) });
  store.upsertProfile({ id: "teacher_james", display_name: "James Wilson", role: "teacher", avatar: "/people/james.jpg", bio: "Teaches Python to Year 11. Loves a good edge case.", at: at(199) });
  store.upsertProfile({ id: "teacher_sarah", display_name: "Sarah Chen", role: "teacher", avatar: "/people/sarah.jpg", bio: "CS lecturer · first-year programming · trace tables forever.", at: at(198) });
  store.upsertProfile({ id: "teacher_michael", display_name: "Michael Brown", role: "teacher", avatar: "/people/michael.jpg", bio: "Senior engineer. Reviews student repos on Fridays.", at: at(197) });
  store.upsertProfile({ id: "rohan", display_name: "Rohan", role: "student", bio: "Year 11 · learning Python for robotics club", at: at(96) });
  store.upsertProfile({ id: "meera", display_name: "Meera", role: "student", bio: "First-year CS · boundary-bug survivor", at: at(72) });
  store.upsertProfile({ id: "kabir", display_name: "Kabir", role: "student", bio: "Just started — week 1!", at: at(30) });

  const post = (p: { author: string; kind: "question" | "discussion" | "tip" | "showcase"; title: string; body: string; challenge?: string; h: number }) =>
    store.createPost({ author_id: p.author, kind: p.kind, title: p.title, body: p.body, challenge_id: p.challenge ?? null, spoiler: spoilerCheck(`${p.title}\n${p.body}`, p.challenge).spoiler, at: at(p.h) });
  const reply = (postId: number, author: string, body: string, h: number, challenge?: string, ai = false) =>
    store.addReply({ post_id: postId, author_id: author, body, spoiler: spoilerCheck(body, challenge).spoiler, ai, at: at(h) });

  // 1 · a boundary question → teacher answer, accepted
  const p1 = post({
    author: "meera",
    kind: "question",
    challenge: "count-passes",
    title: "Why does a mark of exactly 40 break my count?",
    body: "All my visible tests pass, but one hidden test fails and Layerflow says it's a case right on the boundary. I check if the mark is more than 40. Is 40 a pass or not?",
    h: 60,
  });
  reply(p1, MENTOR.id, "That feeling when everything looks right is so common! Read the task sentence once more, slowly, and look at the exact words it uses for the pass mark. Then work out by hand what your check says for a mark that is exactly 40.", 59.9, "count-passes", true);
  const a1 = reply(
    p1,
    "teacher_james",
    "Great question — this is THE classic boundary bug. The task says “40 or more is a pass”. “More than 40” and “40 or more” agree on every mark except one: 40 itself. Whenever a task gives you a cut-off, ask yourself: is the cut-off value itself in or out?",
    58,
    "count-passes",
  );
  reply(p1, "rohan", "I had the exact same bug last week 😅 Work out the first example by hand: count_passes([40, 39, 41]) should give 2. Does yours?", 57, "count-passes");
  reply(p1, "meera", "Got it!! It was the word “or more”. Passed all 6 hidden tests now. Thank you!", 55, "count-passes");
  store.acceptReply(p1, a1);
  store.vote("rohan", "post", p1, 1);
  store.vote("kabir", "post", p1, 1);
  store.vote("meera", "reply", a1, 1);
  store.vote("rohan", "reply", a1, 1);

  // 2 · a tip
  const p2 = post({
    author: "rohan",
    kind: "tip",
    title: "My trick for off-by-one bugs: write the loop numbers on paper",
    body: "Before I submit, I write down every number my range visits for a tiny input, like n = 3. It caught two bugs this week. Remember: range stops just BEFORE the second number!",
    h: 40,
  });
  reply(p2, "teacher_sarah", "This is exactly how professionals debug — you've just invented a trace table. The Replay button on every result does the same thing automatically, step by step.", 39);
  reply(p2, "kabir", "Trying this tonight 🙌", 30);
  store.vote("meera", "post", p2, 1);
  store.vote("kabir", "post", p2, 1);
  store.vote("teacher_sarah", "post", p2, 1);

  // 3 · a crash question → AI mentor + teacher
  const p3 = post({
    author: "kabir",
    kind: "question",
    challenge: "last-k-total",
    title: "IndexError on hidden tests — what does “k larger than the list” mean?",
    body: "My code works for the three examples but crashes on some hidden tests. The explanation says they're cases where k is larger than the number of marks. How can k be larger?",
    h: 20,
  });
  reply(
    p3,
    MENTOR.id,
    "Crashes on hidden tests are the best kind of clue — they tell you exactly which kind of input to think about. Imagine someone asks for the total of a student's last k marks, but the student has fewer than k marks. What would a sensible answer be? Decide that first, in words, before touching the code.",
    19.9,
    "last-k-total",
    true,
  );
  reply(
    p3,
    "teacher_michael",
    "Priya's right. Then look at where your loop starts: when k is bigger than the list, that starting position becomes negative. Ask yourself what the task wants in that case — it's written in the task description.",
    18,
    "last-k-total",
  );
  store.vote("rohan", "post", p3, 1);

  // 4 · a teacher-led discussion
  const p4 = post({
    author: "teacher_sarah",
    kind: "discussion",
    title: "Weekly challenge: explain return vs print to a 10-year-old",
    body: "Reply with your best one-sentence explanation. Best answer gets pinned! Mine: print is talking out loud — return is handing someone a note they can keep.",
    h: 30,
  });
  const a4 = reply(p4, "meera", "print shows it on the screen; return puts it in your pocket so you can use it later.", 29);
  reply(p4, "kabir", "print = shouting the answer. return = writing it on the answer sheet the teacher actually marks ✅", 26);
  reply(p4, "teacher_james", "Kabir's “answer sheet” is perfect — the tests only ever read the answer sheet.", 25);
  store.acceptReply(p4, a4);
  for (const v of ["rohan", "meera", "kabir", "teacher_james"]) store.vote(v, "post", p4, 1);

  // 5 · a showcase
  const p5 = post({
    author: "meera",
    kind: "showcase",
    title: "Five problems in a row without a single hint 🎉",
    body: "Boundary mistakes used to be my thing. The dashboard showed they kept coming back in different problems, so I did the Bug Factory round for them and it finally clicked.",
    h: 8,
  });
  reply(p5, "teacher_james", "Brilliant — that's the recurring-mistake → targeted-practice loop working exactly as designed. Next try Grade Letter: it has several boundaries in one problem.", 7);
  for (const v of ["rohan", "kabir", "teacher_sarah", "teacher_james"]) store.vote(v, "post", p5, 1);

  // 6 · a spoiler — blurred for anyone who hasn't solved Sum of Digits
  const p6 = post({
    author: "rohan",
    kind: "discussion",
    challenge: "sum-of-digits",
    title: "Here's how I finally solved Sum of Digits",
    body: "Took me three tries. This is what worked:\n\n```python\ndef sum_of_digits(n):\n    total = 0\n    while n > 0:\n        total += n % 10\n        n = n // 10\n    return total\n```\n\nThe trick was the loop condition.",
    h: 4,
  });
  reply(
    p6,
    "teacher_sarah",
    "Nice work, Rohan! Layerflow has blurred this for anyone who hasn't solved it yet, so they still get to find it themselves. Can you explain in one sentence WHY your first loop condition skipped a digit? Explaining it is how it sticks.",
    3,
    "sum-of-digits",
  );
}
