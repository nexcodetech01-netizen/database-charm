import type { AIProvider } from "../types";
import type { AIProviderAdapter } from "./base";
import { openAIProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { deepseekProvider } from "./deepseek";

export const providers: Record<AIProvider, AIProviderAdapter> = {
  openai: openAIProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  deepseek: deepseekProvider,
};

export function getProvider(provider: AIProvider): AIProviderAdapter {
  return providers[provider];
}

export function listProviders(): AIProviderAdapter[] {
  return Object.values(providers);
}

export * from "./base";
