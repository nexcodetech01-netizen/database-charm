/**
 * Sugestões fiscais (NCM/CEST) para o cadastro de produtos.
 *
 * Duas fontes, ambas somente-leitura e sempre editáveis pelo usuário:
 *  1. Categoria — `product_categories.default_ncm` / `default_cest`.
 *  2. Histórico — RPC `suggest_product_fiscal`, que agrupa NCMs de produtos
 *     já cadastrados com nome similar (trigram) na MESMA empresa.
 */

import { supabase } from "@/integrations/supabase/client";

export interface FiscalHistorySuggestion {
  ncm: string | null;
  cest: string | null;
  usageCount: number;
  similarity: number;
  sampleName: string;
}

/** Mantém apenas dígitos e corta no tamanho do código fiscal. */
export function normalizeNcm(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits.slice(0, 8) : null;
}

export function normalizeCest(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits.slice(0, 7) : null;
}

export function isValidNcm(value: string | null | undefined): boolean {
  return /^\d{8}$/.test(value ?? "");
}

export function isValidCest(value: string | null | undefined): boolean {
  return /^\d{7}$/.test(value ?? "");
}

/** Formata NCM para leitura: 6109.10.00 */
export function formatNcm(value: string | null | undefined): string {
  const digits = normalizeNcm(value);
  if (!digits || digits.length !== 8) return digits ?? "";
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
}

/** Formata CEST para leitura: 28.038.00 */
export function formatCest(value: string | null | undefined): string {
  const digits = normalizeCest(value);
  if (!digits || digits.length !== 7) return digits ?? "";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 7)}`;
}

export const fiscalSuggestionService = {
  /**
   * Busca no histórico da empresa os NCMs/CESTs usados em produtos com nome
   * parecido. Não executa nada com menos de 3 caracteres.
   */
  async byName(
    companyId: string,
    name: string,
    limit = 3,
  ): Promise<FiscalHistorySuggestion[]> {
    const term = name.trim();
    if (!companyId || term.length < 2) return [];

    const { data, error } = await supabase.rpc("suggest_product_fiscal", {
      _company_id: companyId,
      _name: term,
      _limit: limit,
    });
    if (error) throw error;

    return (data ?? [])
      .filter((row) => Boolean(row.ncm))
      .map((row) => ({
        ncm: normalizeNcm(row.ncm),
        cest: row.cest ? normalizeCest(row.cest) : null,
        usageCount: Number(row.usage_count ?? 0),
        similarity: Number(row.similarity ?? 0),
        sampleName: row.sample_name ?? "",
      }));
  },

  /** Sugestão fiscal a partir de um código de barras já cadastrado internamente. */
  async byBarcode(
    companyId: string,
    barcode: string,
  ): Promise<FiscalHistorySuggestion | null> {
    const code = barcode.trim();
    if (!companyId || code.length < 8) return null;

    const { data, error } = await supabase
      .from("products")
      .select("name, ncm, cest")
      .eq("company_id", companyId)
      .eq("barcode", code)
      .not("ncm", "is", null)
      .neq("ncm", "")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.ncm) return null;

    return {
      ncm: normalizeNcm(data.ncm),
      cest: data.cest ? normalizeCest(data.cest) : null,
      usageCount: 1,
      similarity: 1,
      sampleName: data.name,
    };
  },
};
