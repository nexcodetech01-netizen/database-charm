/**
 * Inbox Comercial (WhatsApp) — leitura e mudança de status pela equipe.
 *
 * Toca SOMENTE a tabela `whatsapp_commercial_inbox`. Nenhuma venda,
 * estoque, financeiro ou CRM é criado/alterado aqui.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMERCIAL_INBOX_STATUS,
  type CommercialInboxStatus,
  type CommercialTicketItem,
} from "@/features/whatsapp/inbound/commercial-inbox";
import { buildConversionPatch } from "@/features/whatsapp/inbound/inbox-conversion";
import { broadcastInboxEvent } from "../lib/inbox-sync";
import { logQueryMetric } from "@/lib/metrics";

export interface CommercialInboxTicket {
  id: string;
  phone: string;
  buyer_name: string | null;
  items: CommercialTicketItem[];
  item_count: number;
  total: number;
  fulfillment: "pickup" | "delivery";
  delivery: {
    city: string | null;
    neighborhood: string | null;
    address: string | null;
    complement: string | null;
  };
  payment: string | null;
  origin: string;
  status: CommercialInboxStatus;
  created_at: string;
  sale_id: string | null;
  converted_at: string | null;
  full_name: string | null;
  person_type: "pf" | "pj" | null;
  cpf: string | null;
  cnpj: string | null;
  birth_date: string | null;
  zip_code: string | null;
  state: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
}

const KEY = ["whatsapp-commercial-inbox"] as const;

export function useCommercialInbox(companyId: string | null, page = 1) {
  const pageSize = 50;
  const query = useQuery({
    queryKey: [...KEY, companyId, page],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<{ rows: CommercialInboxTicket[]; total: number }> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // FIX (2026-08-19): a lista não precisa do campo `items` (o JSON
      // completo dos produtos do pedido, até ~500kB por linha — o
      // maior contribuinte pro consumo de saída de dados identificado
      // na auditoria). A lista já tem `item_count`/`total` pro resumo;
      // `items` completo só é buscado sob demanda, ao abrir um ticket
      // específico — ver `useCommercialInboxDetail` abaixo.
      const { data, error, count } = await supabase
        .from("whatsapp_commercial_inbox")
        .select(`
          id, phone, buyer_name, item_count, total, status, origin, created_at,
          fulfillment, delivery, payment, sale_id, converted_at,
          full_name, person_type, cpf, cnpj, birth_date, zip_code,
          state, city, district, street, number, complement
        `, { count: "exact" })
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      
      logQueryMetric("inbox_list", data, companyId);

      return {
        rows: (data ?? []).map((row: any) => ({ ...row, items: [] })) as unknown as CommercialInboxTicket[],
        total: count ?? 0,
      };
    },
  });

  const qc = useQueryClient();

  // Ativa o Realtime para invalidar o cache do TanStack Query
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel("inbox-query-refresh")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "whatsapp_commercial_inbox",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: [...KEY, companyId] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  return query;
}

export function useUpdateCommercialInboxStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: CommercialInboxStatus }) => {
      const { error } = await supabase
        .from("whatsapp_commercial_inbox")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;

      // Sincroniza a resolução com outras abas
      if (
        input.status === COMMERCIAL_INBOX_STATUS.attended ||
        input.status === COMMERCIAL_INBOX_STATUS.converted ||
        input.status === COMMERCIAL_INBOX_STATUS.cancelled
      ) {
        broadcastInboxEvent({
          type: "CATALOG_ORDER_RESOLVED",
          payload: { ticketId: input.id }
        });
      }

      return input;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export { COMMERCIAL_INBOX_STATUS };

/* ------------------------------------------------------------------ *
 * Conversão em venda (Sprint 6.8.4)
 * Nenhuma venda é criada aqui. Apenas leitura do atendimento e, DEPOIS
 * que o fluxo oficial de vendas criou a venda, o vínculo no Inbox.
 * ------------------------------------------------------------------ */

export function useCommercialInboxTicket(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "ticket", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<CommercialInboxTicket | null> => {
      const { data, error } = await supabase
        .from("whatsapp_commercial_inbox")
        .select(`
          id, phone, buyer_name, item_count, total, status, origin, created_at,
          fulfillment, delivery, payment, sale_id, converted_at,
          full_name, person_type, cpf, cnpj, birth_date, zip_code,
          state, city, district, street, number, complement, items
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as CommercialInboxTicket | null;
    },
  });
}

/** Candidatos a cliente para tentar identificar o comprador do atendimento. */
export function useCustomerCandidates(companyId: string | null) {
  return useQuery({
    queryKey: ["customers", "conversion-candidates", companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,phone,whatsapp,document")
        .eq("company_id", companyId!)
        .neq("status", "archived")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMarkInboxConverted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; saleId: string }) => {
      const patch = buildConversionPatch(input.saleId);
      const { error } = await supabase
        .from("whatsapp_commercial_inbox")
        .update(patch)
        .eq("id", input.id)
        // Idempotência: um atendimento já convertido não é reescrito.
        .is("sale_id", null);
      if (error) throw error;

      // Sincroniza a resolução com outras abas
      broadcastInboxEvent({
        type: "CATALOG_ORDER_RESOLVED",
        payload: { ticketId: input.id }
      });

      return input;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/**
 * Busca o ticket completo (incluindo `items`, o JSON pesado dos
 * produtos do pedido) só quando um ticket específico é aberto — ver
 * comentário em `useCommercialInbox` sobre por que a lista não traz
 * esse campo por padrão.
 */
export function useCommercialInboxDetail(ticketId: string | null) {
  return useQuery({
    queryKey: ["whatsapp-commercial-inbox-detail", ticketId],
    enabled: Boolean(ticketId),
    queryFn: async (): Promise<CommercialInboxTicket | null> => {
      const { data, error } = await supabase
        .from("whatsapp_commercial_inbox")
        .select("*")
        .eq("id", ticketId!)
        .maybeSingle();
      if (error) throw error;

      // Pegamos o company_id do próprio dado retornado, se disponível
      const companyId = (data as any)?.company_id || null;
      logQueryMetric("inbox_ticket_detail", data, companyId);

      return data as unknown as CommercialInboxTicket | null;
    },
  });
}
