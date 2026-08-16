import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import type { CommercialInboxTicket } from "@/features/whatsapp/hooks/use-commercial-inbox";
import { formatCurrency } from "@/lib/format";
import { broadcastInboxEvent } from "../lib/inbox-sync";

/**
 * Hook para ativar o listener em tempo real da tabela `whatsapp_commercial_inbox`.
 *
 * Transforma eventos de banco (INSERT) em eventos de domínio Bella (`catalog.order.received`).
 * Isso garante que qualquer lugar que consuma o `bellaEventRegistry` (como a Topbar)
 * reaja instantaneamente sem refresh.
 */
export function useCommercialInboxRealtime(companyId: string | null) {
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel("commercial-inbox-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_commercial_inbox",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const ticket = payload.new as CommercialInboxTicket;

          // Emitimos o evento de domínio no barramento in-memory.
          // O BellaEventRegistry já está escutando o engine e fará o upsert.
          bellaEventEngine.emit({
            type: "catalog.order.received",
            tenantId: companyId,
            payload: {
              entityId: ticket.id,
              ticketId: ticket.id,
              buyerName: ticket.buyer_name,
              phone: ticket.phone,
              total: Number(ticket.total),
              itemCount: ticket.item_count,
            },
            title: "Novo pedido do catálogo",
            description: `${ticket.buyer_name || "Cliente"} enviou um pedido de ${formatCurrency(Number(ticket.total))} (${ticket.item_count} itens).`,
            source: "realtime:whatsapp_commercial_inbox",
          });

          // Sincroniza com outras abas
          broadcastInboxEvent({
            type: "CATALOG_ORDER_RECEIVED",
            payload: {
              ticketId: ticket.id,
              buyerName: ticket.buyer_name || "Cliente",
              total: Number(ticket.total)
            }
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId]);
}
