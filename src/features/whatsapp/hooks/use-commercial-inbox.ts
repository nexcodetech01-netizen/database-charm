/**
 * Inbox Comercial (WhatsApp) — leitura e mudança de status pela equipe.
 *
 * Toca SOMENTE a tabela `whatsapp_commercial_inbox`. Nenhuma venda,
 * estoque, financeiro ou CRM é criado/alterado aqui.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMERCIAL_INBOX_STATUS,
  type CommercialInboxStatus,
  type CommercialTicketItem,
} from "@/features/whatsapp/inbound/commercial-inbox";

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
}

const KEY = ["whatsapp-commercial-inbox"] as const;

export function useCommercialInbox(companyId: string | null) {
  return useQuery({
    queryKey: [...KEY, companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<CommercialInboxTicket[]> => {
      const { data, error } = await supabase
        .from("whatsapp_commercial_inbox")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as CommercialInboxTicket[];
    },
  });
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
      return input;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export { COMMERCIAL_INBOX_STATUS };
