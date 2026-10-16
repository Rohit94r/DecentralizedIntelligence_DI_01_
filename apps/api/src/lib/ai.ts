/**
 * Chat-model providers for the mentor, the chatbot and Repo Analyse.
 *
 * All OPTIONAL. Set any of GROQ_API_KEY (free tier), GEMINI_API_KEY (free
 * tier) or ANTHROPIC_API_KEY and the first one that answers wins, in the order
 * of LAYERFLOW_AI_ORDER (default "groq,gemini,anthropic"). With no key at all,
 * every feature still works from the deterministic replies in @layerflow/core.
 *
 * Groq and Gemini both speak the OpenAI chat-completions format, so they share
 * one tiny fetch client — no extra SDKs. Whatever a model writes is checked by
 * the caller (guardReply / findLeak) before a learner sees it.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** ask for a JSON object back (providers that support it) */
  json?: boolean;
}

interface Provider {
  id: "groq" | "gemini" | "anthropic";
  model: string;
  complete(messages: AiMessage[], o: Required<Omit<AiOptions, "json">> & { json: boolean }): Promise<string | null>;
}

function openAiCompatible(id: "groq" | "gemini", baseUrl: string, key: string, models: string[]): Provider {
  let active = 0;
  return {
    id,
    get model() {
      return models[active];
    },
    async complete(messages, o) {
      // walk the model list once: a retired or rate-limited model falls through to the next
      for (let i = active; i < models.length; i++) {
        const model = models[i];
        const body: Record<string, unknown> = { model, messages, temperature: o.temperature, max_tokens: o.maxTokens };
        if (/gpt-oss/.test(model)) {
          body.reasoning_effort = "low";
          body.max_tokens = o.maxTokens + 600; // reasoning tokens count towards the cap
        }
        if (o.json) body.response_format = { type: "json_object" };
        const r = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(o.timeoutMs),
        }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }) as unknown as Response);
        if (r.ok) {
          active = i;
          const j = (await r.json()) as { choices?: { message?: { content?: string | null } }[] };
          const text = j.choices?.[0]?.message?.content?.trim();
          if (text) return text;
          continue;
        }
        const detail = (await r.text().catch(() => "")).slice(0, 160).replace(/\s+/g, " ");
        // 401/403 = bad key: no point trying other models with it
        if (r.status === 401 || r.status === 403) throw new Error(`${id}: key rejected (${r.status})`);
        if (i === models.length - 1) throw new Error(`${id} ${model}: ${r.status || "network"} ${detail}`);
      }
      return null;
    },
  };
}

function anthropicProvider(): Provider {
  const model = process.env.LAYERFLOW_LLM_MODEL ?? "claude-opus-5-5";
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  return {
    id: "anthropic",
    model,
    async complete(messages, o) {
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const res = await client.beta.messages.create({
        model,
        max_tokens: Math.max(o.maxTokens, 1200),
        system,
        messages: rest,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (res.stop_reason === "refusal") return null;
      return (
        res.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim() || null
      );
    },
  };
}

export interface Ai {
  /** "groq:openai/gpt-oss-120b" style label of the first provider, for /api/voice/status and the ledger */
  readonly label: string;
  readonly providers: string[];
  complete(messages: AiMessage[], opts?: AiOptions): Promise<{ text: string; model: string } | null>;
}

export function createAi(log: (s: string) => void = () => {}): Ai | null {
  if (process.env.LAYERFLOW_AI === "off") return null;
  const all: Record<string, () => Provider | null> = {
    groq: () =>
      process.env.GROQ_API_KEY
        ? openAiCompatible("groq", "https://api.groq.com/openai/v1", process.env.GROQ_API_KEY, uniq([process.env.GROQ_MODEL ?? "openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]))
        : null,
    gemini: () =>
      process.env.GEMINI_API_KEY
        ? openAiCompatible("gemini", "https://generativelanguage.googleapis.com/v1beta/openai", process.env.GEMINI_API_KEY, uniq([process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite", "gemini-3.8-flash"]))
        : null,
    anthropic: () => (process.env.ANTHROPIC_API_KEY && process.env.LAYERFLOW_LLM !== "off" ? anthropicProvider() : null),
  };
  const order = (process.env.LAYERFLOW_AI_ORDER ?? "groq,gemini,anthropic").split(",").map((s) => s.trim());
  const providers = order.map((k) => all[k]?.()).filter((p): p is Provider => !!p);
  if (!providers.length) return null;
  const cooldown = new Map<string, number>();

  return {
    get label() {
      return `${providers[0].id}:${providers[0].model}`;
    },
    providers: providers.map((p) => `${p.id}:${p.model}`),
    async complete(messages, opts = {}) {
      const o = { maxTokens: opts.maxTokens ?? 500, temperature: opts.temperature ?? 0.5, timeoutMs: opts.timeoutMs ?? 18_000, json: !!opts.json };
      for (const p of providers) {
        if ((cooldown.get(p.id) ?? 0) > Date.now()) continue;
        try {
          const text = await p.complete(messages, o);
          if (text) return { text, model: `${p.id}:${p.model}` };
        } catch (e) {
          log(`[ai] ${(e as Error).message} — trying the next provider`);
          cooldown.set(p.id, Date.now() + 60_000);
        }
      }
      return null;
    },
  };
}

function uniq(xs: string[]) {
  return [...new Set(xs)];
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences and chatter). */
export function parseJsonReply<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
