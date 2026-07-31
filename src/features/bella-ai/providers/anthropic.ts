import type { AIProviderAdapter, AIProviderCompletionRequest, AIProviderCompletionResponse } from "./base";
import { ProviderNotImplementedError } from "./base";

export const anthropicProvider: AIProviderAdapter = {
  provider: "anthropic",
  displayName: "Anthropic Claude",
  defaultModel: "claude-3-5-sonnet-latest",
  availableModels: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"] as const,
  async complete(_request: AIProviderCompletionRequest): Promise<AIProviderCompletionResponse> {
    throw new ProviderNotImplementedError("anthropic");
  },
};
