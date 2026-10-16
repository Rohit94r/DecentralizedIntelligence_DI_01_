/**
 * Pure unit tests for @layerflow/core — no sandbox, no server. Each detector has a
 * planted-bug test with the name the taxonomy promises (det_short_input …),
 * plus classifier order, the hint validator, mastery maths, recurrence
 * counting and a self-check of the whole challenge bank.
 *
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import {
  CHALLENGES,
  allLadderTexts,
  analyzeRepo,
  buildMentorScript,
  guardReply,
  ladderFor,
  localReply,
  parseRepoUrl,
  speakify,
  spoilerCheck,
  classify,
  detect,
  findLeak,
  getChallenge,
  listedChallenges,
  masteryValue,
  nextChallenge,
  oneStepAway,
  rollup,
  submissionDelta,
  validateHint,
  type HistoryItem,
  type RunResult,
  type TestResult,
} from "../src/index.ts";

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const ok = (ret: unknown, extra: Partial<RunResult> = {}): RunResult => ({ status: "ok", ret: ret as never, stdout: "", ms: 1, ...extra });
const err = (excType: string): RunResult => ({ status: "error", excType, excMessage: "x", stdout: "", ms: 1, phase: "call" });

function results(challengeId: string, runs: RunResult[]): TestResult[] {
  const c = getChallenge(challengeId)!;
  const cases = [...c.visible.map((x) => ["visible", x] as const), ...c.hidden.map((x) => ["hidden", x] as const)];
  let v = 0, h = 0;
  return cases.map(([kind, cs], i) => {
    const run = runs[i] ?? ok(cs.expected);
    const { outcome, detail } = classify(run, cs.expected, c);
    return { kind, test: kind === "visible" ? ++v : ++h, outcome, detail, run, case: cs };
  });
}

/* ── detectors: planted bugs ── */

test("det_short_input — last_k_total starter crashes only where k > len", () => {
  const c = getChallenge("last-k-total")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(t.expected));
  runs[5] = err("IndexError"); // hidden 3: k > len
  runs[6] = ok(90);
  runs[7] = ok(15);
  assert.equal(detect(c, results(c.id, runs)).primary, "unhandled_short_input");
});

test("det_short_input — an IndexError on a NORMAL input is not 'short input'", () => {
  const c = getChallenge("last-k-total")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(t.expected));
  runs[0] = err("IndexError"); // visible 1 is not short
  assert.notEqual(detect(c, results(c.id, runs)).primary, "unhandled_short_input");
});

test("det_print_not_return — printed the right answer, returned None", () => {
  const c = getChallenge("middle-three")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(null, { stdout: JSON.stringify(t.expected).replace(/,/g, ", ") + "\n" }));
  assert.equal(detect(c, results(c.id, runs)).primary, "print_not_return");
});

test("det_mutates_input — the caller's list changed", () => {
  const c = getChallenge("second-largest")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok(t.expected, { mutated: true }));
  const rs = results(c.id, runs);
  assert.equal(rs[0].outcome, "wrong_output");
  assert.equal(rs[0].detail, "input changed");
  assert.equal(detect(c, rs).primary, "mutates_input");
});

test("det_off_by_one — one square too many on ordinary inputs", () => {
  const c = getChallenge("first-n-squares")!;
  const runs = [...c.visible, ...c.hidden].map((t) => {
    const n = t.args[0] as number;
    return ok(Array.from({ length: n + 1 }, (_, i) => (i + 1) ** 2));
  });
  assert.equal(detect(c, results(c.id, runs)).primary, "off_by_one");
});

test("det_boundary_cmp — '> 40' is wrong only where a mark is exactly 40", () => {
  const c = getChallenge("count-passes")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok((t.args[0] as number[]).filter((m) => m > 40).length));
  assert.equal(detect(c, results(c.id, runs)).primary, "boundary_comparison");
});

test("det_boundary_cmp — the 'i > 0' loop misses the first mark only at k ≥ len", () => {
  const c = getChallenge("last-k-total")!;
  const f = (marks: number[], k: number) => {
    let t = 0, i = marks.length - 1, n = 0;
    while (n < k && i > 0) (t += marks[i]), i--, n++;
    return t;
  };
  const runs = [...c.visible, ...c.hidden].map((t) => ok(f(t.args[0] as number[], t.args[1] as number)));
  assert.equal(detect(c, results(c.id, runs)).primary, "boundary_comparison");
});

