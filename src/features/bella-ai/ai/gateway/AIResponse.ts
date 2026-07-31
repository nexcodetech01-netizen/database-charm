/**
 * Padronização de `AIResponse` cru em `AIResult` — consumido pela Bella.
 *
 * Providers devolvem apenas texto/telemetria. É aqui (e no Gateway) que
 * derivamos intent, confidence e parameters de forma segura.
 */
import type { AIErrorInfo, AIProviderId, AIResponse, AIResult } from "./types";

export interface NormalizeInput {
  response: AIResponse;
  intent?: string | null;
  confidence?: number;
  parameters?: Record<string, unknown>;
}

export function normalizeAIResponse<TParams = Record<string, unknown>>(
  input: NormalizeInput,
): AIResult<TParams> {
  const { response, intent = null, confidence = 0.5, parameters = {} } = input;
  return {
    success: true,
    intent,
    confidence: clamp01(confidence),
    parameters: parameters as TParams,
    response: response.content,
    raw: response.raw,
    provider: response.provider,
  };
}

export function buildErrorResult(
  provider: AIProviderId,
  error: AIErrorInfo,
  fallbackResponse = "No momento estou sem acesso à IA avançada, mas posso continuar respondendo com meus comandos internos.",
): AIResult {
  return {
    success: false,
    intent: null,
    confidence: 0,
    parameters: {},
    response: fallbackResponse,
    provider,
    error,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
