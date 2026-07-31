/**
 * MockProvider — provider local para desenvolvimento e fallback.
 *
 * Não faz chamadas externas, não consome créditos e nunca falha.
 * Serve como fallback quando o provider real está indisponível, garantindo
 * que o ERP continue funcionando (a Bella cai para Keyword Parser + Action
 * Engine sem quebrar a experiência do usuário).
 */
import type { AIProvider } from "../gateway/AIProvider";
import { normalizeAIResponse } from "../gateway/AIResponse";
import type {
  AIProviderHealth,
  AIRequest,
  AIResponse,
  AIResult,
} from "../gateway/types";

export class MockProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly displayName = "Mock (offline)";

  isConfigured(): boolean {
    return true;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const echo = lastUser?.content ?? "";
    return {
      content: echo
        ? `Recebi sua mensagem: "${truncate(echo, 140)}". (resposta gerada em modo offline)`
        : "Estou em modo offline no momento.",
      provider: this.id,
      model: "mock-1",
      tokensInput: echo.length,
      tokensOutput: 0,
      raw: { mock: true },
    };
  }

  async interpret(request: AIRequest): Promise<AIResult> {
    const response = await this.chat(request);
    return normalizeAIResponse({
      response,
      intent: null,
      confidence: 0.1,
      parameters: {},
    });
  }

  async healthCheck(): Promise<AIProviderHealth> {
    return { provider: this.id, ok: true, latencyMs: 0, message: "mock always on" };
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
