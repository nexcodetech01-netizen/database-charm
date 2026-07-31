/**
 * Skill: product.search (v2)
 * Localiza produtos por nome/SKU/barcode com paginação.
 */
import { z } from "zod";
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { ProductService } from "../service/product.service";

export const productSearchSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    supplierId: z.string().uuid().nullable().optional(),
    status: z.enum(["active", "inactive", "draft"]).optional(),
    onlyActive: z.boolean().optional(),
    sortBy: z.enum(["name", "price", "stock", "created_at"]).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    page: z.number().int().positive().max(1000).optional(),
    pageSize: z.number().int().positive().max(100).optional(),
  })
  .strict();

export const productSearchSkill = defineBaseSkill({
  id: "product.search",
  name: "Localizar produto",
  module: "sales",
  description: "Busca produtos por nome, SKU ou código de barras.",
  schema: productSearchSchema,
  requiredPermissions: ["products.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new ProductService(ctx);
    const result = await svc.search({
      search: input.query,
      categoryId: input.categoryId ?? undefined,
      supplierId: input.supplierId ?? undefined,
      status: input.status,
      onlyActive: input.onlyActive,
      sortBy: input.sortBy,
      sortDir: input.sortDir,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 10,
    });
    if (result.rows.length === 0) {
      return skillResult.success(
        `Nenhum produto encontrado${input.query ? ` para "${input.query}"` : ""}.`,
        result,
      );
    }
    const preview = result.rows
      .slice(0, 3)
      .map((r) => `• ${r.name}${r.sku ? ` (${r.sku})` : ""} — estoque ${r.stock ?? 0}`)
      .join("\n");
    return skillResult.success(
      `${result.total} produto(s) encontrado(s):\n${preview}`,
      result,
      [{ id: "open_products", title: "Abrir Produtos", actionLabel: "Ver" }],
    );
  },
});
