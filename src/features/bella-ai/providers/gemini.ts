import type { AIProviderAdapter, AIProviderCompletionRequest, AIProviderCompletionResponse } from "./base";
import { ProviderNotImplementedError } from "./base";

export const geminiProvider: AIProviderAdapter = {
  provider: "gemini",
  displayName: "Google Gemini",
  defaultModel: "gemini-2.0-flash",
  availableModels: ["gemini-2.0-flash", "gemini-2.5-pro"] as const,
  async complete(_request: AIProviderCompletionRequest): Promise<AIProviderCompletionResponse> {
    throw new ProviderNotImplementedError("gemini");
  },
};
