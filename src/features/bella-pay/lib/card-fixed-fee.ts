/**
 * PDV-014 — Taxa fixa de cartão por empresa.
 *
 * Persistida em localStorage (UX-only). Não altera banco, webhook, service
 * ou edge functions. Reutilizada por Config Panel e Checkout.
 */
import { useEffect, useState, useCallback } from "react";
import { CREDIT_CARD_DEFAULT_FIXED_FEE } from "./credit-card-fee";

function storageKey(companyId: string): string {
  return `nexos.bella-pay.card-fixed-fee.${companyId}`;
}

export function readCardFixedFee(companyId: string): number {
  if (typeof window === "undefined") return CREDIT_CARD_DEFAULT_FIXED_FEE;
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (raw == null) return CREDIT_CARD_DEFAULT_FIXED_FEE;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : CREDIT_CARD_DEFAULT_FIXED_FEE;
  } catch {
    return CREDIT_CARD_DEFAULT_FIXED_FEE;
  }
}

export function writeCardFixedFee(companyId: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(companyId), String(value));
    window.dispatchEvent(
      new CustomEvent("nexos:card-fixed-fee-changed", {
        detail: { companyId, value },
      }),
    );
  } catch {
    /* noop */
  }
}

export function useCardFixedFee(companyId: string): [number, (v: number) => void] {
  const [value, setValue] = useState<number>(() => readCardFixedFee(companyId));

  useEffect(() => {
    setValue(readCardFixedFee(companyId));
    function onChange(e: Event) {
      const detail = (e as CustomEvent<{ companyId: string; value: number }>).detail;
      if (detail?.companyId === companyId) setValue(detail.value);
    }
    window.addEventListener("nexos:card-fixed-fee-changed", onChange);
    return () =>
      window.removeEventListener("nexos:card-fixed-fee-changed", onChange);
  }, [companyId]);

  const update = useCallback(
    (v: number) => {
      writeCardFixedFee(companyId, v);
      setValue(v);
    },
    [companyId],
  );

  return [value, update];
}
