import type { AIProvider, MessageRole } from "../types";

/**
 * Bella IA — Provider Interface
 *
 * Contrato comum para provedores de IA (OpenAI, Anthropic, Gemini, DeepSeek).
 * Sprint 14 apenas prepara a arquitetura — nenhuma integração real é feita.
 */

export interface AIProviderMessage {
  role: MessageRole;
  content: string;
}

export interface AIProviderCompletionRequest {
  model: string;
  messages: AIProviderMessage[];
  temperature?: number;
  maxTokens?: number;
  system?: string;
  metadata?: Record<string, unknown>;
}

export interface AIProviderCompletionResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensInput?: number;
  tokensOutput?: number;
  raw?: unknown;
}

export interface AIProviderAdapter {
  readonly provider: AIProvider;
  readonly displayName: string;
  readonly defaultModel: string;
  readonly availableModels: readonly string[];

  /** Sprint 14: stub — lança "not_implemented". */
  complete(request: AIProviderCompletionRequest): Promise<AIProviderCompletionResponse>;
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: AIProvider) {
    super(`Provider "${provider}" ainda não foi integrado. (Sprint 14 - apenas arquitetura)`);
    this.name = "ProviderNotImplementedError";
  }
}
