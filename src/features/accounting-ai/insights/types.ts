/**
 * Bella Contadora — contratos do Insight Engine.
 *
 * Camada 100% pura: nenhum destes tipos conhece React, Supabase ou serviços.
 * Um insight é sempre uma *interpretação* de números já apurados pelos
 * motores existentes do NexOS — nunca um novo cálculo de negócio.
 */

/** Severidade do insight (define também a ordenação padrão). */
export type InsightSeverity = "critical" | "warning" | "success" | "info";

/** Categorias oficiais da Sprint 5.2. */
export type InsightCategory =
  | "receita"
  | "lucro"
  | "caixa"
  | "financeiro"
  | "estoque"
  | "produtos"
  | "clientes"
  | "fiscal";

/** Provider de origem — usado para auditoria e para o rodapé do card. */
export type InsightSourceProvider =
  | "revenue"
  | "today"
  | "trends"
  | "profit"
  | "expenses"
  | "cash"
  | "cashFlow"
  | "taxes"
  | "inventory"
  | "ticket"
  | "margin"
  | "products"
  | "customers"
  | "health";

/** Ação sugerida — apenas recomendação, nunca executada automaticamente. */
export interface InsightAction {
  id: InsightActionId;
  label: string;
}

export type InsightActionId =
  | "comprar_estoque"
  | "cobrar_cliente"
  | "revisar_preco"
  | "reduzir_despesas"
  | "aumentar_divulgacao"
  | "negociar_prazos"
  | "reativar_cliente"
  | "revisar_mix"
  | "manter_ritmo"
  | "acompanhar";

export interface AccountingInsight {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  description: string;
  recommendation: string;
  /** 0–100, maior = mais urgente. Derivado de severidade + magnitude. */
  priority: number;
  action: InsightAction;
  sourceProvider: InsightSourceProvider;
  createdAt: string;
}

/** Agrupamento por categoria (ordem estável). */
export interface InsightGroup {
  category: InsightCategory;
  insights: AccountingInsight[];
}

/** Entradas opcionais que o ERP ainda não fornece por provider. */
export interface InsightEngineOptions {
  /** Referência temporal (para `createdAt` determinístico em testes). */
  now?: Date;
  /** Ticket médio do período anterior, quando disponível. */
  previousAverageTicket?: number | null;
}
