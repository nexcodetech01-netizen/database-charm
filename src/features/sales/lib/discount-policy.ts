/**
 * PDV-015 — Política Inteligente de Descontos.
 *
 * UX-only. Persiste em localStorage por empresa. Não altera Application
 * Layer, Services, Repositories, Banco, Triggers, Webhooks, Bella Pay,
 * Financeiro, Estoque ou Pricing Engine.
 *
 * Reutilizado por Configurações > Vendas > Política de Descontos e pelo
 * formulário de Vendas (PDV).
 */
import { useCallback, useEffect, useState } from "react";
import { isCashPaymentMethod } from "./payment-methods";

export type DiscountEnforcement = "block" | "request_manager" | "allow";

export interface DiscountPolicy {
  enabled: boolean;
  /** Percentual máximo permitido sobre o subtotal (ex.: 5 = 5%). */
  maxPercent: number;
  /** Formas de pagamento em que o desconto é habilitado. */
  allowedMethods: string[];
  /** O que fazer quando o operador informar acima do limite. */
  enforcement: DiscountEnforcement;
}

export const DEFAULT_DISCOUNT_POLICY: DiscountPolicy = {
  enabled: true,
  maxPercent: 5,
  allowedMethods: ["pix", "cash"],
  enforcement: "request_manager",
};

const EVENT = "nexos:discount-policy-changed";

function storageKey(companyId: string): string {
  return `nexos.sales.discount-policy.${companyId}`;
}

export function readDiscountPolicy(companyId: string): DiscountPolicy {
  if (typeof window === "undefined") return DEFAULT_DISCOUNT_POLICY;
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (!raw) return DEFAULT_DISCOUNT_POLICY;
    const parsed = JSON.parse(raw) as Partial<DiscountPolicy>;
    return {
      ...DEFAULT_DISCOUNT_POLICY,
      ...parsed,
      allowedMethods: Array.isArray(parsed.allowedMethods)
        ? parsed.allowedMethods
        : DEFAULT_DISCOUNT_POLICY.allowedMethods,
      maxPercent:
        Number.isFinite(parsed.maxPercent) && (parsed.maxPercent as number) >= 0
          ? Number(parsed.maxPercent)
          : DEFAULT_DISCOUNT_POLICY.maxPercent,
    };
  } catch {
    return DEFAULT_DISCOUNT_POLICY;
  }
}

export function writeDiscountPolicy(
  companyId: string,
  policy: DiscountPolicy,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(companyId), JSON.stringify(policy));
    window.dispatchEvent(
      new CustomEvent(EVENT, { detail: { companyId, policy } }),
    );
  } catch {
    /* noop */
  }
}

export function useDiscountPolicy(
  companyId: string,
): [DiscountPolicy, (p: DiscountPolicy) => void] {
  const [policy, setPolicy] = useState<DiscountPolicy>(() =>
    readDiscountPolicy(companyId),
  );
  useEffect(() => {
    setPolicy(readDiscountPolicy(companyId));
    function onChange(e: Event) {
      const d = (e as CustomEvent<{ companyId: string; policy: DiscountPolicy }>)
        .detail;
      if (d?.companyId === companyId) setPolicy(d.policy);
    }
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [companyId]);
  const update = useCallback(
    (p: DiscountPolicy) => {
      writeDiscountPolicy(companyId, p);
      setPolicy(p);
    },
    [companyId],
  );
  return [policy, update];
}

// -------- Avaliação --------

export type DiscountEvaluation =
  | { kind: "disabled_by_policy" }
  | { kind: "disabled_by_method"; reason: string }
  | { kind: "no_discount" }
  | { kind: "ok"; percent: number }
  | { kind: "exceeds"; percent: number; enforcement: DiscountEnforcement };

export function evaluateDiscount(input: {
  subtotal: number;
  discountValue: number;
  paymentMethod: string;
  policy: DiscountPolicy;
  overrideApproved?: boolean;
}): DiscountEvaluation {
  const { subtotal, discountValue, paymentMethod, policy, overrideApproved } =
    input;

  const result = ((): DiscountEvaluation => {
    if (!policy.enabled) return { kind: "disabled_by_policy" };

    // 1) Desconto zero (ou negativo) nunca deve gerar bloqueio/aviso —
    //    avalia isso ANTES de qualquer regra de forma de pagamento.
    if (!discountValue || discountValue <= 0) return { kind: "no_discount" };

    // 2) Regra por forma de pagamento. Usa o atributo `kind` do registro
    //    de métodos (PIX / PIX Próprio / Dinheiro / Débito são "cash").
    //    Comparação por rótulo é proibida — sempre pelo id + atributo.
    const method = (paymentMethod || "").trim();
    const isCash = isCashPaymentMethod(method);
    if (method && !isCash && !policy.allowedMethods.includes(method)) {
      return {
        kind: "disabled_by_method",
        reason: "Desconto disponível apenas para pagamentos à vista.",
      };
    }

    const percent = subtotal > 0 ? (discountValue / subtotal) * 100 : 0;
    if (percent <= policy.maxPercent + 1e-9 || overrideApproved) {
      return { kind: "ok", percent };
    }
    return { kind: "exceeds", percent, enforcement: policy.enforcement };
  })();

  // Log interno não invasivo — facilita depurar por que um desconto foi
  // bloqueado (zero / método / política). Só emite em dev.
  if (
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: { DEV?: boolean } }).env?.DEV
  ) {
    // eslint-disable-next-line no-console
    console.debug("[discount-policy]", {
      subtotal,
      discountValue,
      paymentMethod,
      result: result.kind,
    });
  }

  return result;
}
