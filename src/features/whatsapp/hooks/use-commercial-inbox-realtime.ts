import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import type { CommercialInboxTicket } from "@/features/whatsapp/hooks/use-commercial-inbox";
import { formatCurrency } from "@/lib/format";
import { broadcastInboxEvent } from "../lib/inbox-sync";

/**
 * Hook para ativar o listener em tempo real da tabela `whatsapp_commercial_inbox`
 * e sincronizar eventos de domínio com o frontend.
 *
 * Correção: Uso de sufixo aleatório no nome do canal para evitar colisão
 * "after subscribe()" em caso de re-render rápido.
 */
export function useCommercialInboxRealtime(companyId: string | null) {
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!companyId) return;

    // Sufixo aleatório para garantir unicidade do canal nesta montagem
    const channelId = Math.random().toString(36).substring(7);
    
    // 1. Função para transformar um registro em evento de domínio
    const emitOrderEvent = (ticket: CommercialInboxTicket, isHistorical = false) => {
      if (processedIds.current.has(ticket.id)) return;
      processedIds.current.add(ticket.id);

      // Apenas pedidos "aguardando_atendimento" geram notificação
      if (ticket.status !== "aguardando_atendimento") return;

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
          isHistorical, 
        },
        title: "Novo pedido do catálogo",
        description: `${ticket.buyer_name || "Cliente"} enviou um pedido de ${formatCurrency(Number(ticket.total))} (${ticket.item_count} itens).`,
        source: isHistorical ? "history:whatsapp_commercial_inbox" : "realtime:whatsapp_commercial_inbox",
      });

      if (!isHistorical) {
        broadcastInboxEvent({
          type: "CATALOG_ORDER_RECEIVED",
          payload: {
            ticketId: ticket.id,
            buyerName: ticket.buyer_name || "Cliente",
            total: Number(ticket.total)
          }
        });
      }
    };

    // 2. Consulta inicial: Recupera eventos das últimas 24h
    const fetchRecentEvents = async () => {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data, error } = await supabase
        .from("whatsapp_commercial_inbox")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "aguardando_atendimento")
        .gt("created_at", yesterday.toISOString())
        .order("created_at", { ascending: true });

      if (!error && data) {
        data.forEach(row => emitOrderEvent(row as unknown as CommercialInboxTicket, true));
      }
    };

    void fetchRecentEvents();

    // 3. Inscrição Realtime com ID Único
    const channel = supabase
      .channel(`commercial-inbox-${companyId}-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_commercial_inbox",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          emitOrderEvent(payload.new as CommercialInboxTicket);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_commercial_inbox",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          // Lógica de update se necessária
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId]);
}
