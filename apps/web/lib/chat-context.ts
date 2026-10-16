"use client";

/**
 * What the floating "Ask Priya" chat knows about the current page. The
 * challenge page publishes its problem + the learner's current code here, so
 * questions are answered about THIS problem (prose only — the same guardrail
 * as hints). Anything can also open the chat with a question pre-filled.
 */
import { useSyncExternalStore } from "react";

export interface ChatPageContext {
  page?: string;
  challenge_id?: string;
  title?: string;
  code?: string;
}

let current: ChatPageContext = {};
const subs = new Set<() => void>();

export function setChatContext(c: ChatPageContext): void {
  current = c;
  subs.forEach((f) => f());
}

export function clearChatContext(): void {
  setChatContext({});
}

export function useChatContext(): ChatPageContext {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => current,
  );
}

export const OPEN_CHAT_EVENT = "layerflow-open-chat";

export function openChat(message?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: message ?? "" }));
}
