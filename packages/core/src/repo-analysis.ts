/**
 * Repo Analyse — a beginner-friendly architecture review of any repository.
 *
 * Pure: the API fetches a snapshot (GitHub REST + raw files, or `git ls-files`
 * of a local checkout) and this module turns it into a report — health score,
 * the layers the project has (and is missing), plain-language findings with a
 * fix for each, strengths, a step-by-step roadmap, and the architecture shape
 * to aim for. Every check is a readable rule, so a newcomer can learn WHY.
 *
 * Secrets found while scanning are reported by file and line only — the value
 * itself is never copied into the report.
 */

import { escRe, findBugs } from "./repo-bugs.ts";
import { CHECKS, type Ctx, strengths, targetFor } from "./repo-checks.ts";
import { buildOverview } from "./repo-overview.ts";
import { type Area, JUNK_DIR, PRACTICE_FILE, type RepoBug, type RepoReport, type RepoSnapshot, SEV_RANK, type Severity, TEST_PATH, allDeps, base, detectKind, detectLayers, detectStack, estLines, isCode, lc } from "./repo-shared.ts";

export type { RepoFile, RepoSnapshot, Severity, Area, RepoFinding, RepoLayer, PartId, RepoPart, RepoLanguage, RepoTech, RepoOverview, BugCategory, RepoBug, RepoReport } from "./repo-shared.ts";
export { isCode, parseRepoUrl, pickFilesToRead } from "./repo-shared.ts";

/* ───────────────────────── scoring + report ───────────────────────── */

const WEIGHT: Record<Severity, number> = { high: 14, medium: 7, low: 3 };
const AREA_LABEL: Record<Area, string> = {
  security: "Security",
  structure: "Structure",
  testing: "Testing",
  quality: "Code quality",
  docs: "Docs",
  dependencies: "Dependencies",
  devops: "Ship & run",
  scalability: "Scalability",
};

function grade(score: number): RepoReport["grade"] {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
}

