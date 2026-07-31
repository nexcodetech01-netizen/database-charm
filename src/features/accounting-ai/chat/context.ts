/**
 * Chat Context — memória curta e pura da conversa (última intenção usada).
 * Sem persistência, sem banco.
 */
import type { AccountingSkillId } from "../skills";
import type { ChatAnswer, ChatContextState } from "./types";

export function emptyContext(): ChatContextState {
  return { lastIntent: null, lastSkills: [], lastAmount: null, updatedAt: null };
}

export function updateContext(
  context: ChatContextState,
  answer: ChatAnswer,
  now: number = Date.now(),
): ChatContextState {
  if (!answer.answered) return context;
  return {
    lastIntent: answer.intent,
    lastSkills: answer.skills as AccountingSkillId[],
    lastAmount: answer.amount,
    updatedAt: now,
  };
}
