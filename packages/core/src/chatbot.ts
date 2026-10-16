/**
 * "Ask Priya" — the chat assistant on every page.
 *
 * Two modes, one rule set:
 *   • general  (landing, practice, dashboard…) — explains Python ideas and how
 *     Layerflow works. Tiny illustrative snippets are allowed; defining a
 *     function is not (that is how a chatbot quietly writes someone's answer).
 *   • challenge (on a problem page / in a mentor session) — the same rules as
 *     the hint ladder: prose only, no code, no answer, no hidden-test value.
 *
 * `localReply()` answers with zero API keys. When an LLM is configured, its
 * reply must pass `guardReply()`; a reply that fails is logged and replaced by
 * the local one — exactly how hints and explanations are handled.
 */
import { callString } from "./compare.ts";
import { ladderFor, isAnswerRequest, validateHint } from "./hints.ts";
import { findLeak } from "./secrecy.ts";
import { TAG_LABELS } from "./taxonomy.ts";
import type { Challenge, LadderKey, LineMap, MistakeTag } from "./types.ts";

export interface ChatContext {
  page?: string;
  learnerName?: string;
  challenge?: Challenge | null;
  /** the learner's latest code on this challenge (their own — public to them) */
  code?: string;
  latest?: { passed: boolean; tags: MistakeTag[]; explanation: string; analysis: LineMap | null; ladderKey: LadderKey } | null;
  /** how many chat turns already asked about this challenge (drives the rung) */
  turn?: number;
}

export interface ChatReply {
  reply: string;
  suggestions: string[];
  intent: string;
}

/* ───────────────────────── beginner glossary ───────────────────────── */

interface Concept {
  keys: RegExp;
  title: string;
  /** prose — safe in every mode */
  simple: string;
  /** tiny illustration — general mode only, never a function definition */
  example?: string;
}

