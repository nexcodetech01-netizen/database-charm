/**
 * Bella Summary
 *
 * Agrupa eventos ativos por módulo com contagens por severidade.
 * Puro — não consulta serviços nem banco.
 */

import type { BellaEvent, BellaEventModule } from "../events";
import type { BellaSummaryGroup } from "./types";

const MODULE_LABELS: Record<BellaEventModule, string> = {
  finance: "Financeiro",
  sales: "Vendas",
  customers: "Clientes",
  inventory: "Estoque",
  fiscal: "Fiscal",
};

const MODULE_ORDER: BellaEventModule[] = [
  "finance",
  "sales",
  "customers",
  "inventory",
  "fiscal",
];

export function buildSummary(events: BellaEvent[]): BellaSummaryGroup[] {
  const acc: Record<BellaEventModule, BellaSummaryGroup> = {
    finance: { module: "finance", label: MODULE_LABELS.finance, total: 0, critical: 0, warning: 0 },
    sales: { module: "sales", label: MODULE_LABELS.sales, total: 0, critical: 0, warning: 0 },
    customers: { module: "customers", label: MODULE_LABELS.customers, total: 0, critical: 0, warning: 0 },
    inventory: { module: "inventory", label: MODULE_LABELS.inventory, total: 0, critical: 0, warning: 0 },
    fiscal: { module: "fiscal", label: MODULE_LABELS.fiscal, total: 0, critical: 0, warning: 0 },
  };

  for (const event of events) {
    const group = acc[event.module];
    if (!group) continue;
    group.total += 1;
    if (event.severity === "critical") group.critical += 1;
    else if (event.severity === "warning") group.warning += 1;
  }

  return MODULE_ORDER.map((m) => acc[m]).filter((g) => g.total > 0);
}
