/**
 * Bella AI Gateway — tipos públicos.
 *
 * Camada 100% desacoplada: nenhuma Skill, Service, Provider de módulo
 * ou Action existente pode importar implementações concretas de IA.
 * Todo consumidor conversa apenas com o `BellaAIGateway` via estes tipos.
 */

/** Identificação lógica do provider — nunca expõe SDK/vendor. */
export type AIProviderId = "mock" | "gemini" | "openai" | "claude" | "local";

/** Papéis suportados em mensagens de chat. */
export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  /** Metadados livres (ex.: toolName, timestamp) — nunca dados sensíveis. */
  meta?: Record<string, unknown>;
}

/** Requisição normalizada — o Gateway monta antes de chamar o provider. */
export interface AIRequest {
  /** Prompt de sistema (persona/guardrails). Opcional. */
  system?: string;
  /** Histórico completo de mensagens já normalizado. */
  messages: AIMessage[];
  /** Contexto adicional (companyId, módulo atual, skillId, etc.). */
  context?: Record<string, unknown>;
  /** Temperatura sugerida — providers podem ignorar. */
  temperature?: number;
  /** Limite de tokens sugerido — providers podem ignorar. */
  maxTokens?: number;
  /** Timeout em ms — o Gateway aborta se estourar. */
  timeoutMs?: number;
}

/** Resposta bruta devolvida pelo provider (antes da padronização). */
export interface AIResponse {
  content: string;
  provider: AIProviderId;
  model?: string;
  tokensInput?: number;
  tokensOutput?: number;
  /** Payload cru retornado pelo SDK — mantido para auditoria. */
  raw?: unknown;
}

/**
 * Retorno padronizado devolvido pelo Gateway para toda a Bella.
 * Consumidores (UI, Engine, Skills) só olham este contrato.
 */
export interface AIResult<TParams = Record<string, unknown>> {
  /** true quando o provider respondeu com sucesso e sem fallback de erro. */
  success: boolean;
  /** Intent identificada (quando aplicável). Ex.: "create_customer". */
  intent: string | null;
  /** Confiança 0..1 — quando o provider não informar, usar heurística. */
  confidence: number;
  /** Parâmetros extraídos da mensagem. */
  parameters: TParams;
  /** Resposta natural para exibir ao usuário. */
  response: string;
  /** Payload cru do provider — nunca renderizar direto. */
  raw?: unknown;
  /** Preenchido quando `success === false`. */
  error?: AIErrorInfo;
  /** Identificação do provider que atendeu (ou "mock" no fallback). */
  provider: AIProviderId;
}

export type AIErrorCode =
  | "provider_unavailable"
  | "timeout"
  | "rate_limited"
  | "invalid_response"
  | "not_configured"
  | "unknown";

export interface AIErrorInfo {
  code: AIErrorCode;
  message: string;
  /** true se o Gateway já aplicou fallback (ex.: MockProvider). */
  fallbackUsed?: boolean;
}

/** Status de saúde reportado por cada provider. */
export interface AIProviderHealth {
  provider: AIProviderId;
  ok: boolean;
  latencyMs?: number;
  message?: string;
}
