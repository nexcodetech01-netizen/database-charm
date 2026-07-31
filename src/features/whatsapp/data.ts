import type {
  ConversationStatus,
  MessageKind,
  MessageStatus,
  QuickAction,
  TemplateCategory,
  WhatsAppAutomation,
  WhatsAppConversation,
  WhatsAppProvider,
  WhatsAppTemplate,
  WhatsAppTimelineEvent,
} from "./types";

/**
 * Mocks vazios / catálogos estáticos. Nenhum dado real trafega aqui.
 */

export const WHATSAPP_CONVERSATIONS: WhatsAppConversation[] = [];
export const WHATSAPP_TIMELINE: WhatsAppTimelineEvent[] = [];

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  open: "Aberta",
  pending: "Pendente",
  resolved: "Resolvida",
  archived: "Arquivada",
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  queued: "Na fila",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falha",
};

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  text: "Texto",
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  document: "Documento",
  pdf: "PDF",
  order: "Pedido",
  quote: "Orçamento",
  invoice: "Nota",
  charge: "Cobrança",
  pix: "PIX",
  bella_pay_link: "Link Bella Pay",
  receipt: "Recibo",
  catalog: "Catálogo",
  tracking: "Rastreio",
};

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "quote", label: "Enviar orçamento", description: "PDF do orçamento com itens e validade." },
  { id: "order", label: "Enviar pedido", description: "Confirmação do pedido com resumo." },
  { id: "invoice", label: "Enviar nota", description: "DANFE / NF-e vinculada." },
  { id: "charge", label: "Enviar cobrança", description: "Cobrança financeira com vencimento." },
  { id: "pix", label: "Enviar PIX", description: "QR Code + copia-e-cola." },
  { id: "bella_pay_link", label: "Enviar link Bella Pay", description: "Checkout hospedado do Bella Pay." },
  { id: "receipt", label: "Enviar recibo", description: "Recibo formal do pagamento." },
  { id: "catalog", label: "Enviar catálogo", description: "Catálogo de produtos filtrado." },
  { id: "pdf", label: "Enviar PDF", description: "Documento avulso do NexOS." },
  { id: "tracking", label: "Compartilhar rastreio", description: "Código e link de rastreamento." },
];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  welcome: "Boas-vindas",
  order: "Pedido",
  quote: "Orçamento",
  charge: "Cobrança",
  post_sale: "Pós-venda",
  reminder: "Lembrete",
  birthday: "Aniversário",
};

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  { id: "tpl-welcome", category: "welcome", name: "Boas-vindas padrão", preview: "Olá {{cliente}}, seja bem-vindo à {{empresa}}!" },
  { id: "tpl-order", category: "order", name: "Confirmação de pedido", preview: "Recebemos seu pedido #{{numero}}, valor {{total}}." },
  { id: "tpl-quote", category: "quote", name: "Envio de orçamento", preview: "Segue seu orçamento em PDF. Validade: {{validade}}." },
  { id: "tpl-charge", category: "charge", name: "Cobrança pendente", preview: "Olá {{cliente}}, sua fatura de {{valor}} vence em {{data}}." },
  { id: "tpl-post-sale", category: "post_sale", name: "Pós-venda 7 dias", preview: "Como foi sua experiência com {{produto}}?" },
  { id: "tpl-reminder", category: "reminder", name: "Lembrete de agenda", preview: "Lembrando seu compromisso em {{data}} às {{hora}}." },
  { id: "tpl-birthday", category: "birthday", name: "Aniversário do cliente", preview: "Feliz aniversário, {{cliente}}! 🎉" },
];

export const WHATSAPP_AUTOMATIONS: WhatsAppAutomation[] = [
  { id: "auto-1", trigger: "after_sale", action: "send_receipt", enabled: false, description: "Após uma venda ser concluída, envia recibo automaticamente." },
  { id: "auto-2", trigger: "after_quote", action: "send_pdf", enabled: false, description: "Após gerar orçamento, envia o PDF ao cliente." },
  { id: "auto-3", trigger: "after_charge", action: "send_pix", enabled: false, description: "Após emitir cobrança, envia o PIX ao cliente." },
  { id: "auto-4", trigger: "after_payment", action: "send_thanks", enabled: false, description: "Após pagamento confirmado, envia mensagem de agradecimento." },
];

export const AUTOMATION_TRIGGER_LABELS = {
  after_sale: "Após venda",
  after_quote: "Após orçamento",
  after_charge: "Após cobrança",
  after_payment: "Após pagamento",
} as const;

export const AUTOMATION_ACTION_LABELS = {
  send_receipt: "Enviar recibo",
  send_pdf: "Enviar PDF",
  send_pix: "Enviar PIX",
  send_thanks: "Enviar agradecimento",
} as const;

export const WHATSAPP_PROVIDERS: {
  id: WhatsAppProvider;
  name: string;
  description: string;
}[] = [
  { id: "cloud_api", name: "WhatsApp Cloud API", description: "Integração oficial via Meta Cloud API." },
  { id: "evolution", name: "Evolution API", description: "Provedor open source auto-hospedado." },
  { id: "zapi", name: "Z-API", description: "Gateway brasileiro para WhatsApp." },
  { id: "meta_business", name: "Meta Business", description: "Conta comercial verificada da Meta." },
];
