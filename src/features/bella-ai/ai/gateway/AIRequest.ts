/**
 * Helpers para construir `AIRequest` de forma consistente.
 * Nenhuma parte da Bella deve montar mensagens "à mão".
 */
import type { AIMessage, AIRequest } from "./types";

export interface BuildRequestInput {
  system?: string;
  history?: AIMessage[];
  userMessage: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export function buildAIRequest(input: BuildRequestInput): AIRequest {
  const messages: AIMessage[] = [...(input.history ?? [])];
  const trimmed = input.userMessage.trim();
  if (trimmed.length > 0) {
    messages.push({ role: "user", content: trimmed });
  }
  return {
    system: input.system,
    messages,
    context: input.context,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    timeoutMs: input.timeoutMs,
  };
}

export function appendMessage(request: AIRequest, message: AIMessage): AIRequest {
  return { ...request, messages: [...request.messages, message] };
}
