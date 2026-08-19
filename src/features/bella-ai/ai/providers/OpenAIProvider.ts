/**
 * OpenAIProvider — integração real com a OpenAI via server functions.
 * 
 * Regras:
 * - Implementa AIProvider.
 * - Delegada a interpretação para a server function `interpretWithOpenAI`.
 * - Não contém segredos; segredos vivem no handler da server function.
 */
import type { AIProvider } from "../gateway/AIProvider";
import { normalizeAIResponse } from "../gateway/AIResponse";
import type {
  AIProviderHealth,
  AIRequest,
  AIResponse,
  AIResult,
} from "../gateway/types";
import { interpretWithOpenAI } from "../gateway/interpret-openai.functions";
import { buildSkillsCatalog } from "../gateway/skills-catalog";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  readonly displayName = "OpenAI (GPT)";

  isConfigured(): boolean {
    // A disponibilidade real é checada no backend via presence da API KEY.
    return true;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const result = await this.interpret(request);
    return {
      content: result.response,
      provider: this.id,
      model: result.raw && typeof result.raw === 'object' && 'telemetry' in result.raw 
        ? (result.raw as any).telemetry.model 
        : "gpt-5.6-luna",
      raw: result.raw,
    };
  }

  async interpret(request: AIRequest): Promise<AIResult> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const message = lastUser?.content?.trim() ?? "";
    
    if (!message) {
      throw new Error("OPENAI_EMPTY_MESSAGE");
    }

    const skills = buildSkillsCatalog();
    const context = (request.context ?? {}) as Record<string, unknown>;
    const companyName = typeof context.companyName === "string" ? context.companyName : undefined;

    const data = await interpretWithOpenAI({
      data: {
        message,
        skills,
        context,
        companyName: companyName ?? null,
      },
    });

    const response: AIResponse = {
      content: data.response,
      provider: this.id,
      model: data.telemetry.model,
      tokensInput: data.telemetry.tokensInput,
      tokensOutput: data.telemetry.tokensOutput,
      raw: data,
    };

    return normalizeAIResponse({
      response,
      intent: data.intent,
      confidence: data.confidence,
      parameters: data.parameters,
    });
  }

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      provider: this.id,
      ok: true,
      message: "OpenAI via server-side functions.",
    };
  }
}