test("det_wrong_direction — first two instead of last two", () => {
  const c = getChallenge("bf-last-two")!;
  const runs = [...c.visible, ...c.hidden].map((t) => ok((t.args[0] as unknown[]).slice(0, 2)));
  assert.equal(detect(c, results(c.id, runs)).primary, "wrong_index_direction");
});

test("a passing submission has no tags", () => {
  const c = getChallenge("count-passes")!;
  assert.equal(detect(c, results(c.id, [])).primary, null);
});

/* ── classifier ── */

test("classifier order: wall clock beats everything; limits are named", () => {
  assert.equal(classify({ status: "killed", killedBy: "wall_clock", stdout: "", ms: 0 }, 1).outcome, "timeout");
  assert.deepEqual(classify({ status: "killed", killedBy: "memory", stdout: "", ms: 0 }, 1), { outcome: "runtime_error", detail: "memory limit" });
  assert.deepEqual(classify({ status: "killed", killedBy: "output", stdout: "", ms: 0 }, 1), { outcome: "runtime_error", detail: "output limit" });
  assert.equal(classify(err("IndexError"), 1).outcome, "runtime_error");
  assert.equal(classify(ok(70), 70).outcome, "passed");
  assert.equal(classify(ok("70"), 70).outcome, "wrong_output"); // type-aware
  assert.equal(classify(ok(true), 1).outcome, "wrong_output"); // True is not 1 here
  assert.equal(classify(ok(3), 3.0).outcome, "passed");
});

test("one-step rules", () => {
  assert.ok(oneStepAway("numeric", 1, 2, []));
  assert.ok(oneStepAway("sum", 10, 15, [[5, 5, 5], 3]));
  assert.ok(oneStepAway("list", [1, 4, 9, 16, 25, 36], [1, 4, 9, 16, 25], [5]));
  assert.ok(oneStepAway("list", [1, 2, 3], [2, 3, 1], [[1, 2, 3], 4]));
  assert.ok(oneStepAway("grade", "B", "A", [90]));
  assert.ok(!oneStepAway("numeric", 0, 3, []));
});

/* ── the guardrail ── */

test("validator: the statement's own model ladder passes", () => {
  for (const h of getChallenge("last-k-total")!.ladders.unhandled_short_input!) assert.ok(validateHint(h, { fn: "last_k_total" }).ok, h);
});

test("validator: code is rejected", () => {
  for (const bad of [
    "```python\nx = 1\n```",
    "Try total = sum(marks).",
    "Use max(0, len(marks) - k).",
    "if k > len(marks): return sum(marks)",
    "Write def last_k_total(marks, k): first.",
    "return total - 1",
    "Use marks[-k:] to slice.",
    "import math first",
    "Use marks[i] for each i.",
    "k == len(marks) is the edge",
    "lambda x: x",
  ]) {
    assert.ok(!validateHint(bad, { fn: "last_k_total" }).ok, bad);
  }
});

test("every hint the bank can serve passes the validator and leaks nothing", () => {
  for (const c of CHALLENGES) {
    for (const h of allLadderTexts(c)) {
      const v = validateHint(h, { fn: c.fn });
      assert.ok(v.ok, `${c.id}: ${v.reasons} — ${h}`);
      assert.equal(findLeak(h, c), null, `${c.id} leaks: ${h}`);
    }
  }
});

/* ── mastery + recurrence ── */

test("mastery: an unhinted pass counts for more than a hinted one", () => {
  const [clean] = submissionDelta(["boundaries"], true, false);
  const [hinted] = submissionDelta(["boundaries"], true, true);
  assert.ok(masteryValue({ alpha: 1 + clean.dAlpha, beta: 1 }) > masteryValue({ alpha: 1 + hinted.dAlpha, beta: 1 }));
});

const H = (challenge_id: string, tags: string[], at: string, passed = false): HistoryItem => ({ submission_id: at, challenge_id, at, tags: tags as never, passed, hints_used: 0 });

test("recurrence counts DISTINCT challenges, not submissions", () => {
  const five = Array.from({ length: 5 }, (_, i) => H("last-k-total", ["unhandled_short_input"], `2026-01-0${i + 1}`));
  assert.deepEqual(rollup(five).recurring, []);
  assert.deepEqual(rollup([...five, H("first-n-squares", ["unhandled_short_input"], "2026-01-09")]).recurring, ["unhandled_short_input"]);
});

test("next challenge targets the recurring mistake and the reason names it", () => {
  const h = [H("last-k-total", ["boundary_comparison"], "2026-01-01"), H("first-n-squares", ["boundary_comparison"], "2026-01-02")];
  const n = nextChallenge(h, []);
  assert.equal(n.basis, "recurring");
  assert.ok(n.reason.includes("boundary_comparison"));
  assert.ok(getChallenge(n.challenge_id)!.targets.includes("boundary_comparison"));
});

