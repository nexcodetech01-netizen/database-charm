/**
 * Bella IA — Module Provider Contract
 *
 * Camada de integração desacoplada entre a Bella IA e os módulos do ERP.
 * Cada módulo (Sales, Finance, Inventory, Customer, Marketing) implementa
 * este contrato. A Bella consome exclusivamente via `BellaProviderRegistry`
 * — nunca acessa serviços/hooks do módulo diretamente.
 *
 * Nesta primeira etapa os providers retornam apenas dados mockados.
 * Futuramente cada provider poderá buscar dados reais do Supabase sem
 * alterar a interface consumida pela Bella.
 */

export type BellaModuleKey =
  | "sales"
  | "finance"
  | "inventory"
  | "customer"
  | "marketing"
  | "fiscal"
  | "accounting"
  | "tax"
  | "executive";

export type BellaPriority = "low" | "medium" | "high" | "urgent";
export type BellaSeverity = "info" | "warning" | "critical";

export interface BellaInsight {
  id: string;
  module: BellaModuleKey;
  title: string;
  description: string;
  priority: BellaPriority;
  createdAt: string;
}

export interface BellaSummary {
  module: BellaModuleKey;
  headline: string;
  highlights: string[];
  updatedAt: string;
}

export interface BellaAlert {
  id: string;
  module: BellaModuleKey;
  title: string;
  description: string;
  severity: BellaSeverity;
  createdAt: string;
}

export interface BellaMetric {
  key: string;
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
}

export interface BellaSuggestion {
  id: string;
  module: BellaModuleKey;
  title: string;
  description: string;
  actionLabel?: string;
  priority: BellaPriority;
}

export interface BellaProviderContext {
  companyId: string;
}

export interface BellaModuleProvider {
  readonly module: BellaModuleKey;
  readonly displayName: string;

  getInsights(ctx: BellaProviderContext): Promise<BellaInsight[]>;
  getSummary(ctx: BellaProviderContext): Promise<BellaSummary>;
  getAlerts(ctx: BellaProviderContext): Promise<BellaAlert[]>;
  getMetrics(ctx: BellaProviderContext): Promise<BellaMetric[]>;
  getSuggestions(ctx: BellaProviderContext): Promise<BellaSuggestion[]>;
}
