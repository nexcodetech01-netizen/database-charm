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
    const { data, error } = await (ctx.supabase.rpc as any)("products_sold_summary", {
      _company_id: ctx.companyId,
      _term: input.term,
      _start: period.start,
      _end: period.end,
    });
    if (error) {
      return skillResult.error(`Não consegui consultar as vendas: ${error.message}`);
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