test("next challenge reason is never empty — even for a brand-new learner", () => {
  const n = nextChallenge([], []);
  assert.ok(n.challenge_id && n.reason.length > 10);
});

/* ── the bank itself ── */

test("bank: ≥10 challenges, ≥3 levels, ≥4 concepts, each ≥3 visible + ≥5 hidden", () => {
  const listed = listedChallenges();
  assert.ok(listed.length >= 10);
  assert.ok(new Set(listed.map((c) => c.difficulty)).size >= 3);
  assert.ok(new Set(listed.flatMap((c) => c.concepts)).size >= 4);
  for (const c of CHALLENGES) {
    assert.ok(c.visible.length >= 3 && c.hidden.length >= 5, c.id);
    for (const t of c.hidden) if (t.edge) assert.ok(c.edges[t.edge], `${c.id}: unknown edge ${t.edge}`);
  }
  for (const id of ["last-k-total", "count-passes", "first-n-squares", "middle-three"]) assert.ok(getChallenge(id), id);
});

test("bank: probes (public replay inputs) are never a hidden input, except trivially empty ones", () => {
  for (const c of CHALLENGES) {
    const hidden = new Set(c.hidden.map((t) => JSON.stringify(t.args)));
    const visible = new Set(c.visible.map((t) => JSON.stringify(t.args)));
    for (const [kind, args] of Object.entries(c.probes)) {
      const trivial = args.every((a) => (Array.isArray(a) && a.length === 0) || a === 0 || a === "");
      const inDescription = args.every((a) => typeof a === "number" && c.description.includes(String(a)));
      const isPublic = visible.has(JSON.stringify(args));
      assert.ok(trivial || inDescription || isPublic || !hidden.has(JSON.stringify(args)), `${c.id} probe ${kind} equals a hidden input`);
    }
  }
});

/* ── mentor · chat · repo · community ── */

test("chat: asking for the answer on a problem moves one rung — never code", () => {
  for (const c of listedChallenges()) {
    for (const m of ["just give me the answer", "write the code for me", "show me the full code", "solve it"]) {
      const r = localReply(m, { challenge: c, latest: null, turn: 0 });
      assert.equal(r.intent, "answer_request", `${c.id}: ${m}`);
      assert.ok(r.reply.includes(ladderFor(c, "generic")[0]), `${c.id}: first rung only`);
      assert.ok(guardReply(r.reply, { challenge: c }).ok, `${c.id}: built-in reply passes the guard`);
    }
  }
});

test("chat guard: rejects code, a function, or a hidden value on a problem page", () => {
  const c = getChallenge("last-k-total")!;
  assert.equal(guardReply("Here you go:\n```python\ndef last_k_total(marks, k):\n    return sum(marks[-k:])\n```", { challenge: c }).ok, false);
  assert.equal(guardReply("Change it to return sum(marks[-k:]) and you're done.", { challenge: c }).ok, false);
  assert.equal(guardReply("Try total = 0 before the loop.", { challenge: c }).ok, false);
  const hidden = c.hidden.find((t) => JSON.stringify(t.args).length > 8)!;
  assert.equal(guardReply(`One hidden test is last_k_total(${JSON.stringify(hidden.args[0])}, ${hidden.args[1]}).`, { challenge: c }).ok, false);
  assert.equal(guardReply("Think about what should happen when k is larger than the number of marks. Look at **line 3**.", { challenge: c }).ok, true);
});

test("chat: general mode explains a concept with a tiny example, problem mode stays prose", () => {
  const g = localReply("what is a list?");
  assert.equal(g.intent, "concept");
  assert.ok(g.reply.includes("```"));
  const p = localReply("what is a list?", { challenge: getChallenge("count-passes")! });
  assert.ok(!p.reply.includes("```"));
});

test("mentor script: never leaks a hidden value, always ends with the no-code promise", () => {
  for (const c of listedChallenges()) {
    const segs = buildMentorScript({
      learnerName: "Asha",
      mentorName: "Priya",
      challenge: c,
      attempts: 2,
      everPassed: false,
      latest: { passed: false, tags: [c.targets[0]], explanation: "All 3 visible tests pass, but 2 of the 6 hidden tests fail.", visible: [], hidden: [], analysis: { culprit_line: 3, confidence: "likely", reason: "Look at the loop." }, code: c.starter, ladderKey: c.targets[0] },
      hintsUsed: 1,
      trace: null,
      recurringWhere: { [c.targets[0]]: [c.id, "other"] },
      next: null,
    });
    assert.ok(segs.length >= 4, `${c.id}: ${segs.length} segments`);
    for (const s of segs) assert.equal(findLeak(s.say, c, [], c.starter), null, `${c.id}/${s.id}`);
    assert.ok(segs[segs.length - 1].say.includes("never hand you the code"));
  }
});

