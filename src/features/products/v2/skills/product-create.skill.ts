/**
 * Skill: product.create (v2)
 * Cria um novo produto respeitando RLS/RBAC.
 */
import { z } from "zod";
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { ProductService } from "../service/product.service";
import type { Product } from "../../types";

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    price: z.number().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
    sku: z.string().trim().max(64).optional(),
    unit: z.string().trim().max(8).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    supplierId: z.string().uuid().nullable().optional(),
    description: z.string().trim().max(2000).optional(),
    minStock: z.number().nonnegative().optional(),
    barcode: z.string().trim().max(64).optional(),
  })
  .strict();

export const productCreateSkill = defineBaseSkill({
  id: "product.create",
  name: "Criar produto",
  module: "sales",
  description: "Cadastra um novo produto no catálogo.",
  schema: productCreateSchema,
  requiredPermissions: ["products.create"],
  destructive: false,
  confirmationSummary: (input) =>
    typeof input.price === "number"
      ? `Cadastrar produto "${input.name}" por R$ ${input.price.toFixed(2)}?`
      : `Cadastrar produto "${input.name}" (preço será calculado a partir do custo)?`,
  async handler(input, ctx) {
    const svc = new ProductService(ctx);
    const product = await svc.create({
      name: input.name,
      price: input.price ?? null,
      cost: input.cost ?? 0,
      sku: input.sku ?? null,
      unit: input.unit ?? "un",
      categoryId: input.categoryId ?? null,
      supplierId: input.supplierId ?? null,
      description: input.description ?? null,
      minStock: input.minStock ?? 0,
      barcode: input.barcode ?? null,
    });
    return skillResult.success<Product>(`Produto "${product.name}" cadastrado.`, product, [
      { id: "open_products", title: "Abrir Produtos", actionLabel: "Ver" },
    ]);
  },
});
