/**
 * Automação de preenchimento fiscal (NCM/CEST) no cadastro de produtos.
 *
 * Regras:
 * - Sugestão por CATEGORIA: ao selecionar uma categoria com NCM padrão, o
 *   campo é preenchido automaticamente SOMENTE se estiver vazio ou se o valor
 *   atual tiver vindo de outra sugestão automática. Nunca sobrescreve algo
 *   digitado pelo usuário.
 * - Sugestão por HISTÓRICO: busca em tempo real (debounce) produtos com nome
 *   similar já cadastrados na empresa. Nunca preenche sozinho — é sempre uma
 *   sugestão que o usuário aplica com um clique.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  fiscalSuggestionService,
  normalizeCest,
  normalizeNcm,
  type FiscalHistorySuggestion,
} from "../lib/fiscal-suggestions";
import { ncmMasterService } from "../lib/ncm-master";

export type FiscalSource = "manual" | "category" | "history" | "barcode";

interface CategoryLike {
  id: string;
  name: string;
  default_ncm?: string | null;
  default_cest?: string | null;
}

interface Params {
  companyId: string;
  name: string;
  categoryId: string;
  material?: string | null;
  categories: CategoryLike[];
  ncm: string;
  cest: string;
  /** Aplica os valores no formulário. */
  onApply: (values: { ncm: string; cest: string }) => void;
}

export interface FiscalAutofillState {
  source: FiscalSource;
  categorySuggestion: { ncm: string; cest: string; categoryName: string } | null;
  historySuggestions: FiscalHistorySuggestion[];
  historyLoading: boolean;
  applySuggestion: (values: { ncm: string; cest?: string | null }, source: FiscalSource) => void;
  markManual: () => void;
}

export function useFiscalAutofill({
  companyId,
  name,
  categoryId,
  material,
  categories,
  ncm,
  cest,
  onApply,
}: Params): FiscalAutofillState {
  // Origem do valor atual — controla se a automação pode sobrescrever.
  const [source, setSource] = useState<FiscalSource>(ncm ? "manual" : "category");
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const categorySuggestion = useMemo(() => {
    const catNcm = normalizeNcm(category?.default_ncm);
    if (!category || !catNcm) return null;
    return {
      ncm: catNcm,
      cest: normalizeCest(category.default_cest),
      categoryName: category.name,
    };
  }, [category]);

  // 1) Sugestão por Categoria (Tabela Mestre e Padrão da Categoria)
  const lastCategoryRef = useRef<string | null>(null);
  const lastMaterialRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkMasterNcm() {
      if (!category) return;
      if (lastCategoryRef.current === categoryId && lastMaterialRef.current === material) return;
      lastCategoryRef.current = categoryId;
      lastMaterialRef.current = material || null;

      // Prioridade 1: Tabela Mestre (NCM Master)
      const masterSuggestion = await ncmMasterService.suggest(category.name, material);
      
      const targetNcm = masterSuggestion?.ncm || categorySuggestion?.ncm;
      const targetCest = categorySuggestion?.cest || cest;

      if (!targetNcm) return;

      const canOverwrite = !ncm || sourceRef.current === "category";
      if (!canOverwrite) return;
      if (ncm === targetNcm && cest === targetCest) return;

      setSource("category");
      onApply({ ncm: targetNcm, cest: targetCest });
    }

    checkMasterNcm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, material, category, categorySuggestion]);

  // 2) Histórico inteligente por similaridade de nome.
  const debouncedName = useDebouncedValue(name.trim(), 450);
  const { data: historySuggestions = [], isFetching: historyLoading } = useQuery({
    queryKey: ["products", "fiscal-suggestions", companyId, debouncedName],
    queryFn: () => fiscalSuggestionService.byName(companyId, debouncedName),
    enabled: Boolean(companyId) && debouncedName.length >= 3,
    staleTime: 60_000,
  });

  const applySuggestion = useCallback(
    (values: { ncm: string; cest?: string | null }, nextSource: FiscalSource) => {
      setSource(nextSource);
      onApply({
        ncm: normalizeNcm(values.ncm),
        cest: values.cest ? normalizeCest(values.cest) : cest,
      });
    },
    [onApply, cest],
  );

  const markManual = useCallback(() => setSource("manual"), []);

  return {
    source,
    categorySuggestion,
    historySuggestions,
    historyLoading,
    applySuggestion,
    markManual,
  };
}
