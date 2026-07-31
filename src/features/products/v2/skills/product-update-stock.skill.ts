/**
 * Skill: product.update_stock (v2)
 * Registra uma movimentação de estoque (entrada/saída/ajuste) via motor
 * oficial `apply_inventory_movement`. Operação destrutiva → confirmação.
 */
import { z } from "zod";
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { ProductService } from "../service/product.service";

export const productUpdateStockSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    type: z.enum(["in", "out", "adjustment"]),
    reason: z.string().trim().max(240).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const productUpdateStockSkill = defineBaseSkill({
  id: "product.update_stock",
  name: "Ajustar estoque",
  module: "inventory",
  description: "Registra entrada, saída ou ajuste de estoque de um produto.",
  schema: productUpdateStockSchema,
  requiredPermissions: ["inventory.update"],
  destructive: true,
  confirmationSummary: (input) =>
    `Confirma ${input.type} de ${input.quantity} unidade(s)?`,
  async handler(input, ctx) {
    const svc = new ProductService(ctx);
    const mov = await svc.updateStock({
      productId: input.productId,
      quantity: input.quantity,
      type: input.type,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    });
    return skillResult.success(
      `Movimentação registrada (${input.type}: ${input.quantity}).`,
      mov,
    );
  },
});
