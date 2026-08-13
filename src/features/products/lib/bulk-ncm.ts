/**
 * Preenchimento automático em massa de NCM para produtos já cadastrados.
 *
 * Fontes de sugestão (nesta ordem, sempre dentro da MESMA empresa):
 *  1. Histórico — RPC `suggest_product_fiscal` (similaridade trigram por nome),
 *     considerando apenas produtos que já possuem NCM preenchido.
 *  2. Categoria (fallback) — `product_categories.default_ncm` / `default_cest`,
 *     usado quando não há produto com nome similar.
 *
 * Regras de segurança:
 *  - Nunca sobrescreve um NCM existente. Só atua em produtos sem NCM.
 *  - CEST só é preenchido quando também está vazio.
 *  - Multi-tenant: todas as consultas filtram por `company_id` (RLS aplica).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  fiscalSuggestionService,
  isValidNcm,
  normalizeCest,
  normalizeNcm,
} from "./fiscal-suggestions";
import { ncmMasterService } from "./ncm-master";

/** NCM de segurança padrão para vestuário/acessórios quando houver indicação clara. */
const BIJUTERIA_FALLBACK_NCM = "71179000"; 
const BIJUTERIA_FALLBACK_LABEL = "Bijuteria (Sugestão)";

/** Similaridade mínima aceita para preencher a partir do histórico. */
const MIN_SIMILARITY = 0.35;
/** Chamadas simultâneas ao RPC de similaridade. */
const CONCURRENCY = 5;

export interface BulkNcmCandidate {
  id: string;
  name: string;
  sku: string | null;
  ncm: string | null;
  cest: string | null;
  source: "category" | "history" | "master_keyword" | "fallback";
  reference: string;
}

export interface BulkNcmScan {
  /** Total de produtos sem NCM encontrados. */
  pending: number;
  /** Produtos para os quais foi possível determinar um NCM. */
  candidates: BulkNcmCandidate[];
  /** Produtos sem NCM e sem sugestão possível. */
  unresolved: number;
}

export interface BulkNcmResult extends BulkNcmScan {
  updated: number;
  failed: number;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  cest: string | null;
  category_id: string | null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export const bulkNcmService = {
  /**
   * Varre os produtos sem NCM e calcula as sugestões, sem gravar nada.
   */
  async scan(
    companyId: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<BulkNcmScan> {
    if (!companyId) return { pending: 0, candidates: [], unresolved: 0 };

    const [{ data: productsData, error: productsError }, { data: categoriesData, error: categoriesError }] =
      await Promise.all([
        supabase
          .from("products")
          .select("id, name, sku, cest, category_id")
          .eq("company_id", companyId)
          .or("ncm.is.null")
          .order("name", { ascending: true })
          .limit(2000),
        supabase
          .from("product_categories")
          .select("id, name, default_ncm, default_cest")
          .eq("company_id", companyId),
      ]);

    if (productsError) throw productsError;
    if (categoriesError) throw categoriesError;

    const products = (productsData ?? []) as ProductRow[];
    const categories = new Map(
      (categoriesData ?? []).map((c) => [
        c.id,
        {
          name: c.name as string,
          ncm: normalizeNcm(c.default_ncm as string | null),
          cest: normalizeCest(c.default_cest as string | null),
        },
      ]),
    );

    let done = 0;
    const total = products.length;
    onProgress?.(0, total);

    const resolved = await mapWithConcurrency(
      products,
      CONCURRENCY,
      async (product): Promise<BulkNcmCandidate | null> => {
        try {
          // 1) Histórico por similaridade de nome
          const suggestions = await fiscalSuggestionService.byName(companyId, product.name, 1);
          const best = suggestions[0];
          if (best && isValidNcm(best.ncm) && best.similarity >= MIN_SIMILARITY) {
            return {
              id: product.id,
              name: product.name,
              sku: product.sku,
              ncm: best.ncm,
              cest: normalizeCest(product.cest) ? null : best.cest,
              source: "history",
              reference: best.sampleName,
            };
          }

          // 2) Fallback: herda o NCM padrão da categoria vinculada
          const category = product.category_id ? categories.get(product.category_id) : undefined;
          if (category && isValidNcm(category.ncm)) {
            return {
              id: product.id,
              name: product.name,
              sku: product.sku,
              ncm: category.ncm,
              cest: normalizeCest(product.cest) ? null : category.cest || null,
              source: "category",
              reference: category.name,
            };
          }

          // 3) Fallback Inteligente: Busca por palavra-chave no Nome do Produto
          const nameLower = product.name.toLowerCase();
          
          // Regras específicas por palavra-chave (Prioridade 1)
          const specificRules = [
            { 
              keywords: ["perfume", "body splash", "colônia", "colonia", "fragrância"], 
              ncm: "33072010", 
              label: "Perfumaria/Desodorante",
              ref: "Termo: Perfume/Body Splash" 
            },
            { 
              keywords: ["bolsa", "carteira", "mochila", "necessaire"], 
              ncm: "42022200", 
              label: "Bolsas/Plástico/Têxtil",
              ref: "Termo: Bolsa/Carteira" 
            },
            { 
              keywords: ["couro", "sintético"], 
              ncm: "42022100", 
              label: "Bolsas/Couro",
              ref: "Termo: Couro" 
            },
            { 
              keywords: ["brinco", "colar", "pulseira", "anel", "bijuteria"], 
              ncm: BIJUTERIA_FALLBACK_NCM, 
              label: "Bijuteria",
              ref: "Termo: Bijuteria" 
            }
          ];

          for (const rule of specificRules) {
            if (rule.keywords.some(k => nameLower.includes(k))) {
              return {
                id: product.id,
                name: product.name,
                sku: product.sku,
                ncm: rule.ncm,
                cest: null,
                source: "master_keyword",
                reference: rule.ref,
              };
            }
          }

          // 4) Se não encontrou nada, não aplica fallback genérico
          return null;
        } finally {
          done += 1;
          onProgress?.(done, total);
        }
      },
    );

    const candidates = resolved.filter((c): c is BulkNcmCandidate => c !== null);

    return {
      pending: products.length,
      candidates,
      unresolved: products.length - candidates.length,
    };
  },

  /**
   * Aplica as sugestões calculadas pelo `scan`. Cada update reforça o filtro de
   * empresa e a condição "ainda sem NCM" para evitar sobrescrita concorrente.
   */
  async apply(
    companyId: string,
    candidates: BulkNcmCandidate[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;
    let done = 0;

    await mapWithConcurrency(candidates, CONCURRENCY, async (candidate) => {
      const patch: { ncm: string | null; cest?: string | null } = { ncm: candidate.ncm };
      if (candidate.cest !== undefined) patch.cest = candidate.cest;

      const { error } = await supabase
        .from("products")
        .update(patch)
        .eq("id", candidate.id)
        .eq("company_id", companyId)
        .or("ncm.is.null");

      if (error) failed += 1;
      else updated += 1;

      done += 1;
      onProgress?.(done, candidates.length);
    });

    return { updated, failed };
  },

  /** Varre e aplica em uma única operação. */
  async run(
    companyId: string,
    onProgress?: (phase: "scan" | "apply", done: number, total: number) => void,
  ): Promise<BulkNcmResult> {
    const scan = await this.scan(companyId, (d, t) => onProgress?.("scan", d, t));
    const { updated, failed } = await this.apply(companyId, scan.candidates, (d, t) =>
      onProgress?.("apply", d, t),
    );
    return { ...scan, updated, failed };
  },
};
