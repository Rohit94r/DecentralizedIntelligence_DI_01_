/**
 * Tier 2 — OPTIONAL LLM polish for explanations and hints.
 *
 * Off unless ANTHROPIC_API_KEY is set. The product is complete without it:
 * the deterministic Tier 1 always exists first, and whatever the model writes
 * must pass the same prose-only validator and secrecy check before it can
 * replace a single word. Every prompt and response is logged to the Hint Ledger.
 *
 * What the model is shown: the PUBLIC task, the learner's OWN code, and the
 * already-safe Tier-1 draft. It never sees a hidden input, expected value,
 * hidden output or exception message — so it cannot leak one.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Challenge, Rewriter } from "@layerflow/core";

const SYSTEM = `You are the voice of Layerflow, a coding coach for beginner Python programmers.
You help learners FIND their bug; you never hand over the answer.
Hard rules — breaking any of them makes your reply unusable:
- Write plain English prose only. No code at all: no code blocks, no Python statements, no assignments, no comparison operators, no function calls, no slices.
- You may name a Python built-in in words ("a built-in that returns the larger of two numbers"), never show how to call it.
- Never invent or mention concrete test values; describe kinds of input ("an empty list", "when k is larger than the list").
- Be warm and encouraging; never say "wrong" or "you failed". Keep it short.`;

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export function createRewriter(log: (msg: string) => void = () => {}): Rewriter | null {
  if (!process.env.ANTHROPIC_API_KEY || process.env.LAYERFLOW_LLM === "off") return null;
  const model = process.env.LAYERFLOW_LLM_MODEL ?? "claude-opus-5-5";
  const client = new Anthropic({ timeout: 15_000, maxRetries: 1 });

  async function ask(user: string): Promise<string | null> {
    try {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
        output_config: { effort: "low" },
        // On a policy decline, let the API re-run the request on its recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (response.stop_reason === "refusal") return null;
      const text = textOf(response.content);
      return text || null;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) log("LLM tier: invalid API key — using the deterministic tier");
      else if (error instanceof Anthropic.RateLimitError) log("LLM tier: rate limited — using the deterministic tier");
      else if (error instanceof Anthropic.APIError) log(`LLM tier: API error ${error.status} — using the deterministic tier`);
      else log("LLM tier unreachable — using the deterministic tier");
      return null;
    }
  }

  return {
    model,
    async rewriteExplanation({ challenge, code, draft, kinds }: { challenge: Challenge; code: string; draft: string; kinds: string[] }) {
      const prompt =
        `Task: ${challenge.description}\n` +
        `Learner's code:\n${code}\n\n` +
        `Kinds of input that fail: ${kinds.join("; ")}\n` +
        `Draft explanation (accurate — keep every fact, counts and line numbers):\n${draft}\n\n` +
        `Rewrite the draft as 2–4 sentences that are warmer and more specific to this learner's code. Prose only.`;
      const text = await ask(prompt);
      return text ? { text, prompt: `[${model}] ${prompt}` } : null;
    },
    async rewriteHint({ challenge, code, draft, rung }: { challenge: Challenge; code: string; draft: string; rung: number }) {
      const prompt =
        `Task: ${challenge.description}\n` +
        `Learner's code:\n${code}\n\n` +
        `Hint rung ${rung} of 4 (1 = gentle nudge, 4 = names a built-in in words). Current hint:\n${draft}\n\n` +
        `Rewrite this hint in at most two sentences so it speaks to this learner's code. Same rung — no more revealing than the current hint. Prose only, no code.`;
      const text = await ask(prompt);
      return text ? { text, prompt: `[${model}] ${prompt}` } : null;
    },
  };
}
