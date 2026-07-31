import type { AIProviderAdapter, AIProviderCompletionRequest, AIProviderCompletionResponse } from "./base";
import { ProviderNotImplementedError } from "./base";

export const openAIProvider: AIProviderAdapter = {
  provider: "openai",
  displayName: "OpenAI",
  defaultModel: "gpt-4o-mini",
  availableModels: ["gpt-4o", "gpt-4o-mini", "gpt-4.1-mini"] as const,
  async complete(_request: AIProviderCompletionRequest): Promise<AIProviderCompletionResponse> {
    throw new ProviderNotImplementedError("openai");
  },
};
