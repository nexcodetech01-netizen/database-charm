/**
 * Bella Contadora — Finance (Sprint 6.1): contratos da Bella dentro do Financeiro.
 *
 * Camada 100% de leitura/apresentação. NENHUMA regra financeira é criada aqui:
 * todos os números vêm de `providers` (AccountingSummary), `advisor`
 * (FinancialAdvice), `insights` (AccountingInsight) e `proactive`
 * (BellaNotification). Os botões apenas navegam — nunca executam ação financeira.
 */
import type { AccountingInsight, InsightActionId } from "../insights";
import type { FinancialAdvice } from "../advisor";
import type { BellaNotification, NotificationActionId, NotificationCategory } from "../proactive";
import type { AccountingSummary, HealthLevel } from "../types";

/** Destinos de navegação permitidos no painel financeiro da Bella. */
export type BellaFinanceLinkId =
  | "ver_contas"
  | "ver_caixa"
  | "ver_relatorio"
  | "ver_fluxo"
  | "abrir_financeiro"
  | "abrir_contas"
  | "abrir_clientes"
  | "abrir_produtos";

export interface BellaFinanceLink {
  id: BellaFinanceLinkId;
  label: string;
  /** Rota de navegação (somente leitura, nunca uma ação financeira). */
  href: string;
}

/** Indicador exibido no resumo — sempre derivado, nunca recalculado. */
export interface BellaFinanceMetric {
  id:
    | "receita"
    | "lucro"
    | "caixa"
    | "a_pagar"
    | "a_receber"
    | "retirada_segura";
  label: string;
  value: number | null;
  available: boolean;
  hint?: string;
  link: BellaFinanceLink;
}

/** Linhas de detalhe (contas vencendo, atraso, previstos, pró-labore). */
export interface BellaFinanceDetail {
  id:
    | "contas_vencendo"
    | "contas_atraso"
    | "recebimentos_previstos"
    | "pagamentos_previstos"
    | "prolabore_sugerido";
  label: string;
  value: number | null;
  available: boolean;
  hint?: string;
  link: BellaFinanceLink;
}

export interface BellaFinanceHealth {
  level: HealthLevel;
  score: number;
  label: string;
  reasons: string[];
}

/** Recomendação exibida no painel (insight financeiro + destino de navegação). */
export interface BellaFinanceRecommendation {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: AccountingInsight["severity"];
  category: AccountingInsight["category"];
  priority: number;
  link: BellaFinanceLink;
}

/** View model completo consumido pelo `BellaFinancePanel`. */
export interface BellaFinanceView {
  available: boolean;
  generatedAt: string;
  metrics: BellaFinanceMetric[];
  details: BellaFinanceDetail[];
  health: BellaFinanceHealth | null;
  advice: FinancialAdvice | null;
  alerts: BellaNotification[];
  recommendations: BellaFinanceRecommendation[];
  missing: string[];
}

export interface BellaFinanceInput {
  summary?: AccountingSummary | null;
  insights?: readonly AccountingInsight[];
  advice?: FinancialAdvice | null;
  notifications?: readonly BellaNotification[];
}

export interface BellaFinanceOptions {
  /** Limite de alertas exibidos (padrão 5). */
  alertLimit?: number;
  /** Limite de recomendações exibidas (padrão 5). */
  recommendationLimit?: number;
  /** Referência temporal determinística (testes). */
  now?: string;
}

export type BellaFinanceActionId = NotificationActionId | InsightActionId;

/** Categorias consideradas financeiras no filtro do painel. */
export type BellaFinanceCategory = Extract<
  NotificationCategory,
  "financeiro" | "caixa" | "fiscal" | "receita" | "lucro"
>;
