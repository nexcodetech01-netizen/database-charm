/**
 * PDV-016 — Catálogo de taxas Bella Pay (UX-only).
 *
 * Reúne, num único ponto, as taxas por método de pagamento reutilizando o
 * que já está cadastrado:
 *  - Crédito (%): `bella_pay_config.credit_card_fee_percent`
 *  - Crédito (R$ fixa): `nexos.bella-pay.card-fixed-fee.<companyId>` (localStorage)
 *  - PIX / Débito: defaults comerciais com override opcional em localStorage
 *
 * Não altera banco, Application Layer, services ou webhook.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { readCardFixedFee } from "./card-fixed-fee";
import {
  CREDIT_CARD_MAX_INSTALLMENTS,
  SETTLEMENT_DAYS_CREDIT,
  SETTLEMENT_DAYS_PIX,
} from "./credit-card-fee";
import { useBellaPayConfig } from "../hooks/use-bella-pay";

export type BellaFeeMethod =
  | "pix"
  | "cash"
  | "debit_card"
  | "credit_card"
  | "payment_link";

export interface BellaFeeSnapshot {
  method: BellaFeeMethod;
  label: string;
  percent: number;
  fixed: number;
  /** Prazo de recebimento (dias). */
  settlementDays: number;
  /** Descrição amigável para exibição (ex.: "PIX — R$ 1,99"). */
  display: string;
}

export interface BellaFeeOverrides {
  pixFixed?: number;
  debitPercent?: number;
  debitFixed?: number;
}

// Defaults comerciais (Asaas / referência de mercado).
export const DEFAULT_PIX_FIXED = 1.99 as const;
export const DEFAULT_DEBIT_PERCENT = 1.89 as const;
export const DEFAULT_DEBIT_FIXED = 0.35 as const;

const OVERRIDES_EVENT = "nexos:bella-fee-overrides-changed";
const overridesKey = (companyId: string) =>
  `nexos.bella-pay.fee-overrides.${companyId}`;

export function readFeeOverrides(companyId: string): BellaFeeOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(overridesKey(companyId));
    return raw ? (JSON.parse(raw) as BellaFeeOverrides) : {};
  } catch {
    return {};
  }
}

export function writeFeeOverrides(
  companyId: string,
  overrides: BellaFeeOverrides,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(overridesKey(companyId), JSON.stringify(overrides));
    window.dispatchEvent(
      new CustomEvent(OVERRIDES_EVENT, { detail: { companyId, overrides } }),
    );
  } catch {
    /* noop */
  }
}

