/**
 * WhatsApp Business — contratos visuais do módulo.
 *
 * Nenhuma execução, integração ou persistência. Este arquivo define o formato
 * que futuros provedores (WhatsApp Cloud API, Evolution, Z-API, Meta Business)
 * irão implementar para a Central de Comunicação do NexOS.
 */

export type WhatsAppProvider =
  | "cloud_api"
  | "evolution"
  | "zapi"
  | "meta_business";

export type ConversationStatus = "open" | "pending" | "resolved" | "archived";

export type MessageDirection = "in" | "out";

export type MessageKind =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "pdf"
  | "order"
  | "quote"
  | "invoice"
  | "charge"
  | "pix"
  | "bella_pay_link"
  | "receipt"
  | "catalog"
  | "tracking";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  city?: string | null;
  avatarUrl?: string | null;
  tags?: string[];
  lastPurchaseAt?: string | null;
  totalPurchasedCents?: number;
  ordersCount?: number;
  openInvoicesCents?: number;
  crmStage?: string | null;
}

export interface WhatsAppMessage {
  id: string;
  direction: MessageDirection;
  kind: MessageKind;
  content: string;
  attachmentName?: string | null;
  amountCents?: number | null;
  status: MessageStatus;
  createdAt: string;
}

export interface WhatsAppConversation {
  id: string;
  contact: WhatsAppContact;
  status: ConversationStatus;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageAt: string;
  channel: WhatsAppProvider;
}

export type QuickActionId =
  | "quote"
  | "order"
  | "invoice"
  | "charge"
  | "pix"
  | "bella_pay_link"
  | "receipt"
  | "catalog"
  | "pdf"
  | "tracking";

export interface QuickAction {
  id: QuickActionId;
  label: string;
  description: string;
}

export type TemplateCategory =
  | "welcome"
  | "order"
  | "quote"
  | "charge"
  | "post_sale"
  | "reminder"
  | "birthday";

export interface WhatsAppTemplate {
  id: string;
  category: TemplateCategory;
  name: string;
  preview: string;
}

export type AutomationTrigger =
  | "after_sale"
  | "after_quote"
  | "after_charge"
  | "after_payment";

export type AutomationAction =
  | "send_receipt"
  | "send_pdf"
  | "send_pix"
  | "send_thanks";

export interface WhatsAppAutomation {
  id: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled: boolean;
  description: string;
}

export type TimelineEventKind =
  | "order_sent"
  | "payment_received"
  | "pdf_sent"
  | "message_read"
  | "charge_sent"
  | "pix_paid";

export interface WhatsAppTimelineEvent {
  id: string;
  kind: TimelineEventKind;
  label: string;
  at: string;
  detail?: string;
}
