/**
 * Bella Contadora — Compras (Sprint 6.5): contratos da Bella dentro de Compras.
 *
 * Camada 100% de leitura/apresentação. NENHUMA regra de compra é criada aqui:
 * pedidos, totais, status, fornecedores e produtos aguardando reposição vêm
 * do `purchasesService` / `inventoryService` / `AccountingSummary` já
 * existentes. Nada é recalculado (custo médio, estoque, rateio) e nenhum
 * botão executa ação — apenas navegação.
 */
import type { AccountingInsight, InsightActionId } from "../insights";
import type { BellaNotification, NotificationActionId } from "../proactive";
import type { AccountingSummary, HealthLevel } from "../types";

/** Destinos de navegação permitidos no painel de compras da Bella. */
export type BellaPurchasesLinkId =
  | "abrir_compras"
  | "nova_compra"
  | "abrir_pedido"
  | "abrir_fornecedores"
  | "abrir_fornecedor"
  | "abrir_produtos"
  | "abrir_produto"
  | "abrir_estoque"
  | "ver_movimentacoes"
  | "abrir_relatorios";

export interface BellaPurchasesLink {
  id: BellaPurchasesLinkId;
  label: string;
  /** Rota já existente do NexOS (somente navegação). */
  href: string;
}

/** Pedido lido de `purchasesService.list` (subconjunto estrutural). */
export interface BellaPurchaseOrderLike {
  id: string;
  number?: string | null;
  status?: string | null;
  grand_total?: number | null;
  purchase_date?: string | null;
  expected_delivery_date?: string | null;
  received_at?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
}

/** Métricas já apuradas por `purchasesService.metrics` (nenhum recálculo). */
export interface BellaPurchasesMetricsLike {
  monthCount: number;
  monthTotal: number;
  pending: number;
  activeSuppliers: number;
}

/** Fornecedor cadastrado — vem de `purchasesService.listActiveSuppliers`. */
export interface BellaPurchaseSupplierLike {
  id: string;
  name: string;
}

/** Produto aguardando reposição — vem de `inventoryService.metrics`. */
export interface BellaPurchaseProductLike {
  id: string;
  name: string;
  sku?: string | null;
  stock?: number | null;
  min_stock?: number | null;
}

/** Métricas de estoque já apuradas (somente o que Compras precisa ler). */
export interface BellaPurchasesInventoryLike {
  productCount?: number;
  inventoryValue?: number;
  belowMin: readonly BellaPurchaseProductLike[];
  stagnant?: readonly BellaPurchaseProductLike[];
}

export type BellaPurchasesMetricId =
  | "compras_hoje"
  | "compras_mes"
  | "pedidos_pendentes"
  | "pedidos_recebidos"
  | "pedidos_atrasados"
  | "fornecedores_ativos"
  | "fornecedores_inativos"
  | "aguardando_reposicao";

export interface BellaPurchasesMetric {
  id: BellaPurchasesMetricId;
  label: string;
  value: number | null;
  available: boolean;
  /** `count` = quantidade · `currency` = R$. */
  format: "count" | "currency";
  hint?: string;
  link: BellaPurchasesLink;
}

export type BellaPurchasesDetailId =
  | "maior_compra"
  | "ultima_compra"
  | "fornecedor_principal"
  | "reposicao_urgente";

export interface BellaPurchasesDetail {
  id: BellaPurchasesDetailId;
  label: string;
  value: string | null;
  available: boolean;
  hint?: string;
  link: BellaPurchasesLink;
}

export type BellaPurchasesAlertId =
  | "pedidos_atrasados"
  | "produtos_sem_reposicao"
  | "fornecedor_inativo"
  | "fornecedor_sem_pedidos"
  | "reposicao_urgente"
  | "compra_acima_da_media"
  | "capital_elevado_compras"
  | "aguardando_recebimento";

export type BellaPurchasesSeverity = "critical" | "warning" | "info";

export interface BellaPurchasesAlert {
  id: string;
  severity: BellaPurchasesSeverity;
  title: string;
  message: string;
  recommendation: string;
  /** `purchases` = derivado de Compras · `proactive` = notificação da Bella. */
  source: "purchases" | "proactive";
  link: BellaPurchasesLink;
}

export interface BellaPurchasesRecommendation {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: AccountingInsight["severity"];
  category: AccountingInsight["category"];
  priority: number;
  link: BellaPurchasesLink;
}

export interface BellaPurchasesHealth {
  level: HealthLevel;
  score: number;
  label: string;
  reasons: string[];
}

export interface BellaPurchasesView {
  available: boolean;
  generatedAt: string;
  metrics: BellaPurchasesMetric[];
  details: BellaPurchasesDetail[];
  health: BellaPurchasesHealth | null;
  alerts: BellaPurchasesAlert[];
  recommendations: BellaPurchasesRecommendation[];
  missing: string[];
}

export interface BellaPurchasesInput {
  metrics?: BellaPurchasesMetricsLike | null;
  orders?: readonly BellaPurchaseOrderLike[] | null;
  suppliers?: readonly BellaPurchaseSupplierLike[] | null;
  inventory?: BellaPurchasesInventoryLike | null;
  summary?: AccountingSummary | null;
  insights?: readonly AccountingInsight[];
  notifications?: readonly BellaNotification[];
}

export interface BellaPurchasesOptions {
  alertLimit?: number;
  recommendationLimit?: number;
  /** Referência temporal determinística (testes). */
  now?: string;
  /** Fator sobre o ticket médio de compra considerado "acima da média". */
  aboveAverageFactor?: number;
  /** Percentual do capital em estoque comprometido considerado elevado. */
  capitalRatioLimit?: number;
}

export type BellaPurchasesActionId = NotificationActionId | InsightActionId;
