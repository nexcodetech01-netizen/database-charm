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
import { interpretWithOpenAI as interpretWithOpenAIDefault } from "../gateway/interpret-openai.functions";
// buildSkillsCatalog agora exige a injeção do registry para evitar import estático do singleton que vaza código server-side.
// import { buildSkillsCatalog } from "../gateway/skills-catalog";

type InterpretFn = typeof interpretWithOpenAIDefault;

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  readonly displayName = "OpenAI (GPT)";
  private readonly interpretFn: InterpretFn;

  /**
   * CORREÇÃO: `interpretWithOpenAI` é uma server function do TanStack
   * Start. Chamada direto (import estático) a partir de código que
   * eventualmente é acionado por um componente cliente (`bella-ask-panel.tsx`
   * → `handleWithAgentRuntime` → `BellaAIGateway` → aqui), sem passar
   * pelo hook `useServerFn()`, falha com o mesmo erro "data Required"
   * já corrigido hoje no fluxo de notificações — hooks só funcionam
   * dentro de componentes React, e nenhuma dessas classes é um.
   *
   * Em vez de restruturar toda a cadeia de classes pra virar
   * componente/hook, o construtor aceita receber a versão já vinculada
   * (via `useServerFn(interpretWithOpenAI)`) injetada de fora — o
   * componente que efetivamente inicia a conversa é quem cria essa
   * versão vinculada e injeta aqui. Se nada for passado, cai no import
   * direto (seguro só quando chamado de contexto genuinamente
   * server-side, nunca a partir de um componente cliente).
   */
  constructor(interpretFn?: InterpretFn) {
    this.interpretFn = interpretFn ?? interpretWithOpenAIDefault;
  }

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
        : "gpt-4o-mini",
      raw: result.raw,
    };
  }

  async interpret(request: AIRequest): Promise<AIResult> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const message = lastUser?.content?.trim() ?? "";
    
    if (!message) {
      throw new Error("OPENAI_EMPTY_MESSAGE");
    }

    // No servidor, carregamos o registry dinamicamente se não estiver disponível.
    let skills: any[] = [];
    if (typeof window === 'undefined') {
      const { BellaSkillRegistry } = await import("../../skills/registry" + "");
      const { buildSkillsCatalog } = await import("../gateway/skills-catalog" + "");
      await BellaSkillRegistry.ensureInitialized();
      skills = buildSkillsCatalog(BellaSkillRegistry);
    }

    const context = (request.context ?? {}) as Record<string, unknown>;
    const companyName = typeof context.companyName === "string" ? context.companyName : undefined;

    const data = await this.interpretFn({
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
