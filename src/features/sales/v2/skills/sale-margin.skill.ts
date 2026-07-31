/**
 * Skill: sale.margin (v2 — Sprint 005)
 * Analisa margem — de uma venda específica ou de um período.
 */
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { SalesOrderService } from "../service/sales-order.service";
import { saleMarginSchema } from "../schemas";

export { saleMarginSchema };

export const saleMarginSkill = defineBaseSkill({
  id: "sale.margin",
  name: "Analisar margem",
  module: "sales",
  description: "Calcula receita, custo, lucro e margem % para uma venda ou período.",
  schema: saleMarginSchema,
  requiredPermissions: ["reports.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new SalesOrderService(ctx);
    const m = await svc.marginFor({
      saleId: input.saleId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
    if (m.itemsCount === 0) {
      return skillResult.success("Nenhum item de venda encontrado para o filtro informado.", m);
    }
    const marginLabel = m.marginPct != null ? `${m.marginPct.toFixed(2)}%` : "s/ custo";
    return skillResult.success(
      `Receita R$ ${m.totalRevenue.toFixed(2)} · Custo R$ ${m.totalCost.toFixed(2)} · Lucro R$ ${m.totalProfit.toFixed(2)} · Margem ${marginLabel}.`,
      m,
    );
  },
});
