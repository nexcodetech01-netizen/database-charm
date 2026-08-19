import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import { broadcastInboxEvent } from "../lib/inbox-sync";

/**
 * Hook para ativar o listener em tempo real da tabela `whatsapp_message_events`
 * para capturar eventos de notificação disparados por sistemas externos (n8n).
 */
export function useExternalNotificationsRealtime(companyId: string | null) {
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!companyId) return;

    // 1. Função para processar e emitir o evento no BellaEngine
    const processExternalEvent = (event: any, isHistorical = false) => {
      // Evita duplicidade
      if (processedIds.current.has(event.wa_message_id)) return;
      processedIds.current.add(event.wa_message_id);

      // No momento, focamos apenas em notificações de pedidos do catálogo (catalog.order.received)
      // O endpoint trigger.ts usa wa_message_id como prefixo 'n8n-' + event_id
      // e persistimos o status como 'processed'.
      
      // Como a tabela whatsapp_message_events não tem o campo 'type' (ela é de logs),
      // e o trigger.ts já persistiu o evento n8n-10, precisamos saber se esse registro
      // é um pedido do catálogo. 
      // O trigger.ts insere wa_message_id = `n8n-${data.event_id}`.
      
      if (event.wa_message_id?.startsWith('n8n-')) {
        // Para eventos n8n, assumimos catalog.order.received conforme especificado no trigger.ts
        // Se no futuro houver outros tipos, o trigger.ts precisaria persistir o tipo em algum lugar
        // ou usaríamos uma convenção no wa_message_id.
        
        bellaEventEngine.emit({
          type: "catalog.order.received",
          tenantId: companyId,
          payload: {
            entityId: event.wa_message_id.replace('n8n-', ''),
            ticketId: event.wa_message_id.replace('n8n-', ''),
            companyId: companyId,
            source: "n8n",
            isExternal: true,
            isHistorical
          },
          // O BellaEventEngine usará os defaults do catálogo para título/descrição se não passarmos,
          // mas o trigger.ts enviou títulos específicos. Infelizmente não temos o título aqui no log.
          // Usamos o padrão do sistema.
          title: "Novo pedido do catálogo",
          description: "Um novo pedido foi recebido via integração externa.",
          source: isHistorical ? "history:external" : "realtime:external",
        });

        if (!isHistorical) {
          broadcastInboxEvent({
            type: "CATALOG_ORDER_RECEIVED",
            payload: {
              ticketId: event.wa_message_id.replace('n8n-', ''),
              buyerName: "Cliente",
              total: 0 // Não temos o valor no log de eventos
            }
          });
        }
      }
    };

    // 2. Consulta inicial para não perder notificações enquanto offline
    const fetchRecentExternalEvents = async () => {
      const { data, error } = await supabase
        .from("whatsapp_message_events")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "processed")
        .like("wa_message_id", "n8n-%")
        .order("sent_at", { ascending: false })
        .limit(10); // Apenas os mais recentes

      if (!error && data) {
        // Invertemos para processar do mais antigo para o mais novo
        [...data].reverse().forEach(row => processExternalEvent(row, true));
      }
    };

    void fetchRecentExternalEvents();

    // 3. Realtime subscription
    const channel = supabase
      .channel(`external-notifications-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_message_events",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.new.status === "processed" && payload.new.wa_message_id?.startsWith("n8n-")) {
            processExternalEvent(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId]);
}
