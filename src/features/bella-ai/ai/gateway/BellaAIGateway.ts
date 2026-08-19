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
import { getBellaAIConfig } from "./get-config.functions";


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
  private preferred: AIProvider | null = null;
  private readonly fallback: AIProvider;
  private readonly defaultTimeoutMs: number;
  private configPromise: Promise<void> | null = null;

  constructor(options: BellaAIGatewayOptions = {}) {
    this.fallback = new MockProvider();
    if (options.preferred) {
      this.preferred = options.preferred;
    }
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
  }

  private async ensureConfig(): Promise<void> {
    if (this.preferred) return;
    if (this.configPromise) return this.configPromise;

    this.configPromise = (async () => {
      try {
        const config = await getBellaAIConfig();
        this.preferred = this.createProvider(config.provider);
      } catch (err) {
        console.error("[BellaAIGateway] Failed to load server config, using Gemini default", err);
        this.preferred = new GeminiProvider();
      }
    })();

    return this.configPromise;
  }

  private createProvider(id: AIProviderId): AIProvider {
    switch (id) {
      case "openai":
        return new OpenAIProvider();
      case "gemini":
        return new GeminiProvider();
      default:
        return new MockProvider();
    }
  }

  /** Provider ativo (útil para telemetria/UI). */
  async getActiveProviderId(): Promise<AIProviderId> {
    await this.ensureConfig();
    return this.preferred?.id ?? this.fallback.id;
  }


  /** Conversa livre — devolve `AIResult` já padronizado. */
  async chat(input: AskInput): Promise<AIResult> {
    await this.ensureConfig();
    const request = this.buildRequest(input);
    return this.runWithFallback((provider) => this.doChat(provider, request));
  }

  /** Interpretação de intenção — retorna intent + parameters. */
  async interpret(input: AskInput): Promise<AIResult> {
    await this.ensureConfig();
    const request = this.buildRequest(input);
    return this.runWithFallback((provider) => this.doInterpret(provider, request));
  }


  /** Health check de todos os providers conhecidos. */
  async healthCheck(): Promise<AIProviderHealth[]> {
    await this.ensureConfig();
    const providers = uniqueProviders([this.preferred!, this.fallback]);
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
    const preferred = this.preferred!;
    const startedAt = Date.now();

    // Tenta preferido
    if (preferred.isConfigured()) {
      try {
        const result = await call(preferred);
        // Telemetria já vem no result.raw para OpenAI, mas garantimos aqui
        console.info(`[BellaAIGateway] Processed by ${preferred.id}`, {
          model: result.raw && typeof result.raw === 'object' && 'telemetry' in result.raw ? (result.raw as any).telemetry?.model : 'unknown',
          latency: Date.now() - startedAt,
          fallbackUsed: false
        });
        return result;
      } catch (err) {
        const info = describeError(err);
        console.warn(`[BellaAIGateway] ${preferred.id} failed, falling back to ${this.fallback.id}`, {
          ...info,
          originalError: err instanceof Error ? err.message : String(err)
        });
        // Cai silenciosamente no fallback.
        try {
          const fallbackResult = await call(this.fallback);
          return {
            ...fallbackResult,
            success: false,
            error: { ...info, fallbackUsed: true },
          };
        } catch {
          return buildErrorResult(preferred.id, { ...info, fallbackUsed: false });
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
          message: `Provider "${preferred.id}" não configurado. Usando modo offline.`,
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
 * O provider preferido é determinado pelo servidor via getBellaAIConfig().
 */
export const bellaAIGateway = new BellaAIGateway();


// Reexports úteis para consumidores.
export { BELLA_SYSTEM_PROMPT };
export type { AIProvider };