test("speakify reads code-ish text aloud naturally", () => {
  assert.equal(speakify("len(marks) - k"), "the length of marks minus k");
  assert.equal(speakify("marks[-1]"), "marks at position minus 1");
});

test("community: a full solution for a problem is a spoiler; describing the idea is not", () => {
  assert.equal(spoilerCheck("```python\ndef count_passes(marks):\n    return len([m for m in marks if m >= 40])\n```", "count-passes").spoiler, true);
  assert.equal(spoilerCheck("def count_passes(marks):\n    ...", null).spoiler, true);
  assert.equal(spoilerCheck("Read the task again: 40 itself counts as a pass. Check your comparison.", "count-passes").spoiler, false);
});

test("repo analysis: finds committed secrets WITHOUT copying the value, SQL injection, no tests", () => {
  const key = "sk-" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4";
  const r = analyzeRepo({
    source: "github",
    owner: "student",
    name: "todo-app",
    files: [
      { path: "README.md", size: 40 },
      { path: ".env", size: 60 },
      { path: "package.json", size: 200 },
      { path: "server.js", size: 900 },
      { path: "routes/todos.js", size: 700 },
    ],
    contents: {
      "README.md": "# todo",
      ".env": `OPENAI_KEY=${key}`,
      "package.json": JSON.stringify({ name: "todo", dependencies: { express: "4.0.0", pg: "8.0.0" } }),
      "server.js": `const app = require("express")();\nconst KEY = "${key}";\napp.listen(3000);`,
      "routes/todos.js": "router.get('/todos/:id', (req, res) => db.query(`SELECT * FROM todos WHERE id = ${req.params.id}`));",
    },
  });
  const ids = r.findings.map((f) => f.id);
  for (const id of ["env-committed", "secret-in-code", "sql-injection", "no-tests", "no-lockfile", "hardcoded-port", "routes-touch-db"]) assert.ok(ids.includes(id), `missing ${id} in ${ids.join(",")}`);
  assert.ok(!JSON.stringify(r).includes(key), "the secret's value must never be copied into the report");
  assert.ok(r.score < 60 && r.layers.length === 8 && r.roadmap.length > 0);
});

test("repo analysis: parameterised SQL with composed clauses is not flagged as injection", () => {
  const r = analyzeRepo({
    source: "local",
    name: "x",
    files: [{ path: "src/db.ts", size: 300 }],
    contents: { "src/db.ts": "db.prepare(`SELECT * FROM posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} LIMIT ?`).all(...args);" },
  });
  assert.ok(!r.findings.some((f) => f.id === "sql-injection"));
});

test("repo URL parsing accepts links, .git and owner/name", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/rohit94r/Apply-saas.git"), { owner: "rohit94r", name: "Apply-saas" });
  assert.deepEqual(parseRepoUrl("github.com/icancodefyi/VH26-IMPIC/tree/main/src"), { owner: "icancodefyi", name: "VH26-IMPIC" });
  assert.deepEqual(parseRepoUrl("owner/repo"), { owner: "owner", name: "repo" });
  assert.equal(parseRepoUrl("not a repo"), null);
});

test("repo bugs: a mutable default argument and an async forEach are found on the exact line", () => {
  const r = analyzeRepo({
    source: "github",
    owner: "student",
    name: "marks",
    files: [
      { path: "app/grades.py", size: 120 },
      { path: "web/save.js", size: 90 },
    ],
    contents: {
      "app/grades.py": "def add_mark(mark, marks=[]):\n    marks.append(mark)\n    return marks\n",
      "web/save.js": "async function saveAll(items) {\n  items.forEach(async (item) => {\n    await save(item);\n  });\n}\n",
    },
  });
  const md = r.bugs.find((b) => b.id.startsWith("mutable-default:"));
  const af = r.bugs.find((b) => b.id.startsWith("async-foreach:"));
  assert.ok(md && md.file === "app/grades.py" && md.line === 1 && md.practice?.href === "/bug-factory", JSON.stringify(md));
  assert.ok(af && af.file === "web/save.js" && af.line === 2, JSON.stringify(af));
  assert.ok(af.snippet.lines[af.line - af.snippet.start].includes("forEach(async"), "the snippet highlights the bug line");
});

