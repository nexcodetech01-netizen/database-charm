/**
 * Skill: sale.create (v2 — Sprint 005)
 * Cria um pedido de venda (draft/orçamento/aprovado/reservado/faturado).
 */
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { SalesOrderService } from "../service/sales-order.service";
import { saleCreateSchema } from "../schemas";
import type { SaleOrderSummary } from "../types";

export { saleCreateSchema };

export const saleCreateSkill = defineBaseSkill({
  id: "sale.create",
  name: "Criar venda",
  module: "sales",
  description: "Cria um pedido de venda (orçamento, aprovado, reservado ou faturado).",
  schema: saleCreateSchema,
  requiredPermissions: ["sales.create"],
  destructive: true,
  confirmationSummary: (input) =>
    `Confirma criação de pedido com ${input.items.length} item(ns)?`,
  async handler(input, ctx) {
    const svc = new SalesOrderService(ctx);
    const order = await svc.create({
      customerId: input.customerId ?? null,
      status: input.status ?? "draft",
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
      saleDate: input.saleDate ?? null,
    });
    return skillResult.success<SaleOrderSummary>(
      `Pedido #${order.number ?? "s/nº"} criado (total R$ ${order.grandTotal.toFixed(2)}).`,
      order,
      [{ id: "open_sales", title: "Abrir Vendas", actionLabel: "Ver" }],
    );
  },
});