export function analyzeRepo(s: RepoSnapshot): RepoReport {
  const files = s.files.filter((f) => !f.path.startsWith(".git/"));
  const clean = files.filter((f) => !JUNK_DIR.test(f.path));
  const code = clean.filter((f) => isCode(f.path) && !TEST_PATH.test(f.path));
  const tests = clean.filter((f) => TEST_PATH.test(f.path) && (isCode(f.path) || /\.py$/.test(f.path)));
  const srcCode = Object.entries(s.contents).filter(([p]) => isCode(p) && !JUNK_DIR.test(p) && !TEST_PATH.test(p) && !PRACTICE_FILE.test(p));
  const deps = allDeps(s);
  const stack = detectStack(s, deps);
  const kind = detectKind(s, stack);
  const layers = detectLayers(clean);
  const paths = files.map((f) => f.path);
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const grep = (re: RegExp, filter: (p: string) => boolean = () => true) => {
    const out: { file: string; line: number }[] = [];
    for (const [p, t] of srcCode) {
      if (!filter(p)) continue;
      const lines = t.split(/\r?\n/);
      for (let i = 0; i < lines.length && out.length < 60; i++) if (lines[i].length < 1500 && re.test(lines[i])) out.push({ file: p, line: i + 1 });
    }
    return out;
  };
  const ctx: Ctx = { s, files, code, srcCode, tests, deps, stack, kind, layers, has, grep };

  const findings = CHECKS.flatMap((c) => {
    try {
      const r = c(ctx);
      return r ? (Array.isArray(r) ? r : [r]) : [];
    } catch {
      return [];
    }
  }).sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  const penalty = findings.reduce((n, f) => n + WEIGHT[f.severity], 0);
  const score = Math.max(5, Math.min(100, 100 - penalty));
  const areas = (Object.keys(AREA_LABEL) as Area[]).map((a) => ({
    area: a,
    label: AREA_LABEL[a],
    score: Math.max(0, 100 - findings.filter((f) => f.area === a).reduce((n, f) => n + WEIGHT[f.severity] * 2.6, 0)),
  }));
  areas.forEach((a) => (a.score = Math.round(a.score)));

  const sized = clean
    .filter((f) => isCode(f.path))
    .map((f) => ({ path: f.path, lines: estLines(f, s.contents) }))
    .sort((a, b) => b.lines - a.lines);
  const extCount: Record<string, number> = {};
  for (const f of clean) {
    const m = f.path.match(/\.([a-z0-9]+)$/i);
    if (m && isCode(f.path)) extCount[m[1].toLowerCase()] = (extCount[m[1].toLowerCase()] ?? 0) + f.size;
  }
  const langSrc = s.languages && Object.keys(s.languages).length ? s.languages : extCount;
  const langTotal = Object.values(langSrc).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(langSrc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, n]) => ({ name, share: Math.round((n / langTotal) * 1000) / 10 }));
  const folders: Record<string, number> = {};
  for (const f of clean) {
    const top = f.path.includes("/") ? f.path.split("/")[0] + "/" : "(root)";
    folders[top] = (folders[top] ?? 0) + 1;
  }

  let bugs: RepoBug[] = [];
  try {
    bugs = findBugs(s);
  } catch {
    bugs = [];
  }
  const overview = buildOverview({ s, clean, deps, stack, kind, srcCode });

  const roadmap = findings.slice(0, 6).map((f, i) => ({ step: i + 1, title: f.title.replace(/\s*\(.*?\)\s*$/, ""), detail: f.fix, area: f.area }));
  const seriousBugs = bugs.filter((b) => b.severity === "high" || (b.severity === "medium" && b.confidence === "likely"));
  if (seriousBugs.length) {
    const at = findings.filter((f) => f.severity === "high").length;
    roadmap.splice(Math.min(at, roadmap.length), 0, {
      step: 0,
      title: `Fix the ${seriousBugs.length} bug${seriousBugs.length === 1 ? "" : "s"} found in the code`,
      detail: `Open the "Bugs to fix" tab and start with ${lc(seriousBugs[0].title)} (${seriousBugs[0].file}:${seriousBugs[0].line}). Each one shows the exact line, why it's wrong and how to fix it.`,
      area: seriousBugs.some((b) => b.category === "security") ? "security" : "quality",
    });
    roadmap.splice(7);
  }
  if (findings.some((f) => f.area === "structure") && roadmap.length < 8) {
    roadmap.push({ step: roadmap.length + 1, title: "Reshape into clear layers", detail: "Move code into the target shape below one feature at a time — routes → services → data. Keep the tests green after every move.", area: "structure" });
  }
  roadmap.forEach((r, i) => (r.step = i + 1));

  const learnMap = new Map<string, string>();
  for (const f of findings) if (f.learn && !learnMap.has(f.learn)) learnMap.set(f.learn, f.title);
  const learn = [...learnMap.entries()].slice(0, 6).map(([topic, why]) => ({ topic, why: `Because: ${lc(why)}.` }));

  const highs = findings.filter((f) => f.severity === "high");
  const g = grade(score);
  const verdict =
    g === "A"
      ? "In great shape — a few polish items and it's a model project."
      : g === "B"
        ? "Solid foundations. Fix the top items and it's ready to grow."
        : g === "C"
          ? "It works, but a few habits will hurt as it grows. The roadmap fixes them in order."
          : "It needs some care before it can scale — start with the red items, one at a time.";

  const st = strengths(ctx, findings);
  const review = [
    `I looked at ${s.owner ? `${s.owner}/` : ""}${s.name}: a ${kind.toLowerCase()} built with ${stack.slice(0, 4).join(", ") || "plain code"}, ${clean.length} files.`,
    st.length ? `What's already good: ${st.slice(0, 2).map((x) => x.title.toLowerCase()).join(" and ")}.` : "",
    highs.length
      ? `Fix first: ${highs.slice(0, 2).map((h) => lc(h.title)).join("; and ")}.`
      : findings.length
        ? `The most useful next step: ${lc(findings[0].title)}.`
        : "I couldn't find anything important to fix — nice work.",
    bugs.length
      ? `In the code itself I spotted ${bugs.length} thing${bugs.length === 1 ? "" : "s"} that look${bugs.length === 1 ? "s" : ""} like ${bugs.length === 1 ? "a bug" : "bugs"} — start with ${lc(bugs[0].title)} in ${base(bugs[0].file)}.`
      : "",
    findings.some((f) => f.area === "structure")
      ? "For growth, aim for the layered shape below: thin routes, a services layer for your rules, and one data-access layer."
      : "Your structure already has room to grow — keep each layer doing one job.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    repo: { name: s.name, owner: s.owner, url: s.url, source: s.source, description: s.description ?? null, stars: s.stars, branch: s.default_branch },
    score,
    grade: g,
    verdict,
    kind,
    stack,
    metrics: {
      files: clean.length,
      code_files: code.length,
      test_files: tests.length,
      sampled_files: Object.keys(s.contents).length,
      est_lines: sized.reduce((n, f) => n + f.lines, 0),
      largest: sized.slice(0, 5),
      languages,
      top_folders: Object.entries(folders)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([path, n]) => ({ path, files: n })),
      max_depth: Math.max(0, ...clean.map((f) => f.path.split("/").length - 1)),
    },
    layers,
    findings,
    strengths: st,
    roadmap,
    target: targetFor(kind, stack),
    learn,
    areas,
    review,
    truncated: !!s.truncated,
    overview,
    bugs,
  };
}

function bugAnswer(b: RepoBug, sameFile = 0): string {
  return (
    `**${b.title}** — \`${b.file}:${b.line}\`. ${b.why} How to fix it: ${b.fix}` +
    (b.confidence === "possible" ? " This one is a *possible* bug — check whether that situation can really happen in your app." : "") +
    (sameFile ? ` There ${sameFile === 1 ? "is 1 more item" : `are ${sameFile} more items`} in the same file on the Bugs tab.` : "")
  );
}

