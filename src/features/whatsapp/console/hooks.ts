/**
 * Hooks React Query + Supabase Realtime para o Console WhatsApp.
 */
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  addConversationNote,
  assumeConversation,
  createConversation,
  deleteConversation,
  getConsoleMetrics,
  getConversation,
  listConversations,
  markConversationRead,
  returnToBella,
  sendOperatorMessage,
  setConversationStatus,
} from "./service.functions";
import type { ConversationStatus } from "./types";

const KEY = {
  list: (companyId: string) => ["whatsapp-console", "list", companyId] as const,
  metrics: (companyId: string) => ["whatsapp-console", "metrics", companyId] as const,
  detail: (id: string) => ["whatsapp-console", "detail", id] as const,
};

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

export function useConsoleConversations(companyId: string | null) {
  const list = useServerFn(listConversations);
  const query = useQuery({
    queryKey: companyId ? KEY.list(companyId) : ["whatsapp-console", "list", "none"],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: Boolean(companyId),
    staleTime: 15_000,
  });
  useEffect(() => {
    if (query.error) {
      toast.error("Não foi possível carregar as conversas", {
        description: extractErrorMessage(query.error, "Verifique sua conexão e tente novamente."),
      });
    }
  }, [query.error]);
  return query;
}

export function useConsoleMetrics(companyId: string | null) {
  const metrics = useServerFn(getConsoleMetrics);
  const query = useQuery({
    queryKey: companyId ? KEY.metrics(companyId) : ["whatsapp-console", "metrics", "none"],
    queryFn: () => metrics({ data: { companyId: companyId! } }),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (query.error) {
      toast.error("Não foi possível carregar as métricas", {
        description: extractErrorMessage(query.error, "Tente novamente em instantes."),
      });
    }
  }, [query.error]);
  return query;
}

export function useCreateConversation(companyId: string | null) {
  const qc = useQueryClient();
  const create = useServerFn(createConversation);
  return useMutation({
    mutationFn: (vars: { phone: string; name?: string | null }) => {
      if (!companyId) throw new Error("Empresa não identificada.");
      return create({ data: { companyId, phone: vars.phone, name: vars.name ?? null } });
    },
    onSuccess: () => {
      if (companyId) {
        qc.invalidateQueries({ queryKey: KEY.list(companyId) });
        qc.invalidateQueries({ queryKey: KEY.metrics(companyId) });
      }
    },
    onError: (err) => {
      toast.error("Não foi possível iniciar a conversa", {
        description: extractErrorMessage(err, "Verifique o número informado e tente novamente."),
      });
    },
  });
}


export function useConversationDetail(conversationId: string | null) {
  const detail = useServerFn(getConversation);
  return useQuery({
    queryKey: conversationId ? KEY.detail(conversationId) : ["whatsapp-console", "detail", "none"],
    queryFn: () => detail({ data: { conversationId: conversationId! } }),
    enabled: Boolean(conversationId),
    staleTime: 10_000,
  });
}

