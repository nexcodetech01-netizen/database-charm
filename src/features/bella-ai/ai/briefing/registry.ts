/**
 * Briefing Registry — allow-list explícita das fontes que a Bella pode
 * consultar para montar o Daily Briefing.
 *
 * Fase 1 (v1): apenas `commercial` está plugado à Application Layer.
 * As demais fontes existem como placeholders — quando o Use Case
 * correspondente for exposto, basta virar o flag `available=true`.
 */
import type { BriefingSourceDescriptor, BriefingSourceId } from "./contracts";

export const BRIEFING_SOURCE_REGISTRY: Readonly<
  Record<BriefingSourceId, BriefingSourceDescriptor>
> = Object.freeze({
  commercial: {
    id: "commercial",
    label: "Dashboard Comercial",
    useCase: "GetCommercialDashboard",
    available: true,
  },
  financial: {
    id: "financial",
    label: "Dashboard Financeiro",
    useCase: "GetFinancialDashboard",
    available: false,
  },
  inventory: {
    id: "inventory",
    label: "Dashboard de Estoque",
    useCase: "GetInventoryDashboard",
    available: false,
  },
  sales: {
    id: "sales",
    label: "Dashboard de Vendas",
    useCase: "GetSalesDashboard",
    available: false,
  },
  purchases: {
    id: "purchases",
    label: "Dashboard de Compras",
    useCase: "GetPurchasesDashboard",
    available: false,
  },
});

/** Sugestões fixas exibidas ao final do briefing. */
export const BRIEFING_SUGGESTED_QUESTIONS = Object.freeze([
  "Quais produtos reajustar?",
  "Mostrar contas vencendo",
  "Abrir Dashboard Comercial",
  "Simular preço",
]);
