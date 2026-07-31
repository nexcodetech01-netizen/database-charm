import { useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { onPaymentConfirmed } from "@/lib/events/payment-events";

/**
 * WOW 4 — Pagamento confirmado.
 *
 * Ouve o event bus global de pagamentos confirmados e mostra uma
 * notificação não intrusiva (sonner) com a ação "Ver venda".
 *
 * - Não interrompe o trabalho do usuário (sem modal automático).
 * - Não faz polling nem abre canal realtime — apenas consome eventos
 *   emitidos por outra camada quando disponível.
 * - Reaproveita o Toaster já montado no layout.
 */
export function PaymentConfirmedListener() {
  const router = useRouter();

  useEffect(() => {
    return onPaymentConfirmed((event) => {
      toast.success("🎉 Pagamento confirmado", {
        description:
          "Tudo foi atualizado automaticamente.\n✓ Venda atualizada\n✓ Financeiro atualizado\n✓ Caixa atualizado\n✓ Histórico atualizado",
        duration: 8000,
        action: {
          label: "Ver venda",
          onClick: () => {
            void router.navigate({
              to: "/vendas/$saleId",
              params: { saleId: event.saleId },
            });
          },
        },
      });
    });
  }, [router]);

  return null;
}
