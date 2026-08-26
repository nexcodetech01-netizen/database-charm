/**
 * PDV — Observador do pagamento (RC2 / P0.3).
 *
 * Somente leitura. Enquanto existir uma venda criada nesta sessão do balcão
 * e o CheckoutDialog estiver FECHADO, acompanhamos o status da venda no
 * banco (Realtime + poll de segurança). Quando a transação for confirmada
 * (`status = 'paid'`), o PDV conclui a venda normalmente.
 *
 * Não altera CheckoutDialog, SaleEngine, Financeiro, Fiscal ou Estoque:
 * nenhuma escrita é feita aqui.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  saleId: string | null;
  /** Observa apenas quando o diálogo de pagamento não está visível. */
  enabled: boolean;
  onPaid: (saleId: string, method: string | null) => void;
  /** Intervalo do poll de segurança (ms). */
  pollMs?: number;
};

export function usePdvSaleWatch({
  saleId,
  enabled,
  onPaid,
  // Egress: o Realtime é a via principal; o poll é apenas rede de segurança.
  pollMs = 30_000,
}: Options) {
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  });

  useEffect(() => {
    if (!enabled || !saleId) return;
    let done = false;

    const confirm = (status?: string | null, method?: string | null) => {
      if (done || status !== "paid") return;
      done = true;
      onPaidRef.current(saleId, method ?? null);
    };

    const check = async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("status, payment_method")
        .eq("id", saleId)
        .maybeSingle();
      if (error) {
        console.error("[pdv] falha ao consultar status da venda", error.message);
        return;
      }
      confirm(data?.status, data?.payment_method);
    };

    const channel = supabase
      .channel(`pdv-sale-${saleId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
          filter: `id=eq.${saleId}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as {
            status?: string;
            payment_method?: string | null;
          };
          confirm(next.status, next.payment_method);
        },
      )
      .subscribe();

    void check();
    const timer = setInterval(() => void check(), pollMs);

    return () => {
      done = true;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, saleId, pollMs]);
}
