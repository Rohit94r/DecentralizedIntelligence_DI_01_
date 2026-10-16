/**
 * Community rules — students help each other, teachers mentor.
 *
 * The one rule that matters for learning: a post that contains a working
 * solution to a practice problem is a SPOILER. It is blurred for everyone who
 * hasn't solved that problem yet (they can still choose to reveal it), so the
 * community never quietly replaces the struggle that makes skills stick.
 */
import { CHALLENGES, getChallenge } from "./challenge-bank.ts";
import { validateHint } from "./hints.ts";

export type PostKind = "question" | "discussion" | "tip" | "showcase";
export type Role = "student" | "teacher" | "mentor_ai";

export const POST_KINDS: { kind: PostKind; label: string; emoji: string; help: string }[] = [
  { kind: "question", label: "Question", emoji: "🙋", help: "Stuck on something? Ask — someone will help." },
  { kind: "tip", label: "Tip", emoji: "💡", help: "A trick or lesson that helped you." },
  { kind: "discussion", label: "Discussion", emoji: "💬", help: "Talk about an idea, a concept or a problem." },
  { kind: "showcase", label: "Showcase", emoji: "🚀", help: "Share something you built or a milestone." },
];

export interface SpoilerCheck {
  spoiler: boolean;
  reason: string | null;
  hasCode: boolean;
}

/** Does this text look like it contains code at all? */
export function containsCode(text: string): boolean {
  if (/```/.test(text)) return true;
  const lines = text.split(/\r?\n/);
  const codey = lines.filter((l) => /^\s{2,}\S/.test(l) || /^\s*(def |for |while |if |elif |else:|return\b|import |from \w+ import|print\()/.test(l) || /[:;{]\s*$/.test(l));
  return codey.length >= 2 || !validateHint(text).ok;
}

/** A post is a spoiler when it is about a practice problem AND shows code for it. */
export function spoilerCheck(text: string, challengeId?: string | null): SpoilerCheck {
  const hasCode = containsCode(text);
  if (!challengeId) {
    // not about one problem — code that defines a practice function is still a spoiler
    const fn = text.match(/\bdef\s+([A-Za-z_]\w*)\s*\(/)?.[1];
    if (fn) {
      if (CHALLENGES.some((c) => c.fn === fn)) return { spoiler: true, reason: `defines ${fn}, a practice problem's function`, hasCode };
    }
    return { spoiler: false, reason: null, hasCode };
  }
  const c = getChallenge(challengeId);
  if (!c) return { spoiler: false, reason: null, hasCode };
  if (new RegExp(`\\bdef\\s+${c.fn}\\s*\\(`).test(text)) return { spoiler: true, reason: `contains a full ${c.fn} function`, hasCode };
  if (/```/.test(text) && /\breturn\b/.test(text)) return { spoiler: true, reason: "contains a code block for this problem", hasCode };
  if (hasCode && text.split(/\r?\n/).filter((l) => /^\s{4,}\S/.test(l)).length >= 2) return { spoiler: true, reason: "contains code for this problem", hasCode };
  return { spoiler: false, reason: null, hasCode };
}

export function validatePost(p: { title?: string; body: string; kind?: string }): string | null {
  if (p.title !== undefined && p.title.trim().length < 4) return "Give your post a title of at least 4 characters.";
  if (p.title !== undefined && p.title.length > 140) return "Keep the title under 140 characters.";
  if (p.body.trim().length < 2) return "Write a little more so people can help.";
  if (p.body.length > 6000) return "That's a lot! Keep it under 6000 characters.";
  if (p.kind !== undefined && !POST_KINDS.some((k) => k.kind === p.kind)) return "Unknown post type.";
  return null;
}
