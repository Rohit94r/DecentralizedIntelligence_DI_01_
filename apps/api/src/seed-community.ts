/**
 * Demo community: three teachers, the AI mentor, the three demo learners
 * (rohan — new, riya — in the middle, khushi — finished everything) and two
 * classmates, with everyday threads: a boundary question with an accepted
 * teacher answer, tips, a class discussion, a showcase, a first-day hello,
 * a bug-bounty thread, and a solution that stays blurred until you've solved
 * that problem yourself.
 *
 * Text only uses values that are already public (task descriptions, visible
 * tests) — the harness checks it like every other response.
 */
import { MENTOR, spoilerCheck } from "@layerflow/core";
import type { LayerflowStore } from "@layerflow/db";

const H = 3_600_000;

export function seedCommunity(store: LayerflowStore, now = Date.now()): void {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * H).toISOString();

  store.upsertProfile({ id: MENTOR.id, display_name: "Priya", role: "mentor_ai", avatar: MENTOR.avatar, bio: "Layerflow's AI mentor. Guides you to the bug — never hands you the code.", at: at(400) });
  store.upsertProfile({ id: "teacher_james", display_name: "James Wilson", role: "teacher", avatar: "/people/james.jpg", bio: "Teaches Python to Year 11. Loves a good edge case.", at: at(399) });
  store.upsertProfile({ id: "teacher_sarah", display_name: "Sarah Chen", role: "teacher", avatar: "/people/sarah.jpg", bio: "CS lecturer · first-year programming · trace tables forever.", at: at(398) });
  store.upsertProfile({ id: "teacher_michael", display_name: "Michael Brown", role: "teacher", avatar: "/people/michael.jpg", bio: "Senior engineer. Reviews student repos on Fridays.", at: at(397) });
  store.upsertProfile({ id: "khushi", display_name: "Khushi", role: "student", bio: "Final-year CS · solved every Layerflow problem", at: at(300) });
  store.upsertProfile({ id: "riya", display_name: "Riya", role: "student", bio: "Second year · learning Python one bug at a time", at: at(110) });
  store.upsertProfile({ id: "rohan", display_name: "Rohan", role: "student", bio: "Day one — just joined!", at: at(2) });
  store.upsertProfile({ id: "aarav", display_name: "Aarav", role: "student", bio: "Robotics club · Python for sensors", at: at(160) });
  store.upsertProfile({ id: "sneha", display_name: "Sneha", role: "student", bio: "BCA first year", at: at(140) });

  const post = (p: { author: string; kind: "question" | "discussion" | "tip" | "showcase"; title: string; body: string; challenge?: string; h: number }) =>
    store.createPost({ author_id: p.author, kind: p.kind, title: p.title, body: p.body, challenge_id: p.challenge ?? null, spoiler: spoilerCheck(`${p.title}\n${p.body}`, p.challenge).spoiler, at: at(p.h) });
  const reply = (postId: number, author: string, body: string, h: number, challenge?: string, ai = false) =>
    store.addReply({ post_id: postId, author_id: author, body, spoiler: spoilerCheck(body, challenge).spoiler, ai, at: at(h) });
  const votes = (target: "post" | "reply", id: number, who: string[]) => who.forEach((v) => store.vote(v, target, id, 1));

  // 1 · a boundary question → teacher answer, accepted
  const p1 = post({
    author: "riya",
    kind: "question",
    challenge: "count-passes",
    title: "Why does a mark of exactly 40 break my count?",
    body: "All my visible tests pass, but one hidden test fails and it says it's a case right on the boundary. I check if the mark is more than 40. Is 40 a pass or not?",
    h: 80,
  });
  reply(p1, MENTOR.id, "That feeling when everything looks right is so common! Read the task sentence once more, slowly, and look at the exact words it uses for the pass mark. Then work out by hand what your check says for a mark that is exactly 40.", 79.9, "count-passes", true);
  const a1 = reply(p1, "teacher_james", "Great question — this is THE classic boundary bug. The task says “40 or more is a pass”. “More than 40” and “40 or more” agree on every mark except one: 40 itself. Whenever a task gives you a cut-off, ask: is the cut-off value itself in or out?", 78, "count-passes");
  reply(p1, "khushi", "I had the exact same bug on my first day. Try the first example by hand: count_passes([40, 39, 41]) should give 2. Does yours?", 77, "count-passes");
  reply(p1, "riya", "Got it — it was the words “or more”. All hidden tests pass now. Thank you!", 75, "count-passes");
  store.acceptReply(p1, a1);
  votes("post", p1, ["khushi", "aarav", "sneha"]);
  votes("reply", a1, ["riya", "khushi"]);

  // 2 · a tip
  const p2 = post({
    author: "khushi",
    kind: "tip",
    title: "Write the loop numbers on paper before you submit",
    body: "For a tiny input like n = 3, I write down every number my range visits. It caught most of my off-by-one bugs. Remember: range stops just BEFORE the second number.",
    h: 60,
  });
  reply(p2, "teacher_sarah", "This is exactly how professionals debug — it's a trace table. The Replay button on every result does the same thing step by step.", 59);
  reply(p2, "aarav", "Trying this tonight.", 50);
  votes("post", p2, ["riya", "aarav", "sneha", "teacher_sarah"]);

  // 3 · a crash question → AI mentor + teacher
  const p3 = post({
    author: "riya",
    kind: "question",
    challenge: "last-k-total",
    title: "IndexError on hidden tests — what does “k larger than the list” mean?",
    body: "My code works for the three examples but crashes on some hidden tests. The explanation says they're cases where k is larger than the number of marks. How can k be larger?",
    h: 40,
  });
  reply(p3, MENTOR.id, "Crashes on hidden tests are a useful clue — they tell you which kind of input to think about. Imagine someone asks for the total of a student's last k marks, but the student has fewer than k marks. What would a sensible answer be? Decide that in words first.", 39.9, "last-k-total", true);
  reply(p3, "teacher_michael", "Then look at where your loop starts: when k is bigger than the list, that starting position becomes negative. The task description says what to return in that case.", 38, "last-k-total");
  votes("post", p3, ["khushi"]);

  // 4 · a teacher-led discussion
  const p4 = post({
    author: "teacher_sarah",
    kind: "discussion",
    title: "Explain return vs print to a 10-year-old",
    body: "Reply with your best one-sentence explanation. Mine: print is talking out loud — return is handing someone a note they can keep.",
    h: 52,
  });
  const a4 = reply(p4, "khushi", "print shows it on the screen; return puts it in your pocket so you can use it later.", 51);
  reply(p4, "riya", "print = saying the answer out loud. return = writing it on the answer sheet the teacher actually marks.", 48);
  reply(p4, "teacher_james", "Riya's “answer sheet” is spot on — the tests only ever read the answer sheet.", 47);
  store.acceptReply(p4, a4);
  votes("post", p4, ["khushi", "riya", "aarav", "teacher_james"]);

  // 5 · a showcase
  const p5 = post({
    author: "khushi",
    kind: "showcase",
    title: "Finished all 12 practice problems",
    body: "Took me 12 days. What helped most: reading the explanation before asking for a hint, and using Replay on the first failing example. Next stop: the Bug Bounty programs.",
    h: 20,
  });
  reply(p5, "teacher_james", "Well done, Khushi. If you want a stretch, try PayLite in Bug Bounty — the money bugs are tricky.", 19);
  reply(p5, "riya", "Congrats! I'm on problem 4. Any tip for Last K Total?", 18);
  votes("post", p5, ["riya", "aarav", "sneha", "teacher_sarah", "teacher_james"]);

  // 6 · a spoiler — blurred for anyone who hasn't solved Sum of Digits
  const p6 = post({
    author: "khushi",
    kind: "discussion",
    challenge: "sum-of-digits",
    title: "My Sum of Digits solution (spoiler)",
    body: "Took me two tries. This is what worked:\n\n```python\ndef sum_of_digits(n):\n    total = 0\n    while n > 0:\n        total += n % 10\n        n = n // 10\n    return total\n```\n\nThe trick was the loop condition.",
    h: 14,
  });
  reply(p6, "teacher_sarah", "Nice — Layerflow blurs this for anyone who hasn't solved it yet, so they still get to find it themselves. Can you say in one sentence WHY your first loop condition skipped a digit?", 13, "sum-of-digits");

  // 7 · a first-day hello
  const p7 = post({
    author: "rohan",
    kind: "question",
    title: "First day here — where should I start?",
    body: "Hi everyone, I just joined. I know a little Python (loops, if/else). Which problem should I try first?",
    h: 1.5,
  });
  reply(p7, MENTOR.id, "Welcome, Rohan! Start with Count Passes on the Practice page — it's short and teaches the most common bug (boundaries). Solve one problem a day and your streak starts earning points.", 1.4, undefined, true);
  reply(p7, "khushi", "Welcome! Count Passes first, then First N Squares. Don't skip reading the task sentence — most bugs hide there.", 1);
  reply(p7, "teacher_sarah", "Welcome to the class! When something fails, read the plain-English explanation first, then try a hint.", 0.8);
  votes("post", p7, ["khushi", "riya"]);

  // 8 · a question about hidden tests → teacher answer, accepted
  const p8 = post({
    author: "aarav",
    kind: "question",
    title: "What exactly are “hidden tests”?",
    body: "My code passes the 3 examples I can see, but then it says some hidden tests fail. Why can't I see them?",
    h: 30,
  });
  const a8 = reply(p8, "teacher_michael", "Hidden tests check cases you didn't think of — empty lists, one item, values right on a boundary. If you could see them, you'd write code for those exact numbers instead of the real rule. You still get told WHAT kind of case failed, just not the values.", 29);
  store.acceptReply(p8, a8);
  votes("post", p8, ["sneha", "rohan"]);

  // 9 · a tip
  const p9 = post({
    author: "sneha",
    kind: "tip",
    title: "Use Replay before asking for a hint",
    body: "Replay runs your code step by step on the failing example. Half the time I spot the bug myself and keep my mastery score higher.",
    h: 26,
  });
  reply(p9, "riya", "Didn't know hints lower the score a little. Good to know!", 24);
  votes("post", p9, ["khushi", "aarav"]);

  // 10 · a bug-bounty discussion (no spoilers)
  const p10 = post({
    author: "teacher_james",
    kind: "discussion",
    title: "Bug Bounty: share your first confirmed bug (no spoilers!)",
    body: "Say which program and what KIND of bug it was — not the line or the fix, so others can still find it.",
    h: 10,
  });
  reply(p10, "khushi", "ShopKart — an injection bug. The trick was following the search text all the way to where the query is built.", 9.5);
  reply(p10, "riya", "ShopKart too — a logic bug on the products page. I worked out page 1 by hand and it clicked.", 8);
  votes("post", p10, ["khushi", "riya", "sneha"]);

  // 11 · a streak question → AI mentor + teacher
  const p11 = post({
    author: "riya",
    kind: "question",
    title: "Does a failed attempt count for my streak?",
    body: "I tried a problem yesterday but didn't pass it. My streak still went down. Is that right?",
    h: 5,
  });
  reply(p11, MENTOR.id, "Good question! A streak day needs a solve: at least one passing submission, or a bug report that gets confirmed. Attempts still help your skills, they just don't count as a streak day.", 4.9, undefined, true);
  reply(p11, "teacher_sarah", "Tip: if you're short on time, re-solving an easy problem you already know still counts for the day.", 4);
  votes("post", p11, ["aarav"]);

  // 12 · a rewards showcase
  const p12 = post({
    author: "khushi",
    kind: "showcase",
    title: "My sticker pack arrived",
    body: "Redeemed 1,500 points for the Bug Hunter sticker pack — they're on my laptop now. Saving the rest for the cap.",
    h: 3,
  });
  reply(p12, "sneha", "So cool. How long did it take to get 1,500 points?", 2.5);
  reply(p12, "khushi", "About two weeks of streak days plus a few bug-bounty finds.", 2.2);
  votes("post", p12, ["riya", "sneha", "aarav", "rohan"]);
}
