/**
 * Recurrence + the next challenge, with its reason.
 *
 *   recurring(tag)  ⟺  tag appears in ≥ 2 DIFFERENT challenge ids for the learner
 *
 * We count distinct challenges, not submissions: failing one problem five
 * times is one data point. One-off slips are reported separately and never
 * called recurring. The next challenge closes the loop — it targets the top
 * recurring mistake and SAYS WHY. The reason is never empty.
 */
import { bugFactoryChallenges, getChallenge, listedChallenges } from "./challenge-bank.ts";
import { CONCEPT_LABELS, masteryMap } from "./mastery.ts";
import type { Challenge, Concept, Difficulty, HistoryItem, MasteryRow, MistakeTag, NextChallenge } from "./types.ts";

export interface Rollup {
  recurring: MistakeTag[];
  oneOff: MistakeTag[];
  /** tag → the distinct challenge ids it appeared in, oldest first */
  where: Record<string, string[]>;
}

export function rollup(history: HistoryItem[]): Rollup {
  const where = new Map<MistakeTag, string[]>();
  const lastSeen = new Map<MistakeTag, string>();
  const sorted = [...history].sort((a, b) => a.at.localeCompare(b.at));
  for (const h of sorted) {
    if (h.passed) continue;
    for (const tag of h.tags) {
      const list = where.get(tag) ?? [];
      if (!list.includes(h.challenge_id)) list.push(h.challenge_id);
      where.set(tag, list);
      lastSeen.set(tag, h.at);
    }
  }
  const order = (a: MistakeTag, b: MistakeTag) =>
    where.get(b)!.length - where.get(a)!.length || (lastSeen.get(b) ?? "").localeCompare(lastSeen.get(a) ?? "");
  const tags = [...where.keys()];
  return {
    recurring: tags.filter((t) => where.get(t)!.length >= 2).sort(order),
    oneOff: tags.filter((t) => where.get(t)!.length === 1).sort(order),
    where: Object.fromEntries(where),
  };
}

const LEVEL: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function status(history: HistoryItem[]) {
  const passed = new Set(history.filter((h) => h.passed).map((h) => h.challenge_id));
  const attempted = new Set(history.map((h) => h.challenge_id));
  return { passed, attempted };
}

function rank(cands: Challenge[], attempted: Set<string>): Challenge[] {
  return [...cands].sort(
    (a, b) => Number(attempted.has(a.id)) - Number(attempted.has(b.id)) || LEVEL[a.difficulty] - LEVEL[b.difficulty],
  );
}

export function nextChallenge(history: HistoryItem[], mastery: MasteryRow[]): NextChallenge {
  const { passed, attempted } = status(history);
  const r = rollup(history);
  const pool = listedChallenges();

  // 1 — target the top recurring mistake
  for (const tag of r.recurring) {
    const seenIn = r.where[tag] ?? [];
    const fresh = pool.filter((c) => c.targets.includes(tag) && !passed.has(c.id) && !seenIn.includes(c.id));
    const fallback = pool.filter((c) => c.targets.includes(tag) && !passed.has(c.id));
    const bf = bugFactoryChallenges().filter((c) => c.bugFactory!.tag === tag && !passed.has(c.id));
    const pick = rank(fresh, attempted)[0] ?? rank(fallback, attempted)[0] ?? bf[0];
    if (!pick) continue;
    const titles = seenIn.map((id) => getChallenge(id)?.id ?? id).join(", ");
    const why = pick.targetReasons[tag] ?? `It is built to exercise exactly this mistake.`;
    return {
      challenge_id: pick.id,
      tag,
      basis: "recurring",
      reason: `${tag} has now appeared in ${WORDS[seenIn.length] ?? seenIn.length} different challenges (${titles}). Next: ${pick.title}. ${why}`,
    };
  }

  // 2 — nothing recurring: the weakest concept the learner has actually touched
  const values = masteryMap(mastery);
  const touched = [...new Set(mastery.map((m) => m.concept))];
  const weakest = touched.sort((a, b) => values[a] - values[b])[0] as Concept | undefined;
  if (weakest && values[weakest] < 0.6) {
    const cands = rank(pool.filter((c) => c.concepts.includes(weakest) && !passed.has(c.id)), attempted);
    if (cands[0]) {
      return {
        challenge_id: cands[0].id,
        basis: "weakest_concept",
        reason: `Your weakest concept right now is ${CONCEPT_LABELS[weakest]} (${Math.round(values[weakest] * 100)}%). ${cands[0].title} practises exactly that.`,
      };
    }
  }

  // 3 — progression: the next unseen challenge at (or just above) the learner's level
  const level = Math.max(-1, ...pool.filter((c) => passed.has(c.id)).map((c) => LEVEL[c.difficulty]));
  const unseen = pool.filter((c) => !attempted.has(c.id));
  const atLevel = unseen.filter((c) => LEVEL[c.difficulty] <= level + 1).sort((a, b) => LEVEL[b.difficulty] - LEVEL[a.difficulty]);
  const next = atLevel[0] ?? unseen[0] ?? pool.find((c) => !passed.has(c.id));
  if (next) {
    return {
      challenge_id: next.id,
      basis: "progression",
      reason: history.length
        ? `Nothing is recurring right now. ${next.title} is the next ${next.difficulty} challenge you haven't cleared yet.`
        : `Start here: ${next.title} is a gentle ${next.difficulty} first challenge — most people get their first pass in under three minutes.`,
    };
  }

  const bf = bugFactoryChallenges().find((c) => !passed.has(c.id)) ?? bugFactoryChallenges()[0];
  return {
    challenge_id: bf.id,
    basis: "complete",
    reason: "You've cleared every practice challenge. The Bug Factory keeps your eye sharp: find the bug, then fix it.",
  };
}

/** OB3 — pick the Bug Factory template for this learner's top mistake (recurring first, then most frequent). */
export function bugFactoryPick(history: HistoryItem[]): { challenge: Challenge; tag: MistakeTag; reason: string } {
  const r = rollup(history);
  const { passed } = status(history);
  const templates = bugFactoryChallenges();
  const counts = new Map<MistakeTag, number>();
  for (const h of history) for (const t of h.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const byFreq = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  const ordered = [...r.recurring, ...byFreq.filter((t) => !r.recurring.includes(t))];
  for (const tag of ordered) {
    const tpl = templates.find((c) => c.bugFactory!.tag === tag && !passed.has(c.id)) ?? templates.find((c) => c.bugFactory!.tag === tag);
    if (tpl) {
      const recurring = r.recurring.includes(tag);
      return {
        challenge: tpl,
        tag,
        reason: recurring
          ? `You keep hitting ${tag} (${(r.where[tag] ?? []).length} different challenges), so this program was built around exactly that bug.`
          : `${tag} is the mistake you've made most often, so this program was built around it.`,
      };
    }
  }
  const tpl = templates.find((c) => !passed.has(c.id)) ?? templates[0];
  return {
    challenge: tpl,
    tag: tpl.bugFactory!.tag,
    reason: "No mistakes on record yet — start with the classic boundary bug.",
  };
}
