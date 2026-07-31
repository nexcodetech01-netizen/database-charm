/**
 * Skill: product.update_price (v2)
 * Ajusta preço de venda de um produto (operação destrutiva → confirmação).
 */
import { z } from "zod";
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { ProductService } from "../service/product.service";

export const productUpdatePriceSchema = z
  .object({
    productId: z.string().uuid(),
    price: z.number().nonnegative(),
  })
  .strict();

export const productUpdatePriceSkill = defineBaseSkill({
  id: "product.update_price",
  name: "Atualizar preço",
  module: "sales",
  description: "Ajusta o preço de venda de um produto.",
  schema: productUpdatePriceSchema,
  requiredPermissions: ["products.update"],
  destructive: true,
  confirmationSummary: (input) =>
    `Confirmar novo preço R$ ${input.price.toFixed(2)} para o produto ${input.productId}?`,
  async handler(input, ctx) {
    const svc = new ProductService(ctx);
    const product = await svc.updatePrice({
      productId: input.productId,
      price: input.price,
    });
    return skillResult.success(
      `Preço atualizado para R$ ${product.price?.toFixed?.(2) ?? product.price}.`,
      product,
    );
  },
});
