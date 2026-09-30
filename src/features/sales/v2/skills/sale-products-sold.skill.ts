/**
 * Skill: sale.products_sold
 * "Quantos perfumes vendi esse mês?" — unidades vendidas por nome/categoria
 * no período + sugestão de reposição pelo giro de 60 dias.
 */
import { z } from "zod";
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import {
  buildProductsSoldMessage,
  resolveSoldPeriod,
  type ProductSoldRow,
} from "../lib/products-sold";

export const saleProductsSoldSchema = z
  .object({
    term: z.string().trim().min(2).max(80),
    period: z.enum(["this_month", "last_month", "last_30_days"]).optional(),
  })
  .strict();

export const saleProductsSoldSkill = defineBaseSkill({
  id: "sale.products_sold",
  name: "Produtos vendidos no período",
  module: "sales",
  description:
    "Quantas unidades de um produto ou categoria foram vendidas no período, com estoque e sugestão de reposição.",
  schema: saleProductsSoldSchema,
  requiredPermissions: ["sales.view"],
  destructive: false,
  async handler(input, ctx) {
        const period = resolveSoldPeriod(input.period ?? "this_month");
    let data: unknown[];
    try {
      // Import dinâmico: o repositório é só de servidor (cliente admin).
      const { fetchProductsSoldSummary } = await import(
        "../repository/products-sold.repository.server"
      );
      data = await fetchProductsSoldSummary({
        companyId: ctx.companyId,
        term: input.term,
        start: period.start,
        end: period.end,
      });
    } catch (err) {
      return skillResult.error(
        `Não consegui consultar as vendas: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      );
    }
    const rows = ((data ?? []) as ProductSoldRow[]).map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
      stock: Number(r.stock),
      sold_60d: Number(r.sold_60d),
      suggested_qty: Number(r.suggested_qty),
    }));
    return skillResult.success(buildProductsSoldMessage(input.term, period.label, rows), {
      rows,
      period,
    });
  },
});
