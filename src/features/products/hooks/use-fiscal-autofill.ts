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
  const [masterLoading, setMasterLoading] = useState(false);
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
      setMasterLoading(true);

      try {
        const masterSuggestion = await ncmMasterService.suggest(category.name, material);
        
        const targetNcm = masterSuggestion?.ncm || categorySuggestion?.ncm;
        const targetCest = categorySuggestion?.cest || cest;

        if (!targetNcm) {
          // Apenas avisa se não houver NENHUMA sugestão (nem categoria nem mestre)
          if (!ncm) {
            toast.info("Nenhuma sugestão de NCM encontrada para esta categoria. Preencha manualmente ou revise a categoria.", {
              description: "A tabela mestre e o histórico ainda não possuem dados para este item.",
              duration: 5000,
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
        toast.error("Falha ao buscar sugestão de NCM na tabela mestre.");
      } finally {
        setMasterLoading(false);
      }
    }

    checkMasterNcm();
  }, [categoryId, material, category, categorySuggestion, ncm, cest, onApply]);

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
      toast.success("Sugestão fiscal aplicada!");
    },
    [onApply, cest],
  );

  const markManual = useCallback(() => setSource("manual"), []);

  return {
    source,
    categorySuggestion,
    historySuggestions,
    historyLoading,
    masterLoading,
    applySuggestion,
    markManual,
  };
}
