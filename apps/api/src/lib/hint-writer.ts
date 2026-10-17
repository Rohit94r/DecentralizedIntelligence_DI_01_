/**
 * The AI hint writer: Groq / Gemini / Anthropic (whichever answers first, see ai.ts)
 * writes each rung for the learner's actual code. The engine checks every draft
 * with acceptHint() and falls back to the hand-written rung, so this file only
 * has to ask well.
 */
import { cleanHint, hintMessages, type HintContext, type HintWriter } from "@layerflow/core";
import type { Ai } from "./ai.ts";

export function createHintWriter(ai: Ai): HintWriter {
  return {
    get model() {
      return ai.label;
    },
    async write(x: HintContext, retryReason?: string) {
      const { system, user } = hintMessages(x, retryReason);
      const out = await ai.complete(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { maxTokens: 260, temperature: retryReason ? 0.2 : 0.4, timeoutMs: 12_000 },
      );
      if (!out) return null;
      return { text: cleanHint(out.text), prompt: `[${out.model}] hint rung ${x.rung}/4 · ${x.challenge.id}${retryReason ? ` · retry after: ${retryReason}` : ""}\n${user}`, model: out.model };
    },
  };
}
