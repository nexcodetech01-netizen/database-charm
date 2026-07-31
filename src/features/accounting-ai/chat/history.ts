/**
 * Chat History — buffer puro de mensagens da sessão (memória curta).
 * Imutável: toda operação devolve um novo array.
 */
import type { AccountingSkillId } from "../skills";
import type { ChatMessage, ChatRole } from "./types";

export const CHAT_HISTORY_LIMIT = 40;

let counter = 0;

export function createMessage(
  role: ChatRole,
  text: string,
  skills: AccountingSkillId[] = [],
  at: number = Date.now(),
): ChatMessage {
  counter += 1;
  return { id: `${role}-${at}-${counter}`, role, text, skills, at };
}

export function appendMessage(
  history: readonly ChatMessage[],
  message: ChatMessage,
  limit: number = CHAT_HISTORY_LIMIT,
): ChatMessage[] {
  const next = [...history, message];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function clearHistory(): ChatMessage[] {
  return [];
}

export function lastBellaMessage(history: readonly ChatMessage[]): ChatMessage | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]!.role === "bella") return history[i]!;
  }
  return null;
}
