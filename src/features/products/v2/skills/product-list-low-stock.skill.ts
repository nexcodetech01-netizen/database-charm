/**
 * Skill: product.list_low_stock (v2)
 * Lista produtos ativos com estoque abaixo do mínimo configurado.
 */
import { z } from "zod";
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { ProductService } from "../service/product.service";

export const productListLowStockSchema = z
  .object({
    limit: z.number().int().positive().max(200).optional(),
  })
  .strict();

export const productListLowStockSkill = defineBaseSkill({
  id: "product.list_low_stock",
  name: "Produtos com estoque crítico",
  module: "inventory",
  description: "Retorna produtos ativos com estoque abaixo do mínimo.",
  schema: productListLowStockSchema,
  requiredPermissions: ["inventory.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new ProductService(ctx);
    const rows = await svc.listLowStock(input.limit ?? 20);
    if (rows.length === 0) {
      return skillResult.success("Nenhum produto com estoque crítico. 🎉", { rows });
    }
    const preview = rows
      .slice(0, 5)
      .map((r) => `• ${r.name} — ${r.stock ?? 0}/${r.min_stock ?? 0}`)
      .join("\n");
    return skillResult.success(
      `${rows.length} produto(s) com estoque abaixo do mínimo:\n${preview}`,
      { rows },
      [{ id: "open_inventory", title: "Abrir Estoque", actionLabel: "Ver" }],
    );
  },
});
