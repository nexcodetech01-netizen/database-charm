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
 * Correção (Fase 3): settings e settingsLoading agora são lidos via Refs para evitar 
 * que a troca de estado de carregamento interrompa/reinicie a inscrição Realtime, 
 * o que causava perda de eventos durante a janela de reconexão.
 */
export function useExternalNotificationsRealtime(
  companyId: string | null, 
  settings: NotificationSettings | undefined,
  settingsLoading: boolean
) {
  const processedIds = useRef<Set<string>>(new Set());
  const pendingEvents = useRef<{ event: any, isHistorical: boolean }[]>([]);
  const addLog = useLogStore(state => state.addLog);
  
  // Refs para ler o estado mais recente sem disparar o efeito de subscription
  const settingsRef = useRef(settings);
  const loadingRef = useRef(settingsLoading);

  // Atualiza as refs quando os props mudam
  useEffect(() => {
    settingsRef.current = settings;
    loadingRef.current = settingsLoading;
    
    // Se parou de carregar e temos settings, processa o que estiver no buffer
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
    addLog('[EXT-NOTIF]', `hook mounted/company changed: ${companyId}`);
    if (!companyId) return;

    const processExternalEvent = (event: any, isHistorical = false) => {
      // Evita duplicidade
      if (processedIds.current.has(event.wa_message_id)) return;
      processedIds.current.add(event.wa_message_id);

      // Se as configurações ainda estão carregando, armazena no buffer
      // Usamos as refs para garantir que lemos o valor atual sem depender do fechamento do efeito
      if (loadingRef.current || !settingsRef.current) {
        addLog('[EXT-NOTIF]', `queued pending event: ${event.wa_message_id}`);
        pendingEvents.current.push({ event, isHistorical });
        return;
      }

      // Se já temos settings, emite imediatamente
      emitEvent(event, isHistorical);
    };

    // 2. Consulta inicial para não perder notificações enquanto offline
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

    // 3. Realtime subscription - Agora depende APENAS do companyId
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
      addLog('[EXT-NOTIF]', `cleaning up channel for company: ${companyId}`);
      void supabase.removeChannel(channel);
    };
  }, [companyId]); // A dependência agora é APENAS o companyId
}