/** Deterministic answer to a question about a report (used when no LLM is configured). */
export function repoAnswer(question: string, r: RepoReport): string {
  const q = question.toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const bugs = r.bugs ?? []; // reports saved before bug detection have none
  const overlap = (text: string) => words.filter((w) => text.toLowerCase().includes(w)).length;

  // a question that names a file: answer about the bugs (or findings) in it
  const mentions = (file: string) => q.includes(file.toLowerCase()) || (base(file).length > 4 && new RegExp(`(^|[^\\w.])${escRe(base(file).toLowerCase())}\\b`).test(q));
  const inFile = bugs.filter((b) => mentions(b.file));
  if (inFile.length) {
    const exact = inFile.find((b) => q.includes(`:${b.line}`)) ?? [...inFile].sort((a, b) => overlap(`${b.title} ${b.why}`) - overlap(`${a.title} ${a.why}`))[0];
    return bugAnswer(exact, inFile.length - 1);
  }
  // the beginner overview: a named start-here file, where to start reading, how the parts fit together
  const o = r.overview; // reports saved before the overview existed have none
  const named = o?.start_here.find((x) => mentions(x.path));
  if (named && /walk|what does|explain|read/.test(q))
    return `\`${named.path}\` — ${named.why} Open it and read it top to bottom once without changing anything; then follow one function it calls into the next file. Ask me about any line you don't understand.`;
  const findingInFile = r.findings.find((f) => f.files?.some((x) => mentions(x.replace(/[:\s(].*$/, ""))));
  if (findingInFile && /\.\w{1,5}\b/.test(q)) return `**${findingInFile.title}.** ${findingInFile.why} What to do: ${findingInFile.fix}`;
  if (o) {
    if (/\b(read|reading)\b|where (do|should|can) i (start|begin)|which files?\b/.test(q) && o.start_here.length)
      return `Read these in order: ${o.start_here.map((x, i) => `**${i + 1}.** \`${x.path}\` — ${lc(x.why)}`).join(" ")}`;
    if (/\b(frontend|backend|database|parts?|put together|languages?|which part|folders?|tech stack|how (does|is) (it|this) (work|built|organi[sz]ed))\b/.test(q) && o.parts.length)
      return `${o.summary} ${o.parts
        .filter((p) => ["frontend", "backend", "database", "mobile", "ml"].includes(p.id))
        .map((p) => `**${p.label}**${p.folders.length ? ` (\`${p.folders[0]}\`)` : ""}: ${lc(p.simple)}${p.tech.length ? ` Built with ${p.tech.slice(0, 3).join(", ")}.` : ""}`)
        .join(" ")}${o.how_it_runs.length ? ` In short: ${o.how_it_runs.map((x) => x.replace(/`/g, "")).join(" ")}` : ""}`;
  }

  // a question about bugs in general
  if (/\b(bugs?|crash\w*|broken|buggy)\b|what'?s wrong/.test(q)) {
    if (!bugs.length)
      return `I didn't find anything that looks like a bug in the ${r.metrics.sampled_files} files I read line by line — nice. The findings list is about structure and safety habits instead; ${r.findings[0] ? `the top one is **${r.findings[0].title}**.` : "and it's empty too."}`;
    const best = [...bugs].map((b) => ({ b, n: overlap(`${b.title} ${b.category} ${b.learn}`) })).sort((a, b) => b.n - a.n)[0];
    const pick = best && best.n > 0 ? best.b : bugs[0];
    return `${bugAnswer(pick)}${bugs.length > 1 ? ` I found ${bugs.length} in total — the Bugs tab lists them all, most serious first.` : ""}`;
  }

  const scored = r.findings
    .map((f) => ({ f, n: words.filter((w) => `${f.title} ${f.why} ${f.fix} ${f.area} ${f.learn ?? ""}`.toLowerCase().includes(w)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  if (/\b(start|first|priority|most important|begin)\b/.test(q) && r.findings[0]) {
    const f = r.findings[0];
    const b = bugs.find((x) => x.severity === "high" && x.confidence === "likely");
    return `Start with **${f.title}**. ${f.why} What to do: ${f.fix}${b ? ` In the code itself, the first bug to fix is **${b.title}** in \`${b.file}:${b.line}\`.` : ""}`;
  }
  if (/\bfirst\b/.test(q) && bugs[0]) return bugAnswer(bugs[0]);
  if (/\b(scal|grow|architecture|structure|layer)\w*/.test(q)) {
    return `${r.target.note} Aim for: ${r.target.layers.map((l) => `**${l.label}** (${l.rule.replace(/\.$/, "")})`).join(" → ")}.`;
  }
  if (scored.length) {
    const f = scored[0].f;
    return `**${f.title}.** ${f.why} What to do: ${f.fix}${f.files?.length ? ` Look at: ${f.files.slice(0, 3).join(", ")}.` : ""}`;
  }
  if (/\b(good|strength|well|right)\b/.test(q) && r.strengths.length) return `What's already good: ${r.strengths.map((s) => `**${s.title}** — ${s.detail}`).join(" ")}`;
  return `${r.review} Ask me about any item in the list — for example "${r.findings[0]?.title ?? "how do I add tests"}".`;
}