export function useConsoleRealtime(companyId: string | null, onNewInbound?: (message: { conversation_id: string; text: string; contact_name?: string }) => void) {
  const qc = useQueryClient();
  // `onNewInbound` costuma ser passado como arrow function inline pelo
  // chamador (sem useCallback) — sem esta ref, o efeito abaixo desmontava
  // e recriava o canal Supabase Realtime a CADA RENDER do console (toda
  // vez que a conversa selecionada, filtros etc. mudavam), podendo perder
  // eventos durante a janela de reconexão. A ref mantém a callback sempre
  // atualizada sem precisar entrar no array de dependências do efeito.
  const onNewInboundRef = useRef(onNewInbound);
  onNewInboundRef.current = onNewInbound;

  useEffect(() => {
    if (!companyId) return;

    // PERF (2026-10-24): cada mensagem da Bella gera vários eventos seguidos
    // (mensagem recebida, resposta, atualização da conversa…). Antes, CADA
    // evento recarregava lista + métricas + conversa aberta na hora — 3 a 5
    // recargas completas por mensagem. Agora as rajadas são agrupadas:
    //  - conversa aberta: recarrega após 300 ms (rápido para o operador);
    //  - lista: após 800 ms;
    //  - métricas: no máximo a cada 10 s.
    const pendingDetails = new Set<string>();
    let detailTimer: ReturnType<typeof setTimeout> | null = null;
    let listTimer: ReturnType<typeof setTimeout> | null = null;
    let metricsTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleDetail = (id: string) => {
      pendingDetails.add(id);
      if (detailTimer) return;
      detailTimer = setTimeout(() => {
        detailTimer = null;
        for (const d of pendingDetails) qc.invalidateQueries({ queryKey: KEY.detail(d) });
        pendingDetails.clear();
      }, 300);
    };
    const scheduleList = () => {
      if (listTimer) clearTimeout(listTimer);
      listTimer = setTimeout(() => {
        listTimer = null;
        qc.invalidateQueries({ queryKey: KEY.list(companyId) });
      }, 800);
    };
    const scheduleMetrics = () => {
      if (metricsTimer) return;
      metricsTimer = setTimeout(() => {
        metricsTimer = null;
        qc.invalidateQueries({ queryKey: KEY.metrics(companyId) });
      }, 10_000);
    };

    const channel = supabase
      .channel(`wa-console-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          scheduleList();
          scheduleMetrics();
          const id = (payload.new as { id?: string } | null)?.id || (payload.old as { id?: string } | null)?.id;
          if (id) scheduleDetail(id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `company_id=eq.${companyId}`,
        },
        async (payload) => {
          scheduleList();
          scheduleMetrics();
          const msg = payload.new as {
            conversation_id?: string;
            direction?: string;
            sender?: string;
            text?: string | null;
          };
          if (msg.conversation_id) {
            scheduleDetail(msg.conversation_id);

            // Notificação apenas para mensagens recebidas (inbound).
            if (msg.direction === "inbound" && onNewInboundRef.current) {
              // Uma consulta só (antes eram duas em sequência, e a segunda
              // pedia a coluna `name`, que não existe — o nome nunca aparecia).
              const { data: conv } = await supabase
                .from("whatsapp_conversations")
                .select("id, contact:whatsapp_contacts ( profile_name )")
                .eq("id", msg.conversation_id)
                .maybeSingle();
              const contact = (conv as { contact?: { profile_name?: string | null } | null } | null)
                ?.contact;

              onNewInboundRef.current({
                conversation_id: msg.conversation_id,
                text: msg.text || "",
                contact_name: contact?.profile_name || "Cliente",
              });
            }
          }
        },
      )
      .subscribe();
    return () => {
      if (detailTimer) clearTimeout(detailTimer);
      if (listTimer) clearTimeout(listTimer);
      if (metricsTimer) clearTimeout(metricsTimer);
      supabase.removeChannel(channel);
    };
    // onNewInbound é intencionalmente omitido: usamos onNewInboundRef para
    // sempre chamar a versão mais recente sem recriar o canal a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, qc]);
}

/* -------- Mutations -------- */

export function useConsoleMutations(companyId: string | null) {
  const qc = useQueryClient();
  const assumeFn = useServerFn(assumeConversation);
  const returnFn = useServerFn(returnToBella);
  const statusFn = useServerFn(setConversationStatus);
  const readFn = useServerFn(markConversationRead);
  const noteFn = useServerFn(addConversationNote);
  const sendFn = useServerFn(sendOperatorMessage);
  const deleteFn = useServerFn(deleteConversation);

  const invalidate = (conversationId?: string) => {
    if (companyId) {
      qc.invalidateQueries({ queryKey: KEY.list(companyId) });
      qc.invalidateQueries({ queryKey: KEY.metrics(companyId) });
    }
    if (conversationId) qc.invalidateQueries({ queryKey: KEY.detail(conversationId) });
  };

  return {
    assume: useMutation({
      mutationFn: (conversationId: string) => assumeFn({ data: { conversationId } }),
      onSuccess: (_r, id) => invalidate(id),
    }),
    returnToBella: useMutation({
      mutationFn: (conversationId: string) => returnFn({ data: { conversationId } }),
      onSuccess: (_r, id) => invalidate(id),
    }),
    setStatus: useMutation({
      mutationFn: (vars: { conversationId: string; status: ConversationStatus }) =>
        statusFn({ data: vars }),
      onSuccess: (_r, v) => invalidate(v.conversationId),
    }),
    markRead: useMutation({
      mutationFn: (conversationId: string) => readFn({ data: { conversationId } }),
      onSuccess: (_r, id) => invalidate(id),
    }),
    addNote: useMutation({
      mutationFn: (vars: { conversationId: string; text: string }) =>
        noteFn({ data: vars }),
      onSuccess: (_r, v) => invalidate(v.conversationId),
    }),
    sendMessage: useMutation({
      mutationFn: (vars: { conversationId: string; text: string; type?: "text" | "template"; templateName?: string }) =>
        sendFn({ data: vars }),
      onSuccess: (_r, v) => invalidate(v.conversationId),
    }),
    deleteConversation: useMutation({
      mutationFn: (conversationId: string) => deleteFn({ data: { conversationId } }),
      onSuccess: (_r, id) => {
        invalidate(id);
        if (companyId) {
          qc.removeQueries({ queryKey: KEY.detail(id) });
        }
      },
    }),
  };
}
