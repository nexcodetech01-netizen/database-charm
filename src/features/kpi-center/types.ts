/**
 * KPI Center — Centro de Indicadores Operacionais
 * ------------------------------------------------
 * Fila priorizada de ações. NÃO é dashboard. Cada indicador expõe
 * origem, prioridade, impacto e ação sugerida (deep-link ao módulo dono).
 */

export interface KpiCenterRange {
  from: string;
  to: string;
}

export type IndicatorPriority = "critical" | "high" | "medium" | "low";

export type IndicatorOrigin =
  | "pricing"
  | "inventory"
  | "sales"
  | "customers"
  | "finance"
  | "purchases";

export type IndicatorKind =
  | "margin_below_target"
  | "product_without_policy"
  | "pricing_suggestion_pending"
  | "critical_stock"
  | "no_sales_30d"
  | "no_sales_60d"
  | "no_sales_90d"
  | "vip_inactive"
  | "invoice_overdue"
  | "invoice_due_today"
  | "purchase_pending"
  | "receivable_pending";

export type IndicatorActionTarget =
  | "product"
  | "product_stock"
  | "customer"
  | "purchase"
  | "sale"
  | "finance"
  | "dashboard"
  | "simulator"
  | "review";

export interface IndicatorAction {
  label: string;
  target: IndicatorActionTarget;
  /** Optional entity id used to build the deep-link. */
  entityId?: string | null;
}

export interface Indicator {
  id: string;
  kind: IndicatorKind;
  title: string;
  description: string;
  priority: IndicatorPriority;
  origin: IndicatorOrigin;
  /** Human impact hint, e.g. "R$ 1.240 em margem" or "12 produtos". */
  impact: string;
  /** Reference date (ISO) for the indicator. */
  date: string;
  action: IndicatorAction;
  /** Optional filtering hints for scope filters. */
  categoryId?: string | null;
  supplierId?: string | null;
}

export interface KpiCenterFilters {
  companyId: string;
  range: KpiCenterRange;
  categoryId?: string | null;
  supplierId?: string | null;
  priority?: IndicatorPriority | null;
  origin?: IndicatorOrigin | null;
}

export interface KpiCenterSummary {
  total: number;
  critical: number;
  attention: number;
  opportunities: number;
}

export interface KpiCenterResult {
  indicators: Indicator[];
  summary: KpiCenterSummary;
}
