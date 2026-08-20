/**
 * Skills v2 do módulo Estoque (Sprint 003).
 *
 * Todas usam `defineBaseSkill` (Sprint 001.5): pipeline canônico
 * validate → permission → confirm → execute → audit → metrics.
 *
 * Toda mutação delega ao StockService (motor oficial
 * `apply_inventory_movement`). Zero UPDATE direto em `products.stock`.
 */
import { z } from "zod";
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { StockService } from "../service/stock.service";

/** Lookup unificado: uuid do produto OU busca por SKU/nome. */
const lookupShape = {
  productId: z.string().uuid().optional(),
  query: z.string().trim().min(1).max(200).optional(),
};

function ensureLookup(input: { productId?: string; query?: string }): void {
  if (!input.productId && !input.query) throw new Error("Informe productId ou query do produto.");
}

// ------------------------------ stock.add ------------------------------
export const stockAddSchema = z
  .object({
    ...lookupShape,
    quantity: z.number().positive(),
    reason: z.string().trim().max(240).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const stockAddSkill = defineBaseSkill({
  id: "stock.add",
  name: "Adicionar estoque",
  module: "inventory",
  description: "Registra ENTRADA no estoque de um produto.",
  // Refinamentos preservam .strict() do object base (usado pelo BaseSkill).
  schema: stockAddSchema,
  requiredPermissions: ["inventory.update"],
  destructive: true,
  confirmationSummary: (input) =>
    `Confirma entrada de ${input.quantity} unidade(s) para "${input.query ?? input.productId}"?`,
  async handler(input, ctx) {
    ensureLookup(input);
    const svc = new StockService(ctx);
    const mov = await svc.add({
      productId: input.productId ?? null,
      query: input.query ?? null,
      quantity: input.quantity,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    });
    return skillResult.success(`Entrada de ${input.quantity} unidade(s) registrada.`, mov);
  },
});

// ---------------------------- stock.remove -----------------------------
export const stockRemoveSchema = z
  .object({
    ...lookupShape,
    quantity: z.number().positive(),
    reason: z.string().trim().max(240).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const stockRemoveSkill = defineBaseSkill({
  id: "stock.remove",
  name: "Remover estoque",
  module: "inventory",
  description: "Registra SAÍDA no estoque de um produto.",
  schema: stockRemoveSchema,
  requiredPermissions: ["inventory.update"],
  destructive: true,
  confirmationSummary: (input) =>
    `Confirma saída de ${input.quantity} unidade(s) de "${input.query ?? input.productId}"?`,
  async handler(input, ctx) {
    ensureLookup(input);
    const svc = new StockService(ctx);
    const mov = await svc.remove({
      productId: input.productId ?? null,
      query: input.query ?? null,
      quantity: input.quantity,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    });
    return skillResult.success(`Saída de ${input.quantity} unidade(s) registrada.`, mov);
  },
});

// ---------------------------- stock.adjust -----------------------------
export const stockAdjustSchema = z
  .object({
    ...lookupShape,
    delta: z.number().refine((n) => n !== 0, {
      message: "Delta não pode ser zero.",
    }).optional(),
    absolute: z.number().min(0).optional(),
    reason: z.string().trim().max(240).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const stockAdjustSkill = defineBaseSkill({
  id: "stock.adjust",
  name: "Ajustar estoque",
  module: "inventory",
  description: "Ajusta o saldo de estoque (positivo = incrementa, negativo = decrementa).",
  schema: stockAdjustSchema,
  requiredPermissions: ["inventory.update"],
  destructive: true,
  confirmationSummary: (input) => {
    if (typeof input.absolute === "number") {
      return `Confirma definir o estoque para ${input.absolute} unidade(s) de "${input.query ?? input.productId}"?`;
    }
    return `Confirma ajuste de ${input.delta} unidade(s) para "${input.query ?? input.productId}"?`;
  },
  async handler(input, ctx) {
    ensureLookup(input);
    const svc = new StockService(ctx);

    let finalDelta = input.delta;

    // Se informou valor absoluto, calcula o delta
    if (typeof input.absolute === "number") {
      const balance = await svc.balance({
        productId: input.productId ?? null,
        query: input.query ?? null,
      });
      finalDelta = input.absolute - balance.stock;
      
      if (finalDelta === 0) {
        return skillResult.success(`O estoque de "${balance.product.name}" já é ${input.absolute}. Nenhuma alteração necessária.`);
      }
    }

    if (finalDelta === undefined || finalDelta === 0) {
      throw new Error("Informe um delta ou valor absoluto válido para o ajuste.");
    }

    const mov = await svc.adjust({
      productId: input.productId ?? null,
      query: input.query ?? null,
      delta: finalDelta,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    });

    const actionText = finalDelta > 0 ? "incrementado" : "reduzido";
    return skillResult.success(
      `Estoque ${actionText} em ${Math.abs(finalDelta)} unidade(s). Saldo atualizado com sucesso.`,
      mov,
    );
  },
});

// --------------------------- stock.history -----------------------------
export const stockHistorySchema = z
  .object({
    ...lookupShape,
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const stockHistorySkill = defineBaseSkill({
  id: "stock.history",
  name: "Histórico de estoque",
  module: "inventory",
  description: "Lista as últimas movimentações de estoque de um produto.",
  schema: stockHistorySchema,
  requiredPermissions: ["inventory.view"],
  destructive: false,
  async handler(input, ctx) {
    ensureLookup(input);
    const svc = new StockService(ctx);
    const rows = await svc.history({
      productId: input.productId ?? null,
      query: input.query ?? null,
      limit: input.limit ?? 20,
    });
    if (rows.length === 0) {
      return skillResult.success(
        `Sem movimentações registradas para "${input.query ?? input.productId}".`,
        { rows: [] },
      );
    }
    const preview = rows
      .slice(0, 5)
      .map((r) => `• ${r.type.toUpperCase()} ${r.quantity} — ${r.reason ?? r.source}`)
      .join("\n");
    return skillResult.success(`${rows.length} movimentação(ões) encontradas:\n${preview}`, {
      rows,
    });
  },
});

// ------------------------------ stock.low ------------------------------
export const stockLowSchema = z
  .object({
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const stockLowSkill = defineBaseSkill({
  id: "stock.low",
  name: "Estoque crítico",
  module: "inventory",
  description: "Lista produtos ativos com saldo abaixo do estoque mínimo.",
  schema: stockLowSchema,
  requiredPermissions: ["inventory.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new StockService(ctx);
    const rows = await svc.listLowStock(input.limit ?? 20);
    if (rows.length === 0) {
      return skillResult.success("Nenhum produto abaixo do estoque mínimo. 👍", { rows: [] });
    }
    const preview = rows
      .slice(0, 5)
      .map((r) => `• ${r.name} — ${r.stock} disponíveis / mín. ${r.min_stock}`)
      .join("\n");

    return skillResult.success(
      [
        `⚠️ Estoque crítico`,
        `${rows.length} produtos abaixo do mínimo.`,
        `\nPrincipais itens:`,
        preview,
        rows.length > 5 ? `\n... e outros ${rows.length - 5} itens.` : "",
        `\n💡 Posso preparar uma sugestão de compra.`
      ].filter(Boolean).join("\n"),
      { rows }
    );
  },
});

// ---------------------------- stock.balance ----------------------------
export const stockBalanceSchema = z.object({ ...lookupShape }).strict();

export const stockBalanceSkill = defineBaseSkill({
  id: "stock.balance",
  name: "Consultar saldo",
  module: "inventory",
  description: "Retorna o saldo atual e o mínimo cadastrado do produto.",
  schema: stockBalanceSchema,
  requiredPermissions: ["inventory.view"],
  destructive: false,
  async handler(input, ctx) {
    ensureLookup(input);
    const svc = new StockService(ctx);
    const b = await svc.balance({
      productId: input.productId ?? null,
      query: input.query ?? null,
    });
    const status = b.outOfStock ? "esgotado" : b.belowMin ? "abaixo do mínimo" : "ok";
    return skillResult.success(
      `${b.product.name}: ${b.stock} ${b.product.unit ?? "un"} (mín. ${b.minStock}) — ${status}.`,
      b,
    );
  },
});

// ---------------------- stock.purchase_suggestion ----------------------
export const stockPurchaseSuggestionSchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const stockPurchaseSuggestionSkill = defineBaseSkill({
  id: "stock.purchase_suggestion",
  name: "Sugestão de compra",
  module: "inventory",
  description: "Gera uma lista de itens para reposição com base no estoque mínimo.",
  schema: stockPurchaseSuggestionSchema,
  requiredPermissions: ["inventory.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new StockService(ctx);
    const rows = await svc.listLowStock(input.limit ?? 20);
    if (rows.length === 0) {
      return skillResult.success("Estoque saudável. Nenhuma sugestão de compra necessária.", {
        rows: [],
      } as any);
    }

    const suggestions = rows.map((r) => {
      const stock = Number(r.stock ?? 0);
      const min = Number(r.min_stock ?? 0);
      const buy = Math.max(min - stock + Math.ceil(min * 0.2), 1); // Repõe até o mínimo + 20%
      return { ...r, suggestedQuantity: buy };
    });

    const preview = suggestions
      .slice(0, 5)
      .map((s) => `• ${s.name} — comprar ${s.suggestedQuantity} un`)
      .join("\n");

    return skillResult.success(
      [`🛒 Sugestão de Compra`, preview, `\nDeseja criar o pedido de compra?`].join("\n"),
      { rows: suggestions } as any,
      [{ id: "create_purchase_order", title: "Criar Pedido", actionLabel: "Executar" }],
    );
  },
});

export const stockV2BaseSkills = [
  stockAddSkill,
  stockRemoveSkill,
  stockAdjustSkill,
  stockHistorySkill,
  stockLowSkill,
  stockBalanceSkill,
  stockPurchaseSuggestionSkill,
] as const;