test("repo bugs: a line holding a key is never copied into a snippet (the bug next to it still is)", () => {
  const key = "sk-" + "Z9y8X7w6V5u4T3s2R1q0P9o8N7m6";
  const r = analyzeRepo({
    source: "github",
    name: "leaky",
    files: [{ path: "server.js", size: 200 }],
    contents: { "server.js": `const app = require("express")();\nconst OPENAI_KEY = "${key}";\nusers.forEach(async (u) => notify(u));\napp.listen(3000);\n` },
  });
  assert.ok(r.bugs.some((b) => b.id.startsWith("async-foreach:")), "the bug beside the key is still reported");
  assert.ok(!JSON.stringify(r.bugs).includes(key) && !JSON.stringify(r.overview).includes(key), "the key never appears in bugs or the overview");
  for (const b of r.bugs) for (const l of b.snippet.lines) assert.ok(l.length <= 200, "snippet lines are clipped");
});

test("repo bugs: deliberate practice code and our own highlighters are not reported", () => {
  const r = analyzeRepo({
    source: "local",
    name: "x",
    files: [
      { path: "packages/core/src/bounty-programs.ts", size: 200 },
      { path: "apps/api/src/fixtures.ts", size: 100 },
      { path: "web/Code.tsx", size: 100 },
    ],
    contents: {
      "packages/core/src/bounty-programs.ts": "export const P = 1;\nconst v = jwt.decode(token);\nif (user.password === req.body.password) ok();\n",
      "apps/api/src/fixtures.ts": "items.forEach(async (x) => x);\n",
      "web/Code.tsx": "export const L = ({ l }) => <span dangerouslySetInnerHTML={{ __html: highlightLine(l) }} />;\n",
    },
  });
  assert.deepEqual(r.bugs, [], JSON.stringify(r.bugs.map((b) => b.id)));
});

test("repo overview: a Next.js + Express repo has a frontend and a backend, with languages and commands", () => {
  const r = analyzeRepo({
    source: "github",
    owner: "student",
    name: "shop",
    files: [
      { path: "README.md", size: 300 },
      { path: "package.json", size: 120 },
      { path: "client/package.json", size: 200 },
      { path: "client/app/page.tsx", size: 400 },
      { path: "client/components/Cart.tsx", size: 900 },
      { path: "server/package.json", size: 200 },
      { path: "server/index.js", size: 700 },
      { path: "server/routes/cart.js", size: 500 },
      { path: "server/models/cart.js", size: 300 },
    ],
    contents: {
      "README.md": "# Shop\n\nA small shopping cart app built to learn full-stack web development.\n",
      "package.json": JSON.stringify({ name: "shop", scripts: { dev: "concurrently npm:dev:*", test: "vitest" } }),
      "client/package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
      "server/package.json": JSON.stringify({ dependencies: { express: "4.0.0", mongoose: "8.0.0" } }),
      "server/index.js": "const app = require('express')();\napp.use('/cart', require('./routes/cart'));\napp.listen(process.env.PORT);\n",
    },
  });
  const ids = r.overview.parts.map((p) => p.id);
  for (const id of ["frontend", "backend", "database"]) assert.ok(ids.includes(id as never), `missing ${id} in ${ids}`);
  const fe = r.overview.parts.find((p) => p.id === "frontend")!;
  const be = r.overview.parts.find((p) => p.id === "backend")!;
  assert.ok(fe.languages.includes("TypeScript") && fe.tech.includes("Next.js"), JSON.stringify(fe));
  assert.ok(be.languages.includes("JavaScript") && be.tech.includes("Express"), JSON.stringify(be));
  assert.ok(r.overview.languages.length >= 2 && r.overview.languages.every((l) => l.what.length > 10));
  assert.ok(r.overview.start_here.some((s) => s.path === "server/index.js") && r.overview.start_here.every((s) => r.overview.start_here.length <= 6));
  assert.ok(r.overview.how_it_runs.length >= 3 && r.overview.how_it_runs.some((s) => s.includes("server/")), r.overview.how_it_runs.join(" / "));
  assert.ok(r.overview.commands.some((c) => c.cmd === "npm run dev"), JSON.stringify(r.overview.commands));
  assert.ok(r.overview.summary.startsWith("A small shopping cart app"), r.overview.summary);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} unit tests passed`);
if (process.argv[1]?.includes("unit")) process.exitCode = failed ? 1 : 0;
export const unitResult = { total: tests.length, failed };
