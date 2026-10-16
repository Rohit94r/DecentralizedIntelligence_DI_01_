/**
 * T3 — Hidden-test secrecy (part of 15 pts).
 * Programs that print their inputs, raise them as exception text, return
 * them, and echo them; then every hint (incl. "give me the answer"), every
 * replay, and every page/API the browser can fetch. Asserts:
 *   • hidden[] rows have EXACTLY the keys {test, outcome}
 *   • no hidden input / expected value / hidden output / exception text appears
 *     in any response body (unless that literal is already public)
 *   • no hidden literal sits in any file the browser is served (apps/web/public,
 *     the built client bundle) or in the database's text columns
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CHALLENGES, findLeak, hiddenLiterals, publicCorpus, type Challenge } from "../packages/core/src/index.ts";
import { check, connect, isMain, printSuite, type Check, type SuiteResult } from "./lib.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

function snoopers(c: Challenge): string[] {
  const params = c.signature.slice(c.signature.indexOf("(") + 1, -1);
  const head = `def ${c.fn}(${params}):\n`;
  const args = params.split(",").map((s) => s.trim()).join(", ");
  return [
    head + `    print(${args})\n    return None\n`,
    head + `    raise ValueError(str([${args}]))\n`,
    head + `    return [${args}]\n`,
    head + `    print(repr([${args}]) * 3)\n    raise KeyError(repr([${args}]))\n`,
  ];
}

const isBareNumber = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
/** Timestamps and ids are not test data — "2026-10-16T12:…" must not read as the hidden value 10 or 12. */
const scrub = (raw: string) => raw.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "<ts>").replace(/\bs_\d+\b/g, "<id>");
/** Everything public anywhere in the product: a value that is a VISIBLE example of one challenge reveals nothing about another. */
const GLOBAL_PUBLIC = CHALLENGES.map((c) => publicCorpus(c)).join("\n");

