import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  calcTotalAvistaPdv,
  calcTotalCartaoPdv,
  type CardPriceConfig,
} from "@/lib/pricing/card-price";
import {
  toSalePaymentMethod,
  type UiCheckoutMethod,
} from "../../components/checkout/types";

// `type` (e não `interface`) para ser atribuível ao tipo Json da RPC.
export type PdvCashItem = {
  product_id: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  position: number;
};

interface UseCheckoutPricingParams {
  open: boolean;
  saleId: string;
  /** Total recebido do pai (grand_total). */
  initialAmount: number;
  method: UiCheckoutMethod;
  installments: number;
  discount?: number;
  shipping?: number;
  pdvCashItems?: PdvCashItem[];
  cardPriceConfig: CardPriceConfig | null | undefined;
  onPdvPricingChange?: (pricing: {
    amount: number;
    method: UiCheckoutMethod;
    installments: number;
  }) => void;
  confirmed: boolean;
  confirmedRef: RefObject<boolean>;
  showCompleted: boolean;
}

const PRICING_ERROR = "Não foi possível atualizar o preço da venda.";

const initialKey = (saleId: string) => `${saleId}:pix_manual:1`;

/**
 * Preço à vista × cartão do PDV.
 *
 * Recalcula o total conforme a forma de pagamento escolhida e persiste via
 * RPC `apply_pdv_payment_pricing`. As chamadas são serializadas e
 * deduplicadas por chave (venda + método + parcelas).
 */
export function useCheckoutPricing({
  open,
  saleId,
  initialAmount,
  method,
  installments,
  discount,
  shipping,
  pdvCashItems,
  cardPriceConfig,
  onPdvPricingChange,
  confirmed,
  confirmedRef,
  showCompleted,
}: UseCheckoutPricingParams) {
  const [amount, setAmount] = useState(initialAmount);
  const lastAppliedKeyRef = useRef(initialKey(saleId));
  const requestRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const errorRef = useRef<{ key: string; error: Error } | null>(null);

  useEffect(() => setAmount(initialAmount), [initialAmount, saleId]);

  function pricingKey(): string {
    const normalizedInstallments =
      method === "credit_card" ? Math.max(1, Math.trunc(installments || 1)) : 1;
    return `${saleId}:${method}:${normalizedInstallments}`;
  }

  function applyPricing(): Promise<void> {
    const key = pricingKey();
    if (!pdvCashItems?.length || lastAppliedKeyRef.current === key) {
      return Promise.resolve();
    }
    if (requestRef.current?.key === key) return requestRef.current.promise;
    if (errorRef.current?.key === key) return Promise.reject(errorRef.current.error);

    const nextAmount =
      method === "credit_card" && cardPriceConfig?.active
        ? calcTotalCartaoPdv(pdvCashItems, discount ?? 0, shipping ?? 0, cardPriceConfig)
        : calcTotalAvistaPdv(pdvCashItems, discount ?? 0, shipping ?? 0);
    setAmount(nextAmount);
    onPdvPricingChange?.({ amount: nextAmount, method, installments });

    const previous = requestRef.current?.promise ?? Promise.resolve();
    const promise = previous
      .catch(() => undefined)
      .then(async () => {
        const { error } = await supabase.rpc("apply_pdv_payment_pricing", {
          _sale_id: saleId,
          _payment_method: toSalePaymentMethod(method),
          _installments: installments,
          _cash_items: pdvCashItems,
        });
        if (error) throw new Error(error.message);
        lastAppliedKeyRef.current = key;
        errorRef.current = null;
      })
      .catch((error: unknown) => {
        const normalized = error instanceof Error ? error : new Error(PRICING_ERROR);
        errorRef.current = { key, error: normalized };
        throw normalized;
      });
    requestRef.current = { key, promise };
    return promise;
  }

  /** Garante que o preço do método atual foi gravado antes de finalizar. */
  async function ensurePricingReady(): Promise<boolean> {
    if (!pdvCashItems?.length) return true;
    const key = pricingKey();
    if (errorRef.current?.key === key) {
      errorRef.current = null;
      if (requestRef.current?.key === key) requestRef.current = null;
    }
    try {
      await applyPricing();
      return true;
    } catch (error) {
      toast.error(PRICING_ERROR, {
        description: error instanceof Error ? error.message : undefined,
      });
      return false;
    }
  }

  // Aplica o preço ao trocar forma de pagamento/parcelas.
  useEffect(() => {
    if (
      !open ||
      !pdvCashItems?.length ||
      confirmed ||
      confirmedRef.current ||
      showCompleted ||
      (method === "credit_card" && !cardPriceConfig)
    ) {
      return;
    }
    if (lastAppliedKeyRef.current === pricingKey()) return;
    void applyPricing().catch((error: unknown) => {
      toast.error(PRICING_ERROR, {
        description: error instanceof Error ? error.message : undefined,
      });
    });
    // Reage somente à escolha de pagamento/parcelas e à disponibilidade
    // inicial da configuração, nunca a renders do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method, installments, cardPriceConfig, confirmed, showCompleted, saleId]);

  // Ao fechar o checkout, volta ao estado inicial (PIX, 1x).
  useEffect(() => {
    if (open) return;
    lastAppliedKeyRef.current = initialKey(saleId);
    requestRef.current = null;
    errorRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { amount, ensurePricingReady };
}
