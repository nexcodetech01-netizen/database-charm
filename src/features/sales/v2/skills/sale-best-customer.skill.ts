/**
 * Skill: sale.best_customer (v2 — Sprint 005)
 * Ranking de clientes por receita no período.
 */
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { SalesOrderService } from "../service/sales-order.service";
import { saleBestCustomerSchema } from "../schemas";

export { saleBestCustomerSchema };

export const saleBestCustomerSkill = defineBaseSkill({
  id: "sale.best_customer",
  name: "Melhores clientes",
  module: "sales",
  description: "Ranking dos clientes por receita no período.",
  schema: saleBestCustomerSchema,
  requiredPermissions: ["reports.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new SalesOrderService(ctx);
    const rows = await svc.bestCustomers({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit: input.limit ?? 10,
    });
    if (rows.length === 0) {
      return skillResult.success("Nenhum cliente com vendas no período informado.", { rows: [] });
    }
    const preview = rows
      .slice(0, 5)
      .map(
        (r, i) =>
          `${i + 1}. ${r.customerName} — R$ ${r.totalRevenue.toFixed(2)} (${r.ordersCount} pedido${r.ordersCount > 1 ? "s" : ""})`,
      )
      .join("\n");
    return skillResult.success(
      `Top ${rows.length} cliente(s) por receita:\n${preview}`,
      { rows },
    );
  },
});
