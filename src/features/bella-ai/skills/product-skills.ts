/**
 * Skills do módulo Produtos e Estoque.
 * Reutilizam productsService e inventoryService.
 */

import { productsService } from "@/features/products/services/products.service";
import { inventoryService } from "@/features/inventory/services/inventory.service";
import type { BellaSkill, BellaSkillMissingField } from "./types";
import { skillResult } from "./types";

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(
      v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."),
    );
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const createProductSkill: BellaSkill = {
  id: "product.create",
  name: "Criar produto",
  module: "sales",
  description: "Cadastra um novo produto.",
  requiresConfirmation: true,
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) => {
    const missing: BellaSkillMissingField[] = [];
    if (!asString(payload.name))
      missing.push({ field: "name", label: "Nome do produto", type: "text", required: true });
    const price = asNumber(payload.price);
    if (price === null || price < 0)
      missing.push({ field: "price", label: "Preço de venda (R$)", type: "money", required: true });
    return missing;
  },
  confirmationSummary: (payload) => {
    const name = asString((payload as Record<string, unknown>).name) ?? "produto";
    return `Confirma o cadastro do produto ${name}?`;
  },
  async execute(payload, ctx) {
    const name = asString(payload.name);
    const price = asNumber(payload.price);
    const missing: BellaSkillMissingField[] = [];
    if (!name) missing.push({ field: "name", label: "Nome do produto", type: "text", required: true });
    if (price === null || price < 0)
      missing.push({ field: "price", label: "Preço de venda (R$)", type: "money", required: true });
    if (missing.length) return skillResult.missing("Informe os dados do produto.", missing);

    const cost = asNumber(payload.cost) ?? 0;
    const stock = asNumber(payload.stock) ?? 0;

    const product = await productsService.create({
      company_id: ctx.companyId,
      name: name!,
      price: price!,
      cost,
      stock,
      sku: asString(payload.sku),
      unit: asString(payload.unit) ?? "un",
      status: "active",
      category_id: asString(payload.categoryId),
      supplier_id: asString(payload.supplierId),
      description: asString(payload.description),
    });

    return skillResult.success(
      `Produto "${name}" cadastrado.`,
      product,
      [{ id: "open_products", title: "Abrir Produtos", actionLabel: "Ver" }],
    );
  },
};

export const updateStockSkill: BellaSkill = {
  id: "product.update_stock",
  name: "Ajustar estoque",
  module: "sales",
  description: "Registra uma movimentação de estoque (entrada, saída ou ajuste).",
  requiresConfirmation: true,
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) => {
    const missing: BellaSkillMissingField[] = [];
    if (!asString(payload.productId))
      missing.push({ field: "productId", label: "Produto (ID)", type: "uuid", required: true });
    const qty = asNumber(payload.quantity);
    if (qty === null || qty <= 0)
      missing.push({ field: "quantity", label: "Quantidade", type: "number", required: true });
    const type = asString(payload.type);
    if (!type || !["in", "out", "adjustment"].includes(type))
      missing.push({
        field: "type",
        label: "Tipo de movimento",
        type: "enum",
        required: true,
        options: ["in", "out", "adjustment"],
      });
    return missing;
  },
  confirmationSummary: (payload) => {
    const qty = asNumber((payload as Record<string, unknown>).quantity) ?? 0;
    const type = asString((payload as Record<string, unknown>).type) ?? "movimento";
    return `Confirma ${type} de ${qty} unidade(s) no estoque?`;
  },
  async execute(payload, ctx) {
    const productId = asString(payload.productId);
    const qty = asNumber(payload.quantity);
    const type = asString(payload.type) as "in" | "out" | "adjustment" | null;
    if (!productId || !qty || !type) {
      return skillResult.missing("Informe produto, quantidade e tipo.", [
        { field: "productId", label: "Produto (ID)", type: "uuid", required: true },
        { field: "quantity", label: "Quantidade", type: "number", required: true },
        {
          field: "type",
          label: "Tipo",
          type: "enum",
          required: true,
          options: ["in", "out", "adjustment"],
        },
      ]);
    }

    const movement = await inventoryService.create({
      company_id: ctx.companyId,
      product_id: productId,
      quantity: qty,
      type,
      source: "manual",
      reason: asString(payload.reason) ?? "Ajuste via Bella IA",
      notes: asString(payload.notes),
      user_id: ctx.userId ?? null,
      movement_date: new Date().toISOString(),
    });

    return skillResult.success(`Estoque atualizado (${type}: ${qty}).`, movement);
  },
};

export const findProductSkill: BellaSkill = {
  id: "product.find",
  name: "Localizar produto",
  module: "sales",
  description: "Busca produtos por nome ou SKU.",
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) =>
    asString(payload.query)
      ? []
      : [{ field: "query", label: "Nome ou SKU", type: "text", required: true }],
  async execute(payload, ctx) {
    const query = asString(payload.query);
    if (!query) {
      return skillResult.missing("Qual produto quer localizar?", [
        { field: "query", label: "Nome ou SKU", type: "text", required: true },
      ]);
    }

    const { rows } = await productsService.list(ctx.companyId, {
      search: query,
      categoryId: "",
      supplierId: "",
      status: "active",
      stock: "in_stock",
      sortBy: "name",
      sortDir: "asc",
      page: 1,
      pageSize: 5,
    });

    if (rows.length === 0) {
      return skillResult.success(`Nenhum produto encontrado para "${query}".`, { rows });
    }
    const preview = rows
      .slice(0, 3)
      .map((r) => `• ${r.name}${r.sku ? ` (${r.sku})` : ""} — estoque ${r.stock ?? 0}`)
      .join("\n");
    return skillResult.success(
      `Encontrei ${rows.length} produto(s) para "${query}":\n${preview}`,
      { rows },
      [{ id: "open_products", title: "Abrir Produtos", actionLabel: "Ver" }],
    );
  },
};

export const productSkills: BellaSkill[] = [
  createProductSkill,
  updateStockSkill,
  findProductSkill,
];
