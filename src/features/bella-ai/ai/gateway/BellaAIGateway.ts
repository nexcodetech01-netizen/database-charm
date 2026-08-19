/**
 * BellaAIGateway — único ponto autorizado a conversar com modelos de IA.
 *
 * Responsabilidades:
 *   - selecionar provider (preferido + fallback)
 *   - montar contexto (system prompt + tools)
 *   - enviar prompts
 *   - interpretar/padronizar resposta em `AIResult`
 *   - tratar erros e aplicar fallback silencioso no MockProvider
 *
 * Regras:
 *   - Nenhum consumidor conhece providers concretos — só falam com o Gateway.
 *   - Se a IA estiver indisponível, o Gateway devolve `AIResult` com
 *     `success: false` + `fallbackUsed: true`. A Bella segue funcionando
 *     via Keyword Parser + Action Engine no chamador.
 */
import type { AIProvider } from "./AIProvider";
import { buildAIRequest, type BuildRequestInput } from "./AIRequest";
import { buildErrorResult, normalizeAIResponse } from "./AIResponse";
import type {
  AIErrorCode,
  AIProviderHealth,
  AIProviderId,
  AIRequest,
  AIResult,
} from "./types";
import { MockProvider } from "../providers/MockProvider";
import { GeminiProvider } from "../providers/GeminiProvider";
import { OpenAIProvider } from "../providers/OpenAIProvider";
import { BELLA_SYSTEM_PROMPT, withCompanyContext } from "../prompts/systemPrompt";

export interface BellaAIGatewayOptions {
  /** Provider preferido — se falhar, aplica fallback no MockProvider. */
  preferred?: AIProvider;
  /** Timeout global padrão em ms. */
  defaultTimeoutMs?: number;
}

export interface AskInput extends Omit<BuildRequestInput, "system"> {
  system?: string;
  companyName?: string | null;
}

export class BellaAIGateway {
  private readonly preferred: AIProvider;
  private readonly fallback: AIProvider;
  private readonly defaultTimeoutMs: number;

  constructor(options: BellaAIGatewayOptions = {}) {
    this.fallback = new MockProvider();
    this.preferred = options.preferred ?? this.fallback;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
  }

  /** Provider ativo (útil para telemetria/UI). */
  getActiveProviderId(): AIProviderId {
    return this.preferred.id;
  }

  /** Conversa livre — devolve `AIResult` já padronizado. */
  async chat(input: AskInput): Promise<AIResult> {
    const request = this.buildRequest(input);
    return this.runWithFallback((provider) => this.doChat(provider, request));
  }

  /** Interpretação de intenção — retorna intent + parameters. */
  async interpret(input: AskInput): Promise<AIResult> {
    const request = this.buildRequest(input);
    return this.runWithFallback((provider) => this.doInterpret(provider, request));
  }

  /** Health check de todos os providers conhecidos. */
  async healthCheck(): Promise<AIProviderHealth[]> {
    const providers = uniqueProviders([this.preferred, this.fallback]);
    return Promise.all(providers.map((p) => safeHealth(p)));
  }

  /* -------------------- internals -------------------- */

  private buildRequest(input: AskInput): AIRequest {
    return buildAIRequest({
      ...input,
      system: input.system ?? withCompanyContext(input.companyName ?? null),
      timeoutMs: input.timeoutMs ?? this.defaultTimeoutMs,
    });
  }

  private async runWithFallback(
    call: (provider: AIProvider) => Promise<AIResult>,
  ): Promise<AIResult> {
    // Tenta preferido
    if (this.preferred.isConfigured()) {
      try {
        return await call(this.preferred);
      } catch (err) {
        const info = describeError(err);
        // Cai silenciosamente no fallback.
        try {
          const fallbackResult = await call(this.fallback);
          return {
            ...fallbackResult,
            success: false,
            error: { ...info, fallbackUsed: true },
          };
        } catch {
          return buildErrorResult(this.preferred.id, { ...info, fallbackUsed: false });
        }
      }
    }
    // Preferido não configurado — usa fallback direto.
    try {
      const fallbackResult = await call(this.fallback);
      return {
        ...fallbackResult,
        success: false,
        error: {
          code: "not_configured",
          message: `Provider "${this.preferred.id}" não configurado. Usando modo offline.`,
          fallbackUsed: true,
        },
      };
    } catch (err) {
      return buildErrorResult(this.fallback.id, describeError(err));
    }
  }

  private async doChat(provider: AIProvider, request: AIRequest): Promise<AIResult> {
    const response = await provider.chat(request);
    return normalizeAIResponse({ response, intent: null, confidence: 0.5 });
  }

  private async doInterpret(provider: AIProvider, request: AIRequest): Promise<AIResult> {
    return provider.interpret(request);
  }
}

/* -------------------- helpers -------------------- */

function describeError(err: unknown): { code: AIErrorCode; message: string } {
  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    if (name.includes("timeout")) return { code: "timeout", message: err.message };
    if (name.includes("ratelimit")) return { code: "rate_limited", message: err.message };
    if ("code" in err && (err as { code?: string }).code === "not_configured") {
      return { code: "not_configured", message: err.message };
    }
    return { code: "provider_unavailable", message: err.message };
  }
  return { code: "unknown", message: "Erro desconhecido ao conversar com a IA." };
}

async function safeHealth(provider: AIProvider): Promise<AIProviderHealth> {
  try {
    return await provider.healthCheck();
  } catch (err) {
    return {
      provider: provider.id,
      ok: false,
      message: err instanceof Error ? err.message : "healthCheck falhou",
    };
  }
}

function uniqueProviders(list: AIProvider[]): AIProvider[] {
  const seen = new Set<AIProviderId>();
  const out: AIProvider[] = [];
  for (const p of list) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/* -------------------- default instance -------------------- */

/**
 * Instância padrão usada pela Bella.
 * O provider preferido é determinado por BELLA_AI_PROVIDER (openai | gemini | mock).
 */
const DEFAULT_PROVIDER_ID = (import.meta as any).env?.VITE_BELLA_AI_PROVIDER || "gemini";

function createPreferredProvider(): AIProvider {
  switch (DEFAULT_PROVIDER_ID) {
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      return new MockProvider();
  }
}

export const bellaAIGateway = new BellaAIGateway({
  preferred: createPreferredProvider(),
});

// Reexports úteis para consumidores.
export { BELLA_SYSTEM_PROMPT };
export type { AIProvider };
