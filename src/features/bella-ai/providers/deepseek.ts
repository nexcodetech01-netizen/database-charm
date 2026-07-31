import type { AIProviderAdapter, AIProviderCompletionRequest, AIProviderCompletionResponse } from "./base";
import { ProviderNotImplementedError } from "./base";

export const deepseekProvider: AIProviderAdapter = {
  provider: "deepseek",
  displayName: "DeepSeek",
  defaultModel: "deepseek-chat",
  availableModels: ["deepseek-chat", "deepseek-reasoner"] as const,
  async complete(_request: AIProviderCompletionRequest): Promise<AIProviderCompletionResponse> {
    throw new ProviderNotImplementedError("deepseek");
  },
};
