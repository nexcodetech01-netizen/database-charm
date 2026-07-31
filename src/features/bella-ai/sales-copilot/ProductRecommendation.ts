/**
 * ProductRecommendation — motor de sugestões que reutiliza EXCLUSIVAMENTE
 * a Skill `product.find` já registrada. Nenhuma consulta paralela ao
 * banco: se a Skill não existir, o motor retorna vazio silenciosamente
 * (opt-in real ao ecossistema de Skills).
 */

import { BellaSkillRegistry } from "../skills/registry";
import type { BellaSkillContext } from "../skills/types";
import type { SalesProductSuggestion } from "./types";

interface FindProductInput {
  query?: string;
  categoryId?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

interface RecommendationInput extends FindProductInput {
  reason: SalesProductSuggestion["reason"];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

async function runFind(
  ctx: BellaSkillContext,
  input: FindProductInput,
): Promise<Array<Record<string, unknown>>> {
  const skill = BellaSkillRegistry.get("product.find");
  if (!skill) return [];
  const result = await BellaSkillRegistry.execute("product.find", { ...input }, ctx);
  if (!result.ok) return [];
  const data = asRecord(result.data);
  const rows = Array.isArray(data.rows)
    ? (data.rows as Array<Record<string, unknown>>)
    : Array.isArray(result.data)
      ? (result.data as Array<Record<string, unknown>>)
      : [];
  return rows;
}

function toSuggestion(
  row: Record<string, unknown>,
  reason: SalesProductSuggestion["reason"],
): SalesProductSuggestion | null {
  const id = typeof row.id === "string" ? row.id : null;
  if (!id) return null;
  const label = typeof row.name === "string" ? row.name : id;
  const price = typeof row.price === "number" ? row.price : undefined;
  return { productId: id, label, reason, price };
}

export const ProductRecommendation = {
  async find(
    ctx: BellaSkillContext,
    { reason, ...input }: RecommendationInput,
  ): Promise<SalesProductSuggestion[]> {
    const rows = await runFind(ctx, input);
    return rows
      .map((r) => toSuggestion(r, reason))
      .filter((s): s is SalesProductSuggestion => Boolean(s));
  },

  similar(ctx: BellaSkillContext, query: string, limit = 5) {
    return this.find(ctx, { query, limit, reason: "similar" });
  },

  sameCategory(ctx: BellaSkillContext, categoryId: string, limit = 5) {
    return this.find(ctx, { categoryId, limit, reason: "same_category" });
  },

  sameBrand(ctx: BellaSkillContext, brand: string, limit = 5) {
    return this.find(ctx, { brand, limit, reason: "same_brand" });
  },

  priceRange(ctx: BellaSkillContext, min: number, max: number, limit = 5) {
    return this.find(ctx, {
      minPrice: min,
      maxPrice: max,
      limit,
      reason: "price_range",
    });
  },
};
