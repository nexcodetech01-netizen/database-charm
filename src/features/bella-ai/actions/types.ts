/**
 * Bella IA — Actions layer
 *
 * Contratos da camada de interpretação/execução de comandos. Totalmente
 * desacoplada da UI e de qualquer LLM: hoje o parser é baseado em
 * palavras-chave; amanhã pode ser substituído por um LLM sem alterar
 * o restante da arquitetura.
 */

import type { BellaMetric, BellaPriority } from "../providers/modules/base";

export type BellaActionType =
  | "GET_CASH_BALANCE"
  | "GET_MONTH_REVENUE"
  | "GET_MONTH_EXPENSES"
  | "GET_OVERDUE_BILLS"
  | "GET_CASHFLOW"
  | "GET_FINANCIAL_SUMMARY"
  | "EXECUTE_SKILL";

export interface BellaActionIntent {
  action: BellaActionType;
  confidence: number; // 0..1 — heurística de match
  matchedKeywords: string[];
  /** Presente apenas em intents de execução (action === "EXECUTE_SKILL"). */
  skillId?: string;
  /** Payload opcional já extraído da mensagem para a Skill. */
  payload?: Record<string, unknown>;
}

export interface BellaActionSuggestion {
  id: string;
  title: string;
  actionLabel?: string;
}

export interface BellaActionResponse {
  action: BellaActionType | "UNKNOWN";
  title: string;
  description: string;
  metrics: BellaMetric[];
  priority: BellaPriority;
  suggestions: BellaActionSuggestion[];
}

export interface BellaActionContext {
  companyId: string;
  /** Presente quando o comando foi disparado por um usuário autenticado. */
  userId?: string | null;
}

/**
 * Contrato do parser. Implementação padrão usa keywords; um LLM
 * pode implementar a mesma interface no futuro.
 */
export interface BellaActionParser {
  parse(message: string): BellaActionIntent | null;
}

/**
 * Handler executa uma Action já identificada. Cada Action tem exatamente
 * um handler registrado no engine.
 */
export interface BellaActionHandler {
  readonly action: BellaActionType;
  execute(ctx: BellaActionContext): Promise<BellaActionResponse>;
}

export const UNKNOWN_ACTION_RESPONSE: BellaActionResponse = {
  action: "UNKNOWN",
  title: "Comando não reconhecido",
  description: "Essa funcionalidade ainda não foi implementada.",
  metrics: [],
  priority: "low",
  suggestions: [],
};
