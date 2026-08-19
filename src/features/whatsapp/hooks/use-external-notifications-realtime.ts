import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import { broadcastInboxEvent } from "../lib/inbox-sync";
import { NotificationSettings } from "@/hooks/use-notification-settings";

/**
 * Hook para ativar o listener em tempo real da tabela `whatsapp_message_events`
 * para capturar eventos de notificação disparados por sistemas externos (n8n).
 */
export function useExternalNotificationsRealtime(
  companyId: string | null, 
  settings: NotificationSettings | undefined,
  settingsLoading: boolean
) {
  const processedIds = useRef<Set<string>>(new Set());
  const pendingEvents = useRef<{ event: any, isHistorical: boolean }[]>([]);

  // Efeito para processar eventos pendentes assim que as configurações carregarem
  useEffect(() => {
    console.log(`[EXT-NOTIF] settingsLoading: ${settingsLoading}`);
    if (!settingsLoading && settings && pendingEvents.current.length > 0) {
      console.log(`[EXT-NOTIF] processing ${pendingEvents.current.length} pending events after settings load.`);
      const eventsToProcess = [...pendingEvents.current];
      pendingEvents.current = [];
      
      eventsToProcess.forEach(({ event, isHistorical }) => {
        if (event.wa_message_id?.includes("n8n-10")) {
          console.log(`[EXT-NOTIF] processing pending event n8n-10`);
        }
        emitEvent(event, isHistorical);
      });
    }
  }, [settingsLoading, settings]);

  const emitEvent = (event: any, isHistorical: boolean) => {
    if (event.wa_message_id?.includes("n8n-10")) {
      console.log(`[EXT-NOTIF] emitting catalog.order.received n8n-10`);
    }
    if (!companyId) return;

    // No momento, focamos apenas em notificações de pedidos do catálogo (catalog.order.received)
    if (event.wa_message_id?.startsWith('n8n-')) {
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
            total: 0
          }
        });
      }
    }
  };

  useEffect(() => {
    console.log(`[EXT-NOTIF] hook mounted`);
    if (!companyId) return;

    const processExternalEvent = (event: any, isHistorical = false) => {
      if (event.wa_message_id?.includes("n8n-10")) {
        console.log(`[EXT-NOTIF] processing event n8n-10`);
      }
      // Evita duplicidade
      if (processedIds.current.has(event.wa_message_id)) return;
      processedIds.current.add(event.wa_message_id);

      // Se as configurações ainda estão carregando, armazena no buffer
      if (settingsLoading || !settings) {
        if (event.wa_message_id?.includes("n8n-10")) {
          console.log(`[EXT-NOTIF] queued pending event n8n-10`);
        }
        pendingEvents.current.push({ event, isHistorical });
        return;
      }

      // Se já temos settings, emite imediatamente
      emitEvent(event, isHistorical);
    };

    // 2. Consulta inicial para não perder notificações enquanto offline
    const fetchRecentExternalEvents = async () => {
      console.log(`[EXT-NOTIF] historical query started`);
      const { data, error } = await supabase
        .from("whatsapp_message_events")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "processed")
        .like("wa_message_id", "n8n-%")
        .order("sent_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        console.log(`[EXT-NOTIF] historical events count: ${data.length}`);
        const hasN8N10 = data.some(row => row.wa_message_id?.includes("n8n-10"));
        if (hasN8N10) {
          console.log(`[EXT-NOTIF] found n8n event: n8n-10`);
        }
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
    }, [companyId, settingsLoading, !!settings]);
}