const GLOSSARY: Concept[] = [
  {
    keys: /\b(variable|variables|assign)/i,
    title: "Variables",
    simple: "A variable is a labelled box that holds a value. You put something in, and later you use the label to get it back. Putting a new value in the same box replaces the old one.",
    example: "age = 15\nage = age + 1   # the box now holds 16",
  },
  {
    keys: /\b(list|lists|array)\b/i,
    title: "Lists",
    simple: "A list is a row of boxes kept in order. Each box has a position number, and the first position is 0, not 1. A list can grow, shrink and be changed after you make it.",
    example: "marks = [72, 40, 95]\nmarks[0]   # 72 — the first item\nlen(marks) # 3 — how many items",
  },
  {
    keys: /\b(index|indexing|position|negative index)/i,
    title: "Indexing",
    simple: "Indexing means asking a list for the item at a position. Positions start at 0. Negative positions count from the end, so position -1 is the last item. Asking for a position that doesn't exist raises an IndexError.",
    example: "items = ['a', 'b', 'c']\nitems[0]   # 'a'\nitems[-1]  # 'c' — the last one",
  },
  {
    keys: /\b(slice|slicing)\b/i,
    title: "Slicing",
    simple: "A slice copies a stretch of a list: you give a start and a stop, and you get every item from the start up to — but not including — the stop. A slice never raises an error for going too far; it just gives you fewer items.",
    example: "nums = [1, 2, 3, 4, 5]\nnums[1:3]  # [2, 3]\nnums[-2:]  # [4, 5] — the last two",
  },
  {
    keys: /\b(for loop|loop|loops|iterate|iteration)\b/i,
    title: "Loops",
    simple: "A for loop repeats the same steps once for every item. Think of it as: 'for each mark in the list, do this'. The loop variable holds the current item on every pass.",
    example: "for mark in [72, 40, 95]:\n    print(mark)   # prints 72, then 40, then 95",
  },
  {
    keys: /\brange\b/i,
    title: "range()",
    simple: "range gives you a run of whole numbers. It starts at the first number and stops just BEFORE the second one — that 'stops before' rule is the most common cause of off-by-one mistakes.",
    example: "list(range(1, 4))  # [1, 2, 3] — 4 is not included\nlist(range(3))     # [0, 1, 2]",
  },
  {
    keys: /\bwhile\b/i,
    title: "while loops",
    simple: "A while loop keeps going as long as its condition is true. Something inside the loop must move it towards stopping, otherwise it runs forever and the sandbox stops it with a timeout.",
    example: "n = 3\nwhile n > 0:\n    n = n - 1   # moves towards stopping",
  },
  {
    keys: /\b(return|print vs return|print or return|returning)\b/i,
    title: "return vs print",
    simple: "print shows a value on the screen for a human. return hands a value back to whoever called the function — that's what the tests check. A function that only prints hands back None, so the tests see None.",
    example: "print(5)    # shows 5, hands back nothing\n# a function that ends with return hands its value to the caller",
  },
  {
    keys: /\b(function|functions|def|parameter|argument)\b/i,
    title: "Functions",
    simple: "A function is a named recipe. You give it inputs (its parameters), it does some steps, and it hands back one result with return. Calling it means running the recipe with real inputs.",
    example: "len([4, 5, 6])   # calling the built-in function len → 3",
  },
  {
    keys: /\b(if|else|elif|condition|conditional)\b/i,
    title: "if / else",
    simple: "if lets your code choose. Python checks the condition; if it's true it runs that block, otherwise it moves on to the elif or else. Be careful with the edge value itself — 'more than 40' and 'at least 40' disagree exactly at 40.",
    example: "mark = 40\nif mark >= 40:\n    print('pass')   # 40 counts as a pass",
  },
  {
    keys: /\b(string|strings|text|character)\b/i,
    title: "Strings",
    simple: "A string is text inside quotes. It behaves like a list of characters: you can loop over it, index it and slice it — but you can't change a character in place; you build a new string instead.",
    example: "word = 'hello'\nword[0]       # 'h'\nword.upper()  # 'HELLO'",
  },
  {
    keys: /\b(dict|dictionary|dictionaries|key value)\b/i,
    title: "Dictionaries",
    simple: "A dictionary stores pairs: a key and its value, like a word and its meaning. You look things up by key instead of by position. Asking for a key that isn't there raises a KeyError.",
    example: "ages = {'asha': 15, 'ravi': 16}\nages['asha']  # 15",
  },
  {
    keys: /\b(none|null)\b/i,
    title: "None",
    simple: "None means 'no value'. It's what a function hands back when it never reaches a return. If a test expected a number and got None, the function probably printed instead of returning.",
  },
  {
    keys: /\b(mutat|in place|copy|copies|\.sort|sorted)\w*/i,
    title: "Changing a list vs copying it",
    simple: "When you pass a list to a function, the function gets the SAME list, not a copy. If it sorts or edits that list, the caller's list changes too. sorted() and slicing make a new list and leave the original alone.",
    example: "a = [3, 1, 2]\nb = sorted(a)  # b is [1, 2, 3], a is still [3, 1, 2]",
  },
  {
    keys: /\b(off.by.one|off by 1|one too many|one too few)\b/i,
    title: "Off-by-one",
    simple: "An off-by-one mistake means a loop runs one time too many or one time too few, or a range stops one step early or late. The answer is almost right — that 'almost' is the clue. Write down every number your loop visits for a tiny input.",
  },
  {
    keys: /\b(edge case|edge cases|boundary|corner case)\b/i,
    title: "Edge cases",
    simple: "Edge cases are the unusual-but-allowed inputs: an empty list, a single item, zero, the smallest or largest allowed value, a value exactly on a boundary. Most hidden tests are edge cases, so always ask 'what if the input is tiny?'",
  },
  {
    keys: /\b(hidden test|hidden tests|visible test)\b/i,
    title: "Hidden tests",
    simple: "Visible tests are the examples you can see. Hidden tests check the same rules on inputs you can't see — usually edge cases. Layerflow tells you how many failed and what KIND of input they were, but never the exact values, so you learn to think about edges yourself.",
  },
  {
    keys: /\b(indexerror|index error|out of range)\b/i,
    title: "IndexError",
    simple: "IndexError means your code asked a list for a position that doesn't exist — like asking for the 5th item of a 3-item list. It usually happens on short or empty inputs. Check the length before you read a position.",
  },
  {
    keys: /\b(typeerror|type error)\b/i,
    title: "TypeError",
    simple: "TypeError means a value is the wrong kind for what you're doing — like adding a number to None, or calling len on a number. Look at what that line receives.",
  },
  {
    keys: /\b(zerodivision|divide by zero|division by zero)\b/i,
    title: "ZeroDivisionError",
    simple: "ZeroDivisionError means something was divided by zero — often an average of an empty list. Decide what the answer should be for an empty input and handle it first.",
  },
  {
    keys: /\b(keyerror|key error)\b/i,
    title: "KeyError",
    simple: "KeyError means you looked up a dictionary key that isn't there. Check that the key exists first, or use .get with a default.",
  },
  {
    keys: /\b(nameerror|name error|not defined)\b/i,
    title: "NameError",
    simple: "NameError means Python doesn't know that name — usually a typo, or a variable used before it was given a value.",
  },
  {
    keys: /\b(syntaxerror|syntax error|indentation|indentationerror)\b/i,
    title: "Syntax & indentation",
    simple: "A SyntaxError means Python can't read the code — a missing colon, bracket or quote. Python also uses indentation (the spaces at the start of a line) to know which lines belong to a loop or an if, so keep them consistent.",
  },
  {
    keys: /\b(recursion|recursive)\b/i,
    title: "Recursion",
    simple: "Recursion is a function that calls itself on a smaller version of the problem. It always needs a stopping case, otherwise it never ends and Python stops it with a RecursionError.",
  },
  {
    keys: /\b(debug|debugging|find the bug|how to fix)\b/i,
    title: "How to debug",
    simple: "Debugging in four steps: 1) pick the smallest input that fails, 2) work out the right answer by hand, 3) follow your code line by line on that input, 4) the first line where your notes and the code disagree is the bug. The Replay button does step 3 for you.",
  },
];

