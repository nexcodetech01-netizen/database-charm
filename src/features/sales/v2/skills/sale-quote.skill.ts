/**
 * Skill: sale.quote (v2 — Sprint 005)
 * Cria orçamento formal (status DB = draft; v2Status = quotation).
 */
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { SalesOrderService } from "../service/sales-order.service";
import { saleQuoteSchema } from "../schemas";

export { saleQuoteSchema };

export const saleQuoteSkill = defineBaseSkill({
  id: "sale.quote",
  name: "Criar orçamento",
  module: "sales",
  description: "Cria um orçamento formal (não confirma venda nem reserva estoque).",
  schema: saleQuoteSchema,
  requiredPermissions: ["sales.create"],
  destructive: false,
  confirmationSummary: (input) => `Gerar orçamento com ${input.items.length} item(ns)?`,
  async handler(input, ctx) {
    const svc = new SalesOrderService(ctx);
    const order = await svc.create({
      customerId: input.customerId ?? null,
      status: "quotation",
      items: input.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice ?? null,
        discount: it.discount ?? null,
        description: it.description ?? null,
      })),
      discount: input.discount ?? 0,
      shipping: input.shipping ?? 0,
      notes: input.notes ?? null,
    });
    return skillResult.success(
      `Orçamento criado (total R$ ${order.grandTotal.toFixed(2)}).`,
      order,
    );
  },
});
