import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import { broadcastInboxEvent } from "../lib/inbox-sync";
import { NotificationSettings } from "@/hooks/use-notification-settings";
import { useLogStore } from "@/features/diagnostics/hooks/use-log-store";

/**
 * Hook para ativar o listener em tempo real da tabela `whatsapp_message_events`
 * para capturar eventos de notificação disparados por sistemas externos (n8n).
 * 
 * Correção (Fase 3): settings e settingsLoading via Refs + Sufixo aleatório no canal.
 */
export function useExternalNotificationsRealtime(
  companyId: string | null, 
  settings: NotificationSettings | undefined,
  settingsLoading: boolean
) {
  const processedIds = useRef<Set<string>>(new Set());
  const pendingEvents = useRef<{ event: any, isHistorical: boolean }[]>([]);
  const addLog = useLogStore(state => state.addLog);
  
  const settingsRef = useRef(settings);
  const loadingRef = useRef(settingsLoading);

  useEffect(() => {
    settingsRef.current = settings;
    loadingRef.current = settingsLoading;
    
    if (!settingsLoading && settings && pendingEvents.current.length > 0) {
      addLog('[EXT-NOTIF]', `processing ${pendingEvents.current.length} pending events after settings load.`);
      const eventsToProcess = [...pendingEvents.current];
      pendingEvents.current = [];
      
      eventsToProcess.forEach(({ event, isHistorical }) => {
        emitEvent(event, isHistorical);
      });
    }
  }, [settings, settingsLoading]);

  const emitEvent = (event: any, isHistorical: boolean) => {
    if (!companyId) return;

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
    addLog('[EXT-NOTIF]', `hook mounted/company changed: ${companyId}`);
    if (!companyId) return;

    // Sufixo aleatório para garantir unicidade do canal nesta montagem
    const channelId = Math.random().toString(36).substring(7);

    const processExternalEvent = (event: any, isHistorical = false) => {
      if (processedIds.current.has(event.wa_message_id)) return;
      processedIds.current.add(event.wa_message_id);

      if (loadingRef.current || !settingsRef.current) {
        addLog('[EXT-NOTIF]', `queued pending event: ${event.wa_message_id}`);
        pendingEvents.current.push({ event, isHistorical });
        return;
      }

      emitEvent(event, isHistorical);
    };

    const fetchRecentExternalEvents = async () => {
      addLog('[EXT-NOTIF]', `historical query started`);
      const { data, error } = await supabase
        .from("whatsapp_message_events")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "processed")
        .like("wa_message_id", "n8n-%")
        .order("sent_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        addLog('[EXT-NOTIF]', `historical events count: ${data.length}`);
        [...data].reverse().forEach(row => processExternalEvent(row, true));
      }
    };

    void fetchRecentExternalEvents();

    const channel = supabase
      .channel(`external-notifications-${companyId}-${channelId}`)
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
      addLog('[EXT-NOTIF]', `cleaning up channel for company: ${companyId}`);
      void supabase.removeChannel(channel);
    };
  }, [companyId]); 
}