/* ───────────────────────── product help ───────────────────────── */

const HELP: { keys: RegExp; text: string; suggestions?: string[] }[] = [
  {
    keys: /\b(what is layerflow|what does layerflow|how does (this|layerflow) work|how to use|getting started|where do i start|new here|beginner)\b/i,
    text: "Welcome! Layerflow is a practice gym for Python mistakes. 1) Open **Practice** and pick a problem. 2) Write your code and press **Submit**. 3) Layerflow runs visible AND hidden tests, names your mistake, and points at the line to look at. 4) Stuck? Press **Hint** — each hint is a little sharper, but never the answer. 5) Your **Dashboard** shows which mistakes keep coming back and what to practise next.",
    suggestions: ["Which problem should I start with?", "What is a hidden test?", "How do hints work?"],
  },
  {
    keys: /\b(hint|hints)\b.*\b(work|how)|\bhow.*\bhints?\b/i,
    text: "Hints come in four steps: a nudge, a specific pointer to your line, the reason it goes wrong, and finally the Python feature to use (named in words). Asking for the answer only moves you ONE step — Layerflow never hands over code, because finding the fix yourself is what makes it stick.",
  },
  {
    keys: /\b(mentor|mentoring|priya|session|meet)\b/i,
    text: "Open **Mentoring** in the sidebar. You'll see every problem you've tried and what went wrong. Pick one and press **Join session** — I'll walk you through your own code, and **Summarise** turns it into an animated step-by-step replay of where it breaks.",
  },
  {
    keys: /\b(repo|repository|github|architecture|project review|scalable|scale)\b/i,
    text: "Open **Repo Analyse** in the sidebar and paste a public GitHub link. You get a health score, the problems that matter most (secrets, missing tests, giant files, routes that talk straight to the database…), a diagram of your project's layers, and a step-by-step plan to make it cleaner and easier to scale.",
  },
  {
    keys: /\b(community|forum|post|ask (a )?teacher|teachers?|students?|classmates?)\b/i,
    text: "Open **Community** in the sidebar. Ask a question about any problem, share a tip, or help someone else. Teachers answer with a badge, and the best answer can be marked as accepted. Posts with full solutions are blurred until you've solved that problem yourself, so nobody gets spoiled.",
  },
  {
    keys: /\b(dashboard|progress|mastery|streak|recurring)\b/i,
    text: "Your **Dashboard** shows mastery per concept (it grows when you pass without hints), the mistakes that recurred across DIFFERENT problems, and the next problem picked to fix your weakest spot — with the reason why.",
  },
  {
    keys: /\b(replay|time.?travel|step by step|trace)\b/i,
    text: "**Replay** runs your own code on a small, safe example and shows every line with the values of your variables, one step at a time. The step where things first go wrong is highlighted. It's like watching your code think.",
  },
  {
    keys: /\b(bug factory)\b/i,
    text: "**Bug Factory** flips it around: you get a short program with ONE planted bug of the kind you struggle with. Click the line you think is broken. Spotting bugs in someone else's code trains your eyes for your own.",
  },
  {
    keys: /\b(which problem|start with|easiest|first problem|what should i (do|practi[sc]e))\b/i,
    text: "Start with **Count passes** or **Sum of digits** — both are short and teach the two most common traps (the edge value, and empty inputs). After that, your Dashboard picks the next one for you based on your mistakes.",
  },
];

