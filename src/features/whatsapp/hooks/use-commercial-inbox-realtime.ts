import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import type { CommercialInboxTicket } from "@/features/whatsapp/hooks/use-commercial-inbox";
import { KEY as COMMERCIAL_INBOX_QUERY_KEY } from "@/features/whatsapp/hooks/use-commercial-inbox";
import { formatCurrency } from "@/lib/format";
import { broadcastInboxEvent } from "../lib/inbox-sync";

/**
 * Hook para ativar o listener em tempo real da tabela `whatsapp_commercial_inbox`
 * e sincronizar eventos de domínio com o frontend.
 *
 * Requisitos atendidos:
 * 1. Supabase Realtime para notificações em tempo real.
 * 2. Consulta inicial para não perder eventos com o app fechado.
 * 3. Proteção contra duplicidade via `processedIds`.
 */
export function useCommercialInboxRealtime(companyId: string | null) {
  const processedIds = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    // BUG ENCONTRADO E CORRIGIDO: esse hook emitia o evento (pro
    // sino/toast) e chamava `broadcastInboxEvent` — mas
    // `broadcastInboxEvent` usa `BroadcastChannel`, que por definição
    // do próprio navegador NUNCA entrega a mensagem de volta pra quem
    // enviou. Serve só pra sincronizar OUTRAS abas abertas — a aba
    // atual nunca recebia o próprio aviso. Faltava invalidar a query
    // da lista NESTA aba diretamente, por isso o pedido novo só
    // aparecia depois de recarregar a página manualmente, mesmo o
    // sino/notificação já funcionando corretamente.

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
          isHistorical, // Flag para controle interno se necessário
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

    // 2. Consulta inicial: Recupera eventos das últimas 24h para garantir que nada foi perdido
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
        if (data.length > 0) {
          void queryClient.invalidateQueries({ queryKey: [...COMMERCIAL_INBOX_QUERY_KEY, companyId] });
        }
      }
    };

    void fetchRecentEvents();

    // 3. Inscrição Realtime
    // OBS: o topic inclui um sufixo aleatório por montagem do efeito.
    // Antes, o topic era só `commercial-inbox-${companyId}` — se o efeito
    // desmontasse e remontasse rápido (ex.: render duplo em modo de
    // desenvolvimento do Lovable), o `removeChannel` da limpeza anterior
    // podia não ter terminado ainda quando o novo `.channel(mesmoTopic)`
    // era chamado, e o Supabase client devolvia o canal ANTIGO (já
    // inscrito) em vez de criar um novo — daí o erro "cannot add
    // postgres_changes callbacks ... after subscribe()" ao encadear
    // `.on(...)` nele. Um topic único por montagem elimina a colisão.
    const channelTopic = `commercial-inbox-${companyId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelTopic)
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
          // Atualiza a lista NESTA aba (ver comentário no topo do hook).
          void queryClient.invalidateQueries({ queryKey: [...COMMERCIAL_INBOX_QUERY_KEY, companyId] });
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
          const ticket = payload.new as CommercialInboxTicket;
          // Se um ticket foi resolvido em outra aba/instância, resolvemos localmente
          if (ticket.status !== "aguardando_atendimento") {
            // O Registry já trata isso via resolveByPayload se necessário, 
            // mas aqui garantimos a limpeza do set de processados se quisermos permitir re-notificação (raro)
            // Para pedidos resolvidos, o registry da Topbar já limpa o contador.
          }
          // Mesma correção: sem isso, mudar o status em outra aba/instância
          // (ex.: outro atendente marcou como atendido) só refletia aqui
          // depois de recarregar a página.
          void queryClient.invalidateQueries({ queryKey: [...COMMERCIAL_INBOX_QUERY_KEY, companyId] });
        }
      )
      .subscribe((status) => {
        // Mesma correção aplicada em use-external-notifications-realtime.ts:
        // fecha a janela entre "efeito montou" e "canal confirmou
        // SUBSCRIBED" reconsultando os eventos recentes assim que a
        // inscrição fica de fato pronta — sem isso, um pedido criado
        // bem nesse intervalo passa batido até o próximo refresh.
        if (status === "SUBSCRIBED") {
          void fetchRecentEvents();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId]);
}
