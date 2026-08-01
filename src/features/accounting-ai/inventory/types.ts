/**
 * Bella Contadora — Estoque (Sprint 6.3): contratos da Bella dentro do Estoque.
 *
 * Camada 100% de leitura/apresentação. NENHUMA regra de estoque é criada
 * aqui: saldos, mínimos, valor de estoque, produtos parados e movimentações
 * vêm do `inventoryService` / `AccountingSummary` já existentes. Nada é
 * recalculado (custo, giro, saldo) e nenhum botão executa ação — apenas
 * navegação.
 */
import type { AccountingInsight, InsightActionId } from "../insights";
import type { BellaNotification, NotificationActionId } from "../proactive";
import type { AccountingSummary, HealthLevel } from "../types";

/** Destinos de navegação permitidos no painel de estoque da Bella. */
export type BellaInventoryLinkId =
  | "abrir_estoque"
  | "ver_movimentacoes"
  | "abrir_produtos"
  | "abrir_produto"
  | "abrir_inventario"
  | "abrir_compras"
  | "abrir_fornecedores"
  | "abrir_relatorios"
  | "abrir_curva_abc";

export interface BellaInventoryLink {
  id: BellaInventoryLinkId;
  label: string;
  /** Rota já existente do NexOS (somente navegação). */
  href: string;
}

/** Produto lido do Estoque/Resumo (subconjunto estrutural, sem cálculo). */
export interface BellaInventoryProductLike {
  id: string;
  name: string;
  sku?: string | null;
  stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  cost?: number | null;
}

/** Produto ranqueado por venda — vem de `summary.products`. */
export interface BellaInventorySoldProductLike {
  id: string;
  name: string;
  sku?: string | null;
  quantity: number;
  revenue: number;
}

/** Movimentação lida do `inventoryService` (subconjunto estrutural). */
export interface BellaInventoryMovementLike {
  id: string;
  type?: string | null;
  source?: string | null;
  quantity?: number | null;
  movement_date?: string | null;
  created_at?: string | null;
}

/** Métricas já apuradas por `inventoryService.metrics` (RPC existente). */
export interface BellaInventoryMetricsLike {
  productCount: number;
  totalItems: number;
  inventoryValue: number;
  todayMovements: number;
  belowMin: readonly BellaInventoryProductLike[];
  stagnant: readonly BellaInventoryProductLike[];
}

export type BellaInventoryMetricId =
  | "produtos_ativos"
  | "sem_estoque"
  | "abaixo_minimo"
  | "acima_maximo"
  | "sem_movimentacao"
  | "parados"
  | "capital_estoque"
  | "valor_parado"
  | "itens_estoque"
  | "movimentacoes";

export interface BellaInventoryMetric {
  id: BellaInventoryMetricId;
  label: string;
  value: number | null;
  available: boolean;
  /** `count` = quantidade · `currency` = R$. */
  format: "count" | "currency";
  hint?: string;
  link: BellaInventoryLink;
}

export type BellaInventoryDetailId =
  | "ultima_movimentacao"
  | "movimentacoes_hoje"
  | "produto_mais_vendido"
  | "produto_mais_critico";

export interface BellaInventoryDetail {
  id: BellaInventoryDetailId;
  label: string;
  value: string | null;
  available: boolean;
  hint?: string;
  link: BellaInventoryLink;
}

export type BellaInventoryAlertId =
  | "estoque_critico"
  | "produto_ruptura"
  | "proximo_minimo"
  | "produto_parado"
  | "produto_sem_venda"
  | "produto_sem_compra"
  | "capital_parado"
  | "produto_negativo"
  | "sem_movimentacao";

export type BellaInventorySeverity = "critical" | "warning" | "info";

export interface BellaInventoryAlert {
  id: string;
  severity: BellaInventorySeverity;
  title: string;
  message: string;
  recommendation: string;
  /** `inventory` = derivado do Estoque · `proactive` = notificação da Bella. */
  source: "inventory" | "proactive";
  link: BellaInventoryLink;
}

export interface BellaInventoryRecommendation {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: AccountingInsight["severity"];
  category: AccountingInsight["category"];
  priority: number;
  link: BellaInventoryLink;
}

export interface BellaInventoryHealth {
  level: HealthLevel;
  score: number;
  label: string;
  reasons: string[];
}

export interface BellaInventoryView {
  available: boolean;
  generatedAt: string;
  metrics: BellaInventoryMetric[];
  details: BellaInventoryDetail[];
  health: BellaInventoryHealth | null;
  alerts: BellaInventoryAlert[];
  recommendations: BellaInventoryRecommendation[];
  missing: string[];
}

export interface BellaInventoryInput {
  metrics?: BellaInventoryMetricsLike | null;
  movements?: readonly BellaInventoryMovementLike[] | null;
  summary?: AccountingSummary | null;
  insights?: readonly AccountingInsight[];
  notifications?: readonly BellaNotification[];
}

export interface BellaInventoryOptions {
  alertLimit?: number;
  recommendationLimit?: number;
  /** Referência temporal determinística (testes). */
  now?: string;
  /** Fator sobre o mínimo para "próximo do mínimo". Padrão 1.2. */
  nearMinFactor?: number;
}

export type BellaInventoryActionId = NotificationActionId | InsightActionId;
