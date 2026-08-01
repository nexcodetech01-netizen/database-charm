/**
 * Bella Contadora — CRM (Sprint 6.6): contratos da Bella dentro de Clientes/CRM.
 *
 * Camada 100% de leitura/apresentação. NENHUMA regra de cliente é criada aqui:
 * contagens, recorrência, inatividade e ranking vêm de `customersService.metrics`,
 * `reportsService.customers` e do `AccountingSummary` já existentes. Nada é
 * recalculado, nenhum cliente é alterado e nenhum botão executa ação.
 */
import type { AccountingInsight, InsightActionId } from "../insights";
import type { BellaNotification, NotificationActionId } from "../proactive";
import type { AccountingSummary, HealthLevel } from "../types";

/** Destinos de navegação permitidos no painel de CRM da Bella. */
export type BellaCrmLinkId =
  | "abrir_clientes"
  | "abrir_cliente"
  | "abrir_crm"
  | "abrir_vendas"
  | "abrir_venda"
  | "abrir_historico"
  | "abrir_dashboard"
  | "abrir_relatorios"
  | "abrir_ranking";

export interface BellaCrmLink {
  id: BellaCrmLinkId;
  label: string;
  /** Rota já existente do NexOS (somente navegação). */
  href: string;
}

/** Métricas já apuradas por `customersService.metrics` (nenhum recálculo). */
export interface BellaCrmMetricsLike {
  total: number;
  active: number;
  newThisMonth: number;
  inactive90: number;
}

/** Relatório já apurado por `reportsService.customers` (nenhum recálculo). */
export interface BellaCrmReportLike {
  metrics: {
    total: number;
    active: number;
    newInRange: number;
    recurring: number;
    inactive: number;
  };
  topCustomers: readonly {
    id: string;
    name: string;
    purchases: number;
    revenue: number;
  }[];
}

/** Cliente já persistido — lido de `customersService.list`. */
export interface BellaCrmCustomerLike {
  id: string;
  name: string;
  status?: string | null;
  created_at?: string | null;
  last_interaction_at?: string | null;
}

/** Venda já persistida — lida de `salesService.list`. */
export interface BellaCrmSaleLike {
  id: string;
  number?: string | number | null;
  customer_id?: string | null;
  customer_name?: string | null;
  grand_total?: number | null;
  sale_date?: string | null;
  status?: string | null;
}

export type BellaCrmMetricId =
  | "clientes_ativos"
  | "clientes_novos"
  | "clientes_inativos"
  | "clientes_recorrentes"
  | "clientes_sem_compras"
  | "clientes_recuperaveis"
  | "ticket_medio"
  | "faturamento_clientes";

export interface BellaCrmMetric {
  id: BellaCrmMetricId;
  label: string;
  value: number | null;
  available: boolean;
  /** `count` = quantidade · `currency` = R$ · `percent` = %. */
  format: "count" | "currency" | "percent";
  hint?: string;
  link: BellaCrmLink;
}

export type BellaCrmDetailId =
  | "maior_comprador"
  | "maior_faturamento"
  | "maior_ticket"
  | "ultimo_cliente"
  | "ultima_venda";

export interface BellaCrmDetail {
  id: BellaCrmDetailId;
  label: string;
  value: string | null;
  available: boolean;
  hint?: string;
  link: BellaCrmLink;
}

export type BellaCrmAlertId =
  | "clientes_sem_compras"
  | "clientes_inativos"
  | "clientes_perdidos"
  | "queda_recorrencia"
  | "reducao_ticket"
  | "clientes_vip"
  | "clientes_em_crescimento"
  | "clientes_sem_contato";

export type BellaCrmSeverity = "critical" | "warning" | "info";

export interface BellaCrmAlert {
  id: string;
  severity: BellaCrmSeverity;
  title: string;
  message: string;
  recommendation: string;
  /** `crm` = derivado de Clientes/Relatórios · `proactive` = notificação da Bella. */
  source: "crm" | "proactive";
  link: BellaCrmLink;
}

export interface BellaCrmRecommendation {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: AccountingInsight["severity"];
  category: AccountingInsight["category"];
  priority: number;
  link: BellaCrmLink;
}

export interface BellaCrmHealth {
  level: HealthLevel;
  score: number;
  label: string;
  reasons: string[];
}

export interface BellaCrmView {
  available: boolean;
  generatedAt: string;
  metrics: BellaCrmMetric[];
  details: BellaCrmDetail[];
  health: BellaCrmHealth | null;
  alerts: BellaCrmAlert[];
  recommendations: BellaCrmRecommendation[];
  missing: string[];
}

export interface BellaCrmInput {
  summary?: AccountingSummary | null;
  metrics?: BellaCrmMetricsLike | null;
  report?: BellaCrmReportLike | null;
  customers?: readonly BellaCrmCustomerLike[] | null;
  sales?: readonly BellaCrmSaleLike[] | null;
  insights?: readonly AccountingInsight[];
  notifications?: readonly BellaNotification[];
}

export interface BellaCrmOptions {
  alertLimit?: number;
  recommendationLimit?: number;
  /** Referência temporal determinística (testes). */
  now?: string;
  /** Participação de faturamento que caracteriza um cliente VIP. Padrão 0.3. */
  vipRevenueShare?: number;
  /** Proporção mínima de clientes recorrentes esperada. Padrão 0.2. */
  recurringRatioLimit?: number;
  /** Dias sem contato considerados excessivos. Padrão 60. */
  noContactDays?: number;
}

export type BellaCrmActionId = NotificationActionId | InsightActionId;
