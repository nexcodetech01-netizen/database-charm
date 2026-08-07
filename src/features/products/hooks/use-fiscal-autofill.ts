/**
 * Automação de preenchimento fiscal (NCM/CEST) no cadastro de produtos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";
import {
  fiscalSuggestionService,
  normalizeCest,
  normalizeNcm,
  type FiscalHistorySuggestion,
} from "../lib/fiscal-suggestions";
import { ncmMasterService, type NcmMasterEntry } from "../lib/ncm-master";

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
  cest: string | null;
  /** Aplica os valores no formulário. */
  onApply: (values: { ncm: string; cest: string | null }) => void;
}

export interface FiscalAutofillState {
  source: FiscalSource;
  categorySuggestion: { ncm: string; cest: string | null; categoryName: string } | null;
  historySuggestions: FiscalHistorySuggestion[];
  masterSuggestions: NcmMasterEntry[];
  historyLoading: boolean;
  masterLoading: boolean;
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
  const [source, setSource] = useState<FiscalSource>(ncm ? "manual" : "category");
  const [isCheckingMaster, setIsCheckingMaster] = useState(false);
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

  const lastCategoryRef = useRef<string | null>(null);
  const lastMaterialRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkMasterNcm() {
      if (!category) return;
      if (lastCategoryRef.current === categoryId && lastMaterialRef.current === material) return;
      
      lastCategoryRef.current = categoryId;
      lastMaterialRef.current = material || null;
      setIsCheckingMaster(true);

      try {
        const masterSuggestion = await ncmMasterService.suggest(category.name, material);
        
        const targetNcm = masterSuggestion?.ncm || categorySuggestion?.ncm;
        const targetCest = categorySuggestion?.cest || cest;

        if (!targetNcm) {
          if (!ncm && categoryId) {
            toast.info("Nenhuma sugestão automática para esta categoria.", {
              description: "Selecione uma categoria diferente ou preencha o NCM manualmente.",
              duration: 4000,
            });
          }
          return;
        }

        const canOverwrite = !ncm || sourceRef.current === "category";
        if (!canOverwrite) return;
        if (ncm === targetNcm && cest === targetCest) return;

        setSource("category");
        onApply({ ncm: targetNcm, cest: targetCest });
        
        if (masterSuggestion) {
          toast.success(`NCM sugerido: ${targetNcm}`, {
            description: `Baseado na categoria "${category.name}"${material ? ` e material "${material}"` : ""}.`,
          });
        }
      } catch (error) {
        console.error("[useFiscalAutofill] Master lookup error:", error);
      } finally {
        setIsCheckingMaster(false);
      }
    }

    checkMasterNcm();
  }, [categoryId, material, category, categorySuggestion, ncm, cest, onApply]);

  const debouncedName = useDebouncedValue(name.trim(), 450);
  
  // 2) Histórico inteligente
  const { data: historySuggestions = [], isFetching: historyLoading } = useQuery({
    queryKey: ["products", "fiscal-suggestions", companyId, debouncedName],
    queryFn: () => fiscalSuggestionService.byName(companyId, debouncedName),
    // Reduzido para 2 caracteres conforme pedido ("mesmo com produto tendo menos de 3 letras")
    enabled: Boolean(companyId) && debouncedName.length >= 2,
    staleTime: 60_000,
  });

  // 3) Busca na Tabela Mestre por termo (fallback quando não tem categoria ou histórico fraco)
  const { data: masterSuggestions = [], isFetching: isSearchingMaster } = useQuery({
    queryKey: ["products", "ncm-master-search", debouncedName],
    queryFn: () => ncmMasterService.search(debouncedName),
    enabled: debouncedName.length >= 3,
    staleTime: 60_000,
  });

  const applySuggestion = useCallback(
    (values: { ncm: string; cest?: string | null }, nextSource: FiscalSource) => {
      setSource(nextSource);
      onApply({
        ncm: normalizeNcm(values.ncm),
        cest: values.cest ? normalizeCest(values.cest) : cest,
      });
      toast.success("Sugestão fiscal aplicada!");
    },
    [onApply, cest],
  );

  const markManual = useCallback(() => setSource("manual"), []);

  return {
    source,
    categorySuggestion,
    historySuggestions,
    masterSuggestions,
    historyLoading,
    masterLoading: isCheckingMaster || isSearchingMaster,
    applySuggestion,
    markManual,
  };
}
