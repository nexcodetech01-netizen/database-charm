/**
 * GeminiProvider — interpretação de intenção via Lovable AI Gateway.
 *
 * Regras:
 *  - Chama SEMPRE a server function `interpretWithGemini`. Nenhum
 *    componente/página deve chamar o Gemini diretamente.
 *  - Nunca executa Skills, cálculos ou acesso a dados — apenas devolve
 *    intent + parameters + resposta.
 *  - Em qualquer falha, lança erro para que o `BellaAIGateway` acione o
 *    fallback (MockProvider → Keyword Parser no chamador).
 *  - Chave de API vive exclusivamente no backend (LOVABLE_API_KEY).
 */
import type { AIProvider } from "../gateway/AIProvider";
import { normalizeAIResponse } from "../gateway/AIResponse";
import type {
  AIProviderHealth,
  AIRequest,
  AIResponse,
  AIResult,
} from "../gateway/types";
import { interpretWithGemini } from "../gateway/interpret.functions";
import { buildSkillsCatalog } from "../gateway/skills-catalog";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly displayName = "Google Gemini";

  /**
   * A chave real vive no servidor. No cliente, tratamos o provider como
   * sempre disponível — se o backend não tiver `LOVABLE_API_KEY`, a
   * chamada falhará e o Gateway cairá em fallback silencioso.
   */
  isConfigured(): boolean {
    return true;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    // Este provider é responsável apenas por interpretação de intenção.
    // Chat livre é atendido pelo interpret() reutilizando o campo response.
    const result = await this.interpret(request);
    return {
      content: result.response,
      provider: this.id,
      model: "google/gemini-3.5-flash",
      raw: result.raw,
    };
  }

  async interpret(request: AIRequest): Promise<AIResult> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const message = lastUser?.content?.trim() ?? "";
    if (!message) {
      throw new Error("GEMINI_EMPTY_MESSAGE");
    }

    const skills = buildSkillsCatalog();
    const context = (request.context ?? {}) as Record<string, unknown>;
    const companyName =
      typeof context.companyName === "string" ? context.companyName : undefined;

    const data = await interpretWithGemini({
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
    // Sondagem leve — evita gastar tokens só para health check.
    return {
      provider: this.id,
      ok: true,
      message: "Gemini via Lovable AI Gateway (server-side).",
    };
  }
}
