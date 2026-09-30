/**
 * Skill: sale.search (v2 — Sprint 005)
 * Lista pedidos de venda com filtros opcionais.
 */
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { SalesOrderService } from "../service/sales-order.service";
import { saleSearchSchema } from "../schemas";

export { saleSearchSchema };

const STATUS_PT: Record<string, string> = {
  draft: "rascunho",
  pending: "pendente",
  partially_paid: "parcialmente paga",
  paid: "paga",
  invoiced: "faturada",
  cancelled: "cancelada",
};

export const saleSearchSkill = defineBaseSkill({
  id: "sale.search",
  name: "Pesquisar vendas",
  module: "sales",
  description: "Lista pedidos com filtros (cliente, status, período, busca livre).",
  schema: saleSearchSchema,
  requiredPermissions: ["sales.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new SalesOrderService(ctx);
    const rows = await svc.list({
      query: input.query,
      customerId: input.customerId,
      status: input.status,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit: input.limit ?? 20,
    });
        // Sem filtro de status explícito, canceladas não entram na lista.
    const visible = input.status ? rows : rows.filter((r) => r.status !== "cancelled");
    if (visible.length === 0) {
      return skillResult.success("Nenhum pedido encontrado com os filtros informados.", {
        rows: [],
      });
    }
        const preview = visible
      .slice(0, 5)
      .map(
        (r) =>
          `• ${r.number ?? "s/nº"} — ${r.customerName ?? "sem cliente"} — ${r.grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${STATUS_PT[r.status] ?? r.status})`,
      )
      .join("\n");
    const more = visible.length > 5 ? `\n…e mais ${visible.length - 5}.` : "";
    return skillResult.success(
      `${visible.length} venda(s) encontrada(s):\n${preview}${more}`,
      { rows: visible },
    );
  },
});
