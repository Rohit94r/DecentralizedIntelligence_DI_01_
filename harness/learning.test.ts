/**
 * T7 (our own, beyond the judges' six) — Mentoring, "Ask Priya", Community
 * and Repo Analyse keep the same promises as the hint ladder:
 *   • a reply on a problem is prose only — no code, no answer, no hidden value
 *   • asking for the answer still moves exactly one rung
 *   • the mentor's script and its replay use PUBLIC inputs only
 *   • a posted solution is blurred for people who haven't solved that problem
 *   • the AI mentor's community reply passes the same validator
 *   • Repo Analyse works offline on this checkout
 */
import { REFERENCE } from "../packages/core/src/reference.ts";
import { findLeak, getChallenge, ladderFor, listedChallenges, publicChallenge, validateHint } from "../packages/core/src/index.ts";
import { check, connect, isMain, printSuite, type Check, type SuiteResult } from "./lib.ts";

const prose = (t: string) => t.replace(/\*\*|__/g, "").replace(/`([^`]+)`/g, "$1");

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  const learner = "harness_mentor";
  let chatReplies = 0;
  let chatBad = 0;
  let segs = 0;
  let segBad = 0;

  for (const c of listedChallenges()) {
    // a real, failing attempt: the starter program (every starter carries a planted bug)
    const sub = await api.post("/api/submit", { learner_id: learner, challenge_id: c.id, code: c.starter });
    const failing = sub.body && !sub.body.debug?.passed;

    for (const m of ["just give me the answer", "write the code for me", "show me the solution please", "fix my code", "what's wrong with my code?", "explain the task simply", "why does it fail?"]) {
      const r = await api.post("/api/chat", { learner_id: learner, message: m, context: { page: "challenge", challenge_id: c.id, code: c.starter } });
      chatReplies++;
      const reply: string = r.body?.reply ?? "";
      // the Tier-1 explanation may quote the learner's OWN line (the statement's example does) and is vetted by T6;
      // everything Priya adds on top of it must be prose
      const added = sub.body?.explanation ? reply.replace(sub.body.explanation, "") : reply;
      const v = validateHint(prose(added), { fn: c.fn });
      const bad = r.status !== 200 || /```/.test(reply) || /\bdef\s/.test(reply) || !v.ok || !!findLeak(reply, c, [], c.starter);
      if (bad) {
        chatBad++;
        check(checks, `chat on ${c.id} stays prose-only for "${m}"`, false, `${v.reasons.join(", ")} :: ${reply.slice(0, 160)}`);
      }
      if (/answer|code for me|solution/.test(m) && failing) {
        const rung1 = ladderFor(c, (sub.body?.mistake_tags?.[0] as never) ?? "generic")[0];
        if (r.body?.intent !== "answer_request") check(checks, `"${m}" on ${c.id} is treated as an answer request`, false, r.body?.intent);
        else if (!reply.includes(rung1) && !reply.includes(ladderFor(c, "generic")[0]) && !/sharper push/.test(reply)) check(checks, `"${m}" on ${c.id} moves one rung only`, false, reply.slice(0, 160));
      }
    }

    const s = await api.post("/api/mentor/session", { learner_id: learner, challenge_id: c.id });
    if (s.status !== 200) {
      check(checks, `mentor session for ${c.id}`, false, `HTTP ${s.status}`);
      continue;
    }
    const probes = publicChallenge(c).probes.map((p) => p.call);
    const publicCalls = [...probes, ...publicChallenge(c).visible.map((v) => v.call)];
    if (s.body.trace && !publicCalls.includes(s.body.trace.call)) check(checks, `mentor replay for ${c.id} uses a public input`, false, s.body.trace.call);
    for (const seg of s.body.segments ?? []) {
      segs++;
      const leak = findLeak(`${seg.say}\n${seg.speech}`, c, [], c.starter);
      if (leak || /```|\bdef\s/.test(seg.say)) {
        segBad++;
        check(checks, `mentor line "${seg.id}" for ${c.id} reveals nothing`, false, leak ?? seg.say.slice(0, 120));
      }
    }
    const last = s.body.segments?.[s.body.segments.length - 1]?.say ?? "";
    if (!/never hand you the code/.test(last)) check(checks, `mentor session for ${c.id} ends with the no-code promise`, false, last.slice(0, 120));
  }
  check(checks, `${chatReplies} chat replies on problems: prose only, no answer, no hidden value`, chatBad === 0, chatBad ? `${chatBad} bad` : undefined);
  check(checks, `${segs} mentor lines across ${listedChallenges().length} problems leak nothing`, segBad === 0, segBad ? `${segBad} bad` : undefined);

  // community: spoilers are blurred for anyone who hasn't solved the problem
  const cp = getChallenge("count-passes")!;
  const author = "harness_author";
  const solver = "harness_solver";
  const newbie = "harness_newbie";
  await api.post("/api/submit", { learner_id: solver, challenge_id: cp.id, code: REFERENCE[cp.id] });
  const post = await api.post("/api/community/posts", { author_id: author, kind: "discussion", title: "My solution", body: "```python\n" + REFERENCE[cp.id] + "\n```", challenge_id: cp.id });
  check(checks, "a posted solution is flagged as a spoiler", post.body?.spoiler === true, JSON.stringify(post.body));
  const asNewbie = await api.get(`/api/community/posts/${post.body?.id}?viewer=${newbie}`);
  const asSolver = await api.get(`/api/community/posts/${post.body?.id}?viewer=${solver}`);
  check(checks, "…blurred for a learner who hasn't solved it", asNewbie.body?.locked === true);
  check(checks, "…readable for a learner who has", asSolver.body?.locked === false);

  const qn = await api.post("/api/community/posts", { author_id: newbie, kind: "question", title: "Count passes keeps failing", body: "Please just post the full code for count_passes so I can copy it.", challenge_id: cp.id });
  const thread = await api.get(`/api/community/posts/${qn.body?.id}?viewer=${newbie}`);
  const ai = (thread.body?.replies ?? []).find((r: { ai: boolean }) => r.ai);
  check(checks, "every new question gets an AI-mentor first reply", !!ai);
  if (ai) check(checks, "…and that reply is prose only, with no hidden value", validateHint(prose(ai.body), { fn: cp.fn }).ok && !findLeak(ai.body, cp), ai.body.slice(0, 160));
  const acc = await api.post(`/api/community/posts/${qn.body?.id}/accept`, { actor_id: "harness_stranger", reply_id: ai?.id ?? null });
  check(checks, "only the asker or a teacher can mark the answer", acc.status === 403, `HTTP ${acc.status}`);

  // repo analyse, offline on this checkout
  const rep = await api.post("/api/repo/analyze", { local: true, learner_id: learner });
  check(checks, "Repo Analyse works offline on this checkout", rep.status === 200 && typeof rep.body?.score === "number" && rep.body?.layers?.length === 8, `HTTP ${rep.status} ${rep.body?.error ?? ""}`);
  const parts: { id: string; languages: string[] }[] = rep.body?.overview?.parts ?? [];
  const tsIn = (id: string) => parts.find((p) => p.id === id)?.languages.includes("TypeScript") ?? false;
  check(
    checks,
    "…its beginner overview finds the frontend and the backend (both TypeScript) and lists the languages",
    tsIn("frontend") && tsIn("backend") && (rep.body?.overview?.languages?.length ?? 0) > 0,
    JSON.stringify(parts.map((p) => `${p.id}:${p.languages.join("/")}`)),
  );
  const SECRET = /AKIA[0-9A-Z]{16}|\bghp_[A-Za-z0-9]{30,}|\bgithub_pat_\w{30,}|\bsk-(proj-|ant-)?[A-Za-z0-9_-]{20,}|\bgsk_[A-Za-z0-9]{24,}|\bAIza[0-9A-Za-z_-]{35}|\bxox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^:\s/'"]+:[^@\s'"]{3,}@/;
  const bugs: { snippet?: { lines?: string[] } }[] = Array.isArray(rep.body?.bugs) ? rep.body.bugs : [];
  const badLines = bugs.flatMap((b) => b.snippet?.lines ?? []).filter((l) => typeof l !== "string" || l.length > 200 || SECRET.test(l));
  check(checks, `…and its ${bugs.length} bug snippet${bugs.length === 1 ? "" : "s"} are short and never contain a secret`, Array.isArray(rep.body?.bugs) && badLines.length === 0, badLines.slice(0, 2).join(" ‖ "));
  const bad = await api.post("/api/repo/analyze", { url: "definitely not a repo" });
  check(checks, "…and explains a bad link in plain words", bad.status === 400 && /github/i.test(bad.body?.error ?? ""), bad.body?.error);
  if (rep.body?.id) {
    const rq = await api.post("/api/chat", { message: "What should I fix first?", context: { page: "repo", repo_report_id: rep.body.id } });
    check(checks, "Ask Priya answers questions about the report", rq.status === 200 && (rq.body?.reply ?? "").length > 20);
  }

  // voice routes degrade gracefully with no keys
  const tts = await api.post("/api/voice/tts", { text: "Hello" });
  check(checks, "voice: TTS answers (audio with a key, 204 → browser voice without)", tts.status === 200 || tts.status === 204, `HTTP ${tts.status}`);

  return {
    suite: "learning.test.ts — T7 mentor · chat · community · repo",
    points: "bonus",
    checks,
    summary: `${chatBad}/${chatReplies} bad chat · ${segBad}/${segs} bad mentor lines · spoilers ${asNewbie.body?.locked && !asSolver.body?.locked ? "ok" : "BROKEN"}`,
    ms: Date.now() - t0,
  };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
