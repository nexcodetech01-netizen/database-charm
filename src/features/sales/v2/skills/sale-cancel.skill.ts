/**
 * Skill: sale.cancel (v2 — Sprint 005)
 * Cancela um pedido via RPC oficial `cancel_sale` (nunca UPDATE direto).
 */
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { SalesOrderService } from "../service/sales-order.service";
import { saleCancelSchema } from "../schemas";

export { saleCancelSchema };

export const saleCancelSkill = defineBaseSkill({
  id: "sale.cancel",
  name: "Cancelar venda",
  module: "sales",
  description: "Cancela um pedido existente e reverte impactos financeiros/estoque.",
  schema: saleCancelSchema,
  requiredPermissions: ["sales.delete"],
  destructive: true,
  confirmationSummary: (input) =>
    `Confirma o cancelamento da venda ${input.saleId}? Esta ação reverte estoque e financeiro.`,
  async handler(input, ctx) {
    const svc = new SalesOrderService(ctx);
    const cancelled = await svc.cancel(input.saleId, input.reason ?? null);
    return skillResult.success(
      `Venda #${cancelled.number ?? "s/nº"} cancelada com sucesso.`,
      cancelled,
    );
  },
});
