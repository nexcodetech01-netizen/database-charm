/**
 * Console WhatsApp — tipos compartilhados.
 * Reflete apenas o que já está persistido pelo módulo WhatsApp,
 * mais colunas de assignment/notes/unread adicionadas pela migração.
 */

export type ConversationStatus =
  | "open"
  | "bella"
  | "human"
  | "waiting_customer"
  | "resolved"
  | "archived";

export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  open: "Aberta",
  bella: "Bella",
  human: "Humano",
  waiting_customer: "Aguardando cliente",
  resolved: "Resolvida",
  archived: "Arquivada",
};

export interface ConversationNote {
  id: string;
  author_id: string | null;
  author_name: string | null;
  text: string;
  created_at: string;
}

export interface ConversationListItem {
  id: string;
  company_id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_wa_id: string;
  status: ConversationStatus;
  assigned_operator_id: string | null;
  assigned_operator_name: string | null;
  unread_count: number;
  protocol: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_direction: "inbound" | "outbound" | null;
  last_message_provider: string | null;
  channel: "whatsapp";
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  status: string | null;
  error: string | null;
  provider: string | null;
  skill_id: string | null;
  processing_ms: number | null;
  wa_message_id: string | null;
  created_at: string;
}

export interface ConversationDetail extends ConversationListItem {
  notes: ConversationNote[];
  messages: ConversationMessage[];
}

export interface ConversationFilterState {
  bucket: "all" | "unread" | "bella" | "human" | "resolved" | "today" | "week";
  search: string;
}

export interface ConversationMetrics {
  open: number;
  bella: number;
  human: number;
  resolved: number;
  messagesToday: number;
  avgResponseSeconds: number | null;
  resolutionRate: number;
}
