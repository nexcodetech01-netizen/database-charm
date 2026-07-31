/**
 * Hooks React Query + Supabase Realtime para o Console WhatsApp.
 */
import { useEffect } from "react";
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

export function useConsoleRealtime(companyId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!companyId) return;
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
          qc.invalidateQueries({ queryKey: KEY.list(companyId) });
          qc.invalidateQueries({ queryKey: KEY.metrics(companyId) });
          const id = (payload.new as { id?: string } | null)?.id;
          if (id) qc.invalidateQueries({ queryKey: KEY.detail(id) });
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
        (payload) => {
          qc.invalidateQueries({ queryKey: KEY.list(companyId) });
          qc.invalidateQueries({ queryKey: KEY.metrics(companyId) });
          const convId = (payload.new as { conversation_id?: string } | null)?.conversation_id;
          if (convId) qc.invalidateQueries({ queryKey: KEY.detail(convId) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
      mutationFn: (vars: { conversationId: string; text: string }) =>
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