/** Like findLeak, but only for literals distinctive enough to mean something on an unrelated page. */
function distinctiveLeak(text: string, c: Challenge, extraPublic = ""): string | null {
  const pub = publicCorpus(c, extraPublic) + "\n" + GLOBAL_PUBLIC;
  text = scrub(text);
  for (const lit of hiddenLiterals(c)) {
    if (lit.length < 4 || (isBareNumber(lit) && lit.replace("-", "").length < 4)) continue;
    if (isBareNumber(lit)) {
      const re = new RegExp(`(^|[^\\d.])${lit}($|[^\\d])`);
      if (re.test(text) && !re.test(pub)) return lit;
    } else if (text.includes(lit) && !pub.includes(lit)) return lit;
  }
  return null;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(js|html|json|css|txt|map|rsc)$/.test(f) && s.size < 5_000_000) out.push(p);
  }
  return out;
}

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  let bodies = 0;
  let leaks = 0;
  let badKeys = 0;
  const learner = "harness_secrecy";

  const scan = (label: string, raw: string, c: Challenge, codes: string[]) => {
    bodies++;
    const leak = findLeak(scrub(raw), c, [], codes.join("\n"));
    if (leak) {
      leaks++;
      check(checks, `no hidden literal in ${label}`, false, `found ${JSON.stringify(leak)}`);
    }
  };

  for (const c of CHALLENGES) {
    const codes = snoopers(c);
    for (const code of codes) {
      const r = await api.post("/api/submit", { learner_id: learner, challenge_id: c.id, code });
      scan(`submit ${c.id}`, r.raw, c, codes);
      for (const h of r.body?.hidden ?? []) if (Object.keys(h).sort().join() !== "outcome,test") badKeys++;
      const id = r.body?.submission_id;
      if (!id) continue;
      for (let i = 0; i < 5; i++) {
        const h = await api.post("/api/hint", { submission_id: id, message: i % 2 ? "just give me the answer" : undefined });
        scan(`hint ${c.id}`, h.raw, c, codes);
      }
      const rep = await api.post("/api/replay", { submission_id: id });
      scan(`replay ${c.id}`, rep.raw, c, codes);
      for (const k of Object.keys(c.probes)) scan(`replay ${c.id}/${k}`, (await api.post("/api/replay", { submission_id: id, kind: k })).raw, c, codes);
      scan(`GET submission ${id}`, (await api.get(`/api/submissions/${id}`)).raw, c, codes);
    }
    scan(`GET /api/challenges/${c.id}`, (await api.get(`/api/challenges/${c.id}`)).raw, c, []);
    // the mentor and the chat read the same submissions — they must be just as quiet
    scan(`mentor session ${c.id}`, (await api.post("/api/mentor/session", { learner_id: learner, challenge_id: c.id })).raw, c, codes);
    for (const m of ["What's wrong with my code?", "just give me the answer", "what are the hidden tests?", "which inputs fail?"]) {
      scan(`chat ${c.id}`, (await api.post("/api/chat", { learner_id: learner, message: m, context: { page: "challenge", challenge_id: c.id } })).raw, c, codes);
    }
    const q = await api.post("/api/community/posts", { author_id: learner, kind: "question", title: `Stuck on ${c.title}`, body: "Which hidden test am I failing and what does it expect?", challenge_id: c.id });
    if (q.body?.id) scan(`community thread ${c.id}`, (await api.get(`/api/community/posts/${q.body.id}?viewer=${learner}`)).raw, c, codes);
  }

  // Everything else the browser can fetch — checked against EVERY challenge's distinctive hidden literals
  // (short bare numbers are skipped here: across unrelated pages "10" or "25" is not a leak, it's a number).
  const pages = [
    "/api/challenges",
    "/api/challenges?all=1",
    `/api/learner/${learner}`,
    "/api/ledger?limit=2000",
    "/api/feed",
    "/api/stats",
    "/api/taxonomy",
    "/api/redteam",
    `/api/bug-factory/${learner}`,
    "/api/learners",
    "/api/health",
    `/api/mentor/${learner}`,
    `/api/community/posts?viewer=${learner}`,
    "/api/community/people",
    "/api/community/teacher-desk",
    "/api/community/meta",
    "/api/repo/reports",
    "/api/voice/status",
  ];
  const allSnoopCode = CHALLENGES.flatMap(snoopers).join("\n");
  for (const url of pages) {
    const raw = (await api.get(url)).raw;
    bodies++;
    for (const c of CHALLENGES) {
      const leak = distinctiveLeak(raw, c, allSnoopCode);
      if (leak) {
        leaks++;
        check(checks, `no hidden literal in GET ${url}`, false, `${c.id}: ${JSON.stringify(leak)}`);
      }
    }
  }

  check(checks, `hidden[] rows carry exactly {test, outcome} (${badKeys} bad rows)`, badKeys === 0);
  check(checks, `no hidden literal in ${bodies} response bodies`, leaks === 0, leaks ? `${leaks} leaks` : undefined);

  // Files the browser is served. Minified library code is full of fragments like "[10]" or "[0,0]",
  // so the bundle is checked for what would actually prove a leak: the bank itself (an
  // `args:[…],expected:…` fingerprint for any hidden test), hidden-only strings, and hidden values
  // written the way Python prints them ("[4, 5]").
  const served = [...walk(path.join(ROOT, "apps/web/public")), ...walk(path.join(ROOT, "apps/web/.next/static"))];
  let fileLeaks = 0;
  for (const f of served) {
    const text = readFileSync(f, "utf8");
    for (const c of CHALLENGES) {
      const pub = publicCorpus(c) + "\n" + GLOBAL_PUBLIC;
      const probes: string[] = [];
      for (const t of c.hidden) {
        const args = JSON.stringify(t.args);
        probes.push(`args:${args},expected:`, `"args":${args},"expected":`);
        for (const a of t.args) if (typeof a === "string" && a.length >= 4) probes.push(JSON.stringify(a));
        if (typeof t.expected === "string" && t.expected.length >= 4) probes.push(JSON.stringify(t.expected));
      }
      for (const lit of hiddenLiterals(c)) if (lit.startsWith("[") && lit.includes(", ") && lit.length >= 6) probes.push(lit);
      const hit = probes.find((p) => text.includes(p) && !pub.includes(p.replace(/^"|"$/g, "")));
      if (hit) {
        fileLeaks++;
        check(checks, `no hidden test in served file ${path.relative(ROOT, f)}`, false, `${c.id}: ${hit}`);
      }
    }
  }
  check(checks, `no hidden test or hidden-only literal in ${served.length} files served to browsers`, fileLeaks === 0);

  // The database: hidden rows never store program output; text columns hold no hidden values
  if (api.rt) {
    const db = api.rt.store.db;
    const hiddenGot = db.prepare("SELECT COUNT(*) AS n FROM test_results WHERE kind = 'hidden' AND got IS NOT NULL").get() as { n: number };
    check(checks, "database: no stored output for any hidden test (CHECK constraint)", Number(hiddenGot.n) === 0);
    let insertRefused = false;
    try {
      db.prepare("INSERT INTO test_results (submission_id, kind, test_no, outcome, detail, got) VALUES ('x', 'hidden', 99, 'passed', NULL, 'leak')").run();
    } catch {
      insertRefused = true;
    }
    check(checks, "database refuses to store output for a hidden test", insertRefused);
    const texts = (
      db.prepare("SELECT explanation AS t FROM submissions UNION ALL SELECT response FROM ledger UNION ALL SELECT prompt FROM ledger UNION ALL SELECT text FROM hints UNION ALL SELECT body FROM replies").all() as { t: string }[]
    )
      .map((r) => r.t)
      .join("\n");
    let dbLeak: string | null = null;
    for (const c of CHALLENGES) dbLeak ??= distinctiveLeak(texts, c, allSnoopCode);
    check(checks, "database text columns (explanations, hints, ledger, mentor replies) hold no hidden literal", !dbLeak, dbLeak ?? undefined);
  }

  return {
    suite: "secrecy.test.ts — T3 hidden-test secrecy",
    points: "15 pts with labels",
    checks,
    summary: `${leaks} leaks in ${bodies} responses · ${fileLeaks} in ${served.length} served files · ${badKeys} bad hidden rows`,
    ms: Date.now() - t0,
  };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
