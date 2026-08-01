/**
 * Bella Contadora — Vendas (Sprint 6.4): contratos da Bella dentro de Vendas.
 *
 * Camada 100% de leitura/apresentação. NENHUMA regra de venda é criada aqui:
 * faturamento, ticket médio, status, ranking de produtos e clientes vêm do
 * `salesService` / `AccountingSummary` já existentes. Nada é recalculado e
 * nenhum botão executa ação — apenas navegação.
 */
import type { AccountingInsight, InsightActionId } from "../insights";
import type { BellaNotification, NotificationActionId } from "../proactive";
import type { AccountingSummary, HealthLevel, TrendComparison } from "../types";

/** Destinos de navegação permitidos no painel de vendas da Bella. */
export type BellaSalesLinkId =
  | "abrir_vendas"
  | "nova_venda"
  | "abrir_pdv"
  | "abrir_venda"
  | "abrir_clientes"
  | "abrir_produtos"
  | "abrir_relatorios"
  | "abrir_painel_executivo";

export interface BellaSalesLink {
  id: BellaSalesLinkId;
  label: string;
  /** Rota já existente do NexOS (somente navegação). */
  href: string;
}

/** Linha do breakdown por status — já apurada pela RPC `sales_status_breakdown`. */
export interface BellaSalesStatusLike {
  status: string;
  count: number;
  total: number;
}

/** Métricas já apuradas por `salesService.metrics` (nenhum recálculo aqui). */
export interface BellaSalesMetricsLike {
  dayCount: number;
  dayTotal: number;
  monthCount: number;
  monthTotal: number;
  averageTicket: number;
  paidTotal: number;
  breakdown?: readonly BellaSalesStatusLike[];
}

export type BellaSalesMetricId =
  | "faturamento_hoje"
  | "vendas_hoje"
  | "faturamento_mes"
  | "vendas_mes"
  | "ticket_medio"
  | "margem_bruta"
  | "lucro_liquido"
  | "vendas_pendentes"
  | "vendas_canceladas"
  | "clientes_ativos";

export interface BellaSalesMetric {
  id: BellaSalesMetricId;
  label: string;
  value: number | null;
  available: boolean;
  /** `count` = quantidade · `currency` = R$ · `percent` = %. */
  format: "count" | "currency" | "percent";
  hint?: string;
  link: BellaSalesLink;
}

export type BellaSalesDetailId =
  | "tendencia_hoje"
  | "tendencia_mes"
  | "produto_mais_vendido"
  | "melhor_cliente";

export interface BellaSalesDetail {
  id: BellaSalesDetailId;
  label: string;
  value: string | null;
  available: boolean;
  hint?: string;
  link: BellaSalesLink;
}

export type BellaSalesAlertId =
  | "sem_vendas_hoje"
  | "queda_faturamento"
  | "queda_lucro"
  | "muitas_canceladas"
  | "vendas_pendentes"
  | "ticket_baixo"
  | "margem_baixa"
  | "poucos_clientes";

export type BellaSalesSeverity = "critical" | "warning" | "info";

export interface BellaSalesAlert {
  id: string;
  severity: BellaSalesSeverity;
  title: string;
  message: string;
  recommendation: string;
  /** `sales` = derivado de Vendas · `proactive` = notificação da Bella. */
  source: "sales" | "proactive";
  link: BellaSalesLink;
}

export interface BellaSalesRecommendation {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: AccountingInsight["severity"];
  category: AccountingInsight["category"];
  priority: number;
  link: BellaSalesLink;
}

export interface BellaSalesHealth {
  level: HealthLevel;
  score: number;
  label: string;
  reasons: string[];
}

export interface BellaSalesView {
  available: boolean;
  generatedAt: string;
  metrics: BellaSalesMetric[];
  details: BellaSalesDetail[];
  health: BellaSalesHealth | null;
  alerts: BellaSalesAlert[];
  recommendations: BellaSalesRecommendation[];
  missing: string[];
}

export interface BellaSalesInput {
  metrics?: BellaSalesMetricsLike | null;
  summary?: AccountingSummary | null;
  insights?: readonly AccountingInsight[];
  notifications?: readonly BellaNotification[];
}

export interface BellaSalesOptions {
  alertLimit?: number;
  recommendationLimit?: number;
  /** Referência temporal determinística (testes). */
  now?: string;
  /** Percentual de cancelamento considerado alto. Padrão 0.1 (10%). */
  cancelRatioLimit?: number;
}

export type BellaSalesActionId = NotificationActionId | InsightActionId;

export type BellaSalesTrend = TrendComparison;