function useFeeOverrides(companyId: string): BellaFeeOverrides {
  const [value, setValue] = useState<BellaFeeOverrides>(() =>
    readFeeOverrides(companyId),
  );
  useEffect(() => {
    setValue(readFeeOverrides(companyId));
    function onChange(e: Event) {
      const d = (e as CustomEvent<{ companyId: string; overrides: BellaFeeOverrides }>)
        .detail;
      if (d?.companyId === companyId) setValue(d.overrides);
    }
    window.addEventListener(OVERRIDES_EVENT, onChange);
    return () => window.removeEventListener(OVERRIDES_EVENT, onChange);
  }, [companyId]);
  return value;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

function formatFee(percent: number, fixed: number): string {
  if (percent <= 0 && fixed <= 0) return "sem taxa";
  if (percent <= 0) return formatBRL(fixed);
  if (fixed <= 0) return `${percent.toFixed(2).replace(".", ",")}%`;
  return `${percent.toFixed(2).replace(".", ",")}% + ${formatBRL(fixed)}`;
}

/**
 * Retorna o snapshot completo de taxas por método de pagamento para a
 * empresa, reutilizando bella_pay_config e localStorage.
 */
export function useBellaFeeCatalog(companyId: string): {
  snapshots: BellaFeeSnapshot[];
  creditByInstallment: BellaFeeSnapshot[];
  overrides: BellaFeeOverrides;
  saveOverrides: (o: BellaFeeOverrides) => void;
  ready: boolean;
} {
  const { data: config, isLoading } = useBellaPayConfig(companyId);
  const overrides = useFeeOverrides(companyId);

  const [cardFixed, setCardFixed] = useState<number>(() =>
    readCardFixedFee(companyId),
  );
  useEffect(() => {
    setCardFixed(readCardFixedFee(companyId));
    function onChange(e: Event) {
      const d = (e as CustomEvent<{ companyId: string; value: number }>).detail;
      if (d?.companyId === companyId) setCardFixed(d.value);
    }
    window.addEventListener("nexos:card-fixed-fee-changed", onChange);
    return () =>
      window.removeEventListener("nexos:card-fixed-fee-changed", onChange);
  }, [companyId]);

  const saveOverrides = useCallback(
    (o: BellaFeeOverrides) => writeFeeOverrides(companyId, o),
    [companyId],
  );

  const snapshots = useMemo<BellaFeeSnapshot[]>(() => {
    const pixFixed = overrides.pixFixed ?? DEFAULT_PIX_FIXED;
    const debitPct = overrides.debitPercent ?? DEFAULT_DEBIT_PERCENT;
    const debitFixed = overrides.debitFixed ?? DEFAULT_DEBIT_FIXED;
    const creditPct = Number(config?.credit_card_fee_percent ?? 0);

    return [
      {
        method: "pix",
        label: "PIX",
        percent: 0,
        fixed: pixFixed,
        settlementDays: SETTLEMENT_DAYS_PIX,
        display: `PIX — ${formatFee(0, pixFixed)}`,
      },
      {
        method: "cash",
        label: "Dinheiro",
        percent: 0,
        fixed: 0,
        settlementDays: 0,
        display: "Dinheiro — sem taxa",
      },
      {
        method: "debit_card",
        label: "Débito",
        percent: debitPct,
        fixed: debitFixed,
        settlementDays: 1,
        display: `Débito — ${formatFee(debitPct, debitFixed)}`,
      },
      {
        method: "credit_card",
        label: "Crédito",
        percent: creditPct,
        fixed: cardFixed,
        settlementDays: SETTLEMENT_DAYS_CREDIT,
        display: `Crédito — ${formatFee(creditPct, cardFixed)}`,
      },
      {
        method: "payment_link",
        label: "Link de pagamento",
        percent: creditPct,
        fixed: cardFixed,
        settlementDays: SETTLEMENT_DAYS_CREDIT,
        display: `Link — ${formatFee(creditPct, cardFixed)}`,
      },
    ];
  }, [config, cardFixed, overrides]);

  const creditByInstallment = useMemo<BellaFeeSnapshot[]>(() => {
    const creditPct = Number(config?.credit_card_fee_percent ?? 0);
    const list: BellaFeeSnapshot[] = [];
    for (let i = 1; i <= CREDIT_CARD_MAX_INSTALLMENTS; i++) {
      // Sem escalonamento no config atual — respeita o percentual único.
      list.push({
        method: "credit_card",
        label: `Crédito ${i}x`,
        percent: creditPct,
        fixed: cardFixed,
        settlementDays: SETTLEMENT_DAYS_CREDIT,
        display: `Crédito ${i}x — ${formatFee(creditPct, cardFixed)}`,
      });
    }
    return list;
  }, [config, cardFixed]);

  return {
    snapshots,
    creditByInstallment,
    overrides,
    saveOverrides,
    ready: !isLoading,
  };
}

/**
 * Estima a taxa (em R$) para um valor bruto em uma forma de pagamento.
 * Usada pela recomendação da Bella. Não substitui `computeCreditCardCharge`.
 */
export function estimateFeeAmount(
  snapshot: BellaFeeSnapshot,
  amount: number,
): number {
  if (amount <= 0) return 0;
  return Math.round((amount * snapshot.percent) / 100 * 100) / 100 + snapshot.fixed;
}

export function formatFeeSnapshot(s: BellaFeeSnapshot): string {
  return formatFee(s.percent, s.fixed);
}
