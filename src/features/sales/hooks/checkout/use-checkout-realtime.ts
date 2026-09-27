import { useEffect, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChargeRow } from "../../components/checkout/types";
import { useLatestRef } from "./use-latest-ref";

const CHARGE_FIELDS = [
  "status",
  "invoice_url",
  "payment_link",
  "pix_qr_code",
  "pix_payload",
  "billing_type",
] as const;

/**
 * Atualiza a cobrança Bella Pay (status/QR/link) via Postgres Changes
 * enquanto aguarda o webhook do Asaas. Só observa — quem confirma o
 * pagamento é o servidor.
 */
export function useChargeRealtime(
  chargeId: string | null,
  setCharge: Dispatch<SetStateAction<ChargeRow | null>>,
) {
  useEffect(() => {
    if (!chargeId) return;
    const channel = supabase
      .channel(`checkout-charge-${chargeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bella_pay_charges",
          filter: `id=eq.${chargeId}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as Partial<ChargeRow>;
          setCharge((prev) => {
            if (!prev) return prev;
            const unchanged = CHARGE_FIELDS.every((field) => prev[field] === next[field]);
            return unchanged ? prev : ({ ...prev, ...next } as ChargeRow);
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chargeId, setCharge]);
}

/**
 * Escuta `sales.status = 'paid'` gravado pelo webhook e dispara `onPaid`.
 * O callback é lido do último render, então sempre enxerga o método de
 * pagamento e as parcelas atuais, sem refazer a assinatura.
 */
export function useSalePaidRealtime(
  saleId: string,
  enabled: boolean,
  onPaid: () => void,
) {
  const onPaidRef = useLatestRef(onPaid);

  useEffect(() => {
    if (!enabled || !saleId) return;
    const channel = supabase
      .channel(`checkout-sale-${saleId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
          filter: `id=eq.${saleId}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as { status?: string };
          if (next.status === "paid") onPaidRef.current();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, saleId, onPaidRef]);
}