/* ───────────────────────── intents ───────────────────────── */

const GREETING = /^\s*(hi|hello|hey|namaste|hii+|yo|good (morning|evening|afternoon))\b/i;
const THANKS = /\b(thanks|thank you|thx|got it|that helped)\b/i;
const WHATS_WRONG = /\b(what'?s wrong|why (is it|does it|am i) (fail|wrong)|why.*(fail|wrong|zero|error|crash|none|always|never|not)|where.*(bug|wrong|mistake)|which line|what did i do wrong|explain my (mistake|error)|not working|doesn'?t work|stuck|help me|i('m| am) lost|confus)/i;
const EXPLAIN_TASK = /\b(explain (the )?(task|question|problem)|what (does|do) (the )?(task|question|problem) (want|mean|ask)|what should (it|my function) (return|do)|i don'?t understand the (task|question|problem))\b/i;
const NEXT_STEP = /\b(next step|what now|what next|another hint|more help|hint)\b/i;

function pickConcept(message: string): Concept | null {
  for (const c of GLOSSARY) if (c.keys.test(message)) return c;
  return null;
}

function fence(code: string) {
  return "```python\n" + code + "\n```";
}

/** Deterministic reply — works offline, with no API keys at all. */
export function localReply(message: string, ctx: ChatContext = {}): ChatReply {
  const m = message.trim();
  const c = ctx.challenge ?? null;
  const name = ctx.learnerName ? `, ${ctx.learnerName}` : "";
  const latest = ctx.latest ?? null;

  if (c && isAnswerRequest(m)) {
    const ladder = ladderFor(c, latest?.ladderKey ?? "generic");
    const rung = Math.min((ctx.turn ?? 0) + 1, ladder.length);
    return {
      intent: "answer_request",
      reply: `I won't write the answer for you — you'd lose the part that makes it stick. But here's a sharper push: ${ladder[rung - 1]}`,
      suggestions: ["Which line should I look at?", "Explain the task simply", "What is an edge case?"],
    };
  }

  if (GREETING.test(m) && m.length < 40) {
    return {
      intent: "greeting",
      reply: c
        ? `Hi${name}! I'm Priya. We're on **${c.title}**. Ask me what the task means, why a test fails, or what a Python word means — I'll guide you, but I won't write the code.`
        : `Hi${name}! I'm Priya, your Layerflow mentor. Ask me anything about Python or about how Layerflow works — no question is too small.`,
      suggestions: c ? ["Explain the task simply", "What's wrong with my code?", "What is an edge case?"] : ["How does Layerflow work?", "What is a list?", "return vs print?"],
    };
  }

  if (THANKS.test(m) && m.length < 60) {
    return { intent: "thanks", reply: "Any time! Change one thing, run it again, and tell me what happened.", suggestions: c ? ["Give me another hint", "What should I practise next?"] : ["What should I practise next?"] };
  }

  if (c && EXPLAIN_TASK.test(m)) {
    const ex = c.visible[0];
    return {
      intent: "explain_task",
      reply: `**${c.title}**, in plain words: ${c.description}\n\nInputs: ${c.inputs}\n\nTry this: take the first example, ${callString(c.fn, ex.args)}, and work out the answer with pen and paper before you write any code. If you can do it by hand, you can teach Python to do it.`,
      suggestions: ["What is an edge case?", "What's wrong with my code?", "How do hints work?"],
    };
  }

  if (c && (WHATS_WRONG.test(m) || (NEXT_STEP.test(m) && latest && !latest.passed))) {
    if (!latest) {
      return {
        intent: "no_submission",
        reply: "You haven't submitted yet, so I can't see what the tests say. Press **Submit** (or Ctrl + Enter) — even a half-finished attempt helps. Then ask me again and I'll point you at the right line.",
        suggestions: ["Explain the task simply", "What is a hidden test?"],
      };
    }
    if (latest.passed) {
      return { intent: "passed", reply: "Your last attempt passed every visible and hidden test — nothing is wrong! Try explaining your solution in one sentence, then move on to the next problem.", suggestions: ["What should I practise next?"] };
    }
    const tag = latest.tags[0];
    const ladder = ladderFor(c, latest.ladderKey);
    const rung = Math.min((ctx.turn ?? 0) + 1, ladder.length);
    const line = latest.analysis?.culprit_line;
    const parts = [latest.explanation];
    if (tag) parts.push(`This kind of slip is called **${TAG_LABELS[tag].replace(/\s*\(.*\)$/, "").toLowerCase()}**.`);
    if (line) parts.push(`Start at **line ${line}**.`);
    parts.push(`My nudge: ${ladder[rung - 1]}`);
    return {
      intent: "whats_wrong",
      reply: parts.join(" "),
      suggestions: ["Give me another hint", "Show me the Replay", tag ? `What is ${TAG_LABELS[tag].replace(/\s*\(.*\)$/, "").toLowerCase()}?` : "What is an edge case?"],
    };
  }

  for (const h of HELP) {
    if (h.keys.test(m)) return { intent: "help", reply: h.text, suggestions: h.suggestions ?? ["What is a list?", "How do hints work?"] };
  }

  const concept = pickConcept(m);
  if (concept) {
    const showExample = !c && concept.example;
    return {
      intent: "concept",
      reply: `**${concept.title}** — ${concept.simple}${showExample ? "\n\n" + fence(concept.example!) : ""}`,
      suggestions: c ? ["What's wrong with my code?", "Explain the task simply"] : ["What is an edge case?", "How do I debug?", "What is a list?"].filter((s) => !s.toLowerCase().includes(concept.title.toLowerCase())),
    };
  }

  if (c && NEXT_STEP.test(m)) {
    const ladder = ladderFor(c, latest?.ladderKey ?? "generic");
    return { intent: "nudge", reply: ladder[Math.min(ctx.turn ?? 0, ladder.length - 1)], suggestions: ["Which line should I look at?", "Explain the task simply"] };
  }

  // On a problem they're failing, an unrecognised question still gets help with THEIR bug.
  if (c && latest && !latest.passed && /\?|\bwhy\b|\bhow\b/i.test(m)) return localReply("what's wrong", ctx);

  return {
    intent: "fallback",
    reply: c
      ? "Good question! I can help with three things here: what the task means, why your code fails (submit first), and any Python word you're unsure of. Which one?"
      : "I can explain any Python idea in simple words (lists, loops, range, return vs print, errors…), help you use Layerflow, or point you to the right page. What would you like to know?",
    suggestions: c ? ["Explain the task simply", "What's wrong with my code?", "What is an edge case?"] : ["How does Layerflow work?", "What is range()?", "How do I debug?"],
  };
}

/* ───────────────────────── LLM prompt + guard ───────────────────────── */

export function chatSystemPrompt(ctx: ChatContext): string {
  const c = ctx.challenge ?? null;
  const rules = [
    "You are Priya, a warm, patient Python mentor inside Layerflow, a learning app for school and first-year students.",
    "Speak simply: short sentences, everyday words, one idea at a time. Explain jargon the first time you use it. Be encouraging but honest.",
    "Keep replies under 120 words. Use **bold** for the one thing that matters most. You may use a short numbered list.",
  ];
  if (c) {
    rules.push(
      `The learner is working on the problem "${c.title}": ${c.description} Inputs: ${c.inputs}`,
      "STRICT RULES for this problem: never write code, never write a corrected line, never show the function, never give the final answer or the exact fix. Do not use code formatting or operators like =, ==, <, >, +=. Describe ideas in words. You may name a line number and a Python feature in words.",
      "Teach like a good tutor: explain WHY their code behaves the way it does, then end with ONE guiding question that leads them to the change themselves. Do not spell out what to change. Keep it under 90 words.",
      "If they ask for the answer or the code, kindly refuse and give the next small hint instead.",
      "There are hidden tests. You do not know their inputs, so never guess or invent specific hidden values.",
    );
    if (ctx.latest) {
      rules.push(
        ctx.latest.passed
          ? "Their last attempt passed every test."
          : `Their last attempt failed. What Layerflow already told them: "${ctx.latest.explanation}"${ctx.latest.analysis?.culprit_line ? ` The line to look at is line ${ctx.latest.analysis.culprit_line}.` : ""}${ctx.latest.tags[0] ? ` Mistake category: ${TAG_LABELS[ctx.latest.tags[0]]}.` : ""}`,
      );
    }
    if (ctx.code) rules.push(`Their current code (for your understanding only — do not repeat it back or rewrite it):\n${ctx.code.slice(0, 2500)}`);
  } else {
    rules.push(
      "You may show a tiny illustrative snippet (at most 4 lines) in a ```python block to explain a Python idea, but never define a function and never solve a practice problem.",
      "Layerflow pages: Practice (pick a problem), Dashboard (mastery and recurring mistakes), Mentoring (a video-call style session with you), Repo Analyse (paste a GitHub link for an architecture review), Community (students and teachers help each other), Bug Factory (find a planted bug), Hint Ledger (every hint ever given).",
    );
  }
  return rules.join("\n");
}

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

/** Every LLM chat reply passes this before it reaches a learner. */
export function guardReply(text: string, ctx: ChatContext): GuardResult {
  const t = text.trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length > 1400) return { ok: false, reason: "too long" };
  if (/\bdef\s+[A-Za-z_]\w*\s*\(/.test(t)) return { ok: false, reason: "function definition" };
  const c = ctx.challenge ?? null;
  if (c) {
    if (/```/.test(t)) return { ok: false, reason: "code block" };
    // strip markdown emphasis before the prose validator
    const prose = t.replace(/\*\*|__/g, "").replace(/`([^`]+)`/g, "$1");
    const v = validateHint(prose, { fn: c.fn });
    if (!v.ok) return { ok: false, reason: v.reasons.join(", ") };
    const leak = findLeak(t, c, [], ctx.code ?? "");
    if (leak) return { ok: false, reason: "hidden-test value" };
    if (new RegExp(`\\b${c.fn}\\b`).test(t) && /\breturn\b.*\b(sum|len|max|min|sorted)\b/.test(t)) return { ok: false, reason: "solution shape" };
  } else {
    const blocks = [...t.matchAll(/```[\s\S]*?```/g)];
    if (blocks.some((b) => b[0].split("\n").length > 8)) return { ok: false, reason: "code block too long" };
  }
  return { ok: true };
}

export const CHAT_STARTERS = {
  general: ["How does Layerflow work?", "What is a list?", "return vs print?", "How do I debug?"],
  challenge: ["Explain the task simply", "What's wrong with my code?", "Which line should I look at?", "What is an edge case?"],
};
