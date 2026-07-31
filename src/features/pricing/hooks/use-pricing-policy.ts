/**
 * Persistência local (por empresa) da Política de Preços — MVP.
 * Estratégia: localStorage. Migração futura para uma tabela dedicada
 * (`pricing_policies`) sem alterar o consumo (mesma API do hook).
 */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_POLICY, type PricingPolicy } from "../types";

const key = (companyId: string) => `nexos:pricing-policy:${companyId}`;

function read(companyId: string): PricingPolicy {
  if (typeof window === "undefined") return DEFAULT_POLICY;
  try {
    const raw = window.localStorage.getItem(key(companyId));
    if (!raw) return DEFAULT_POLICY;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_POLICY, ...parsed } as PricingPolicy;
  } catch {
    return DEFAULT_POLICY;
  }
}

export function usePricingPolicy(companyId: string) {
  const [policy, setPolicyState] = useState<PricingPolicy>(() => read(companyId));

  useEffect(() => {
    setPolicyState(read(companyId));
  }, [companyId]);

  const setPolicy = useCallback(
    (next: PricingPolicy) => {
      setPolicyState(next);
      try {
        window.localStorage.setItem(key(companyId), JSON.stringify(next));
      } catch {
        // silencia — persistência falha não deve quebrar UI
      }
    },
    [companyId],
  );

  const reset = useCallback(() => setPolicy(DEFAULT_POLICY), [setPolicy]);

  return { policy, setPolicy, reset };
}
