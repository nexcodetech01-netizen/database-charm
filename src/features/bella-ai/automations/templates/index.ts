/**
 * Automation Templates
 *
 * Blueprints prontos para uso — o usuário instancia um template e a
 * automação vira uma linha em `bella_automations`. Cada template
 * referencia Skills que devem existir no BellaSkillRegistry; caso
 * uma Skill não esteja disponível ainda, o validator alerta e o
 * template fica desabilitado até a Skill ser registrada.
 */
import type { AutomationTriggerType, AutomationActionDef, AutomationCondition } from "../types";

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: "vendas" | "financeiro" | "estoque" | "crm" | "agenda";
  triggerType: AutomationTriggerType;
  conditions: AutomationCondition[];
  actions: AutomationActionDef[];
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "sale-followup",
    name: "Boas-vindas pós-venda",
    description: "Ao concluir uma venda, envia mensagem de agradecimento ao cliente.",
    category: "vendas",
    triggerType: "sale.completed",
    conditions: [],
    actions: [
      {
        skillId: "customer.send_message",
        label: "Enviar mensagem de agradecimento",
        params: { template: "obrigado_compra" },
        paramsFromEvent: { customerId: "customer.id" },
      },
    ],
  },
  {
    id: "customer-inactive-30",
    name: "Reengajar cliente inativo (30 dias)",
    description: "Cliente sem compra há 30 dias recebe oferta personalizada.",
    category: "crm",
    triggerType: "customer.inactive",
    conditions: [{ path: "customer.daysInactive", operator: "gte", value: 30 }],
    actions: [
      {
        skillId: "customer.send_message",
        label: "Enviar oferta de reengajamento",
        params: { template: "reengajamento_30d" },
        paramsFromEvent: { customerId: "customer.id" },
      },
    ],
  },
  {
    id: "invoice-overdue-notify",
    name: "Cobrar fatura vencida",
    description: "Envia lembrete automático quando uma cobrança vence.",
    category: "financeiro",
    triggerType: "invoice.overdue",
    conditions: [{ path: "invoice.daysOverdue", operator: "gte", value: 1 }],
    actions: [
      {
        skillId: "finance.send_reminder",
        label: "Enviar lembrete de cobrança",
        paramsFromEvent: { invoiceId: "invoice.id", customerId: "customer.id" },
      },
    ],
  },
  {
    id: "stock-critical-alert",
    name: "Alertar estoque crítico",
    description: "Produto abaixo do mínimo aciona alerta interno para reposição.",
    category: "estoque",
    triggerType: "stock.critical",
    conditions: [{ path: "product.stock", operator: "lte", value: 3 }],
    actions: [
      {
        skillId: "product.create_reorder_alert",
        label: "Registrar alerta de reposição",
        paramsFromEvent: { productId: "product.id" },
      },
    ],
  },
  {
    id: "appointment-reminder",
    name: "Lembrete de agendamento",
    description: "Confirma agendamento 1 hora antes com o cliente.",
    category: "agenda",
    triggerType: "appointment.upcoming",
    conditions: [{ path: "appointment.minutesUntil", operator: "lte", value: 60 }],
    actions: [
      {
        skillId: "agenda.send_reminder",
        label: "Enviar confirmação",
        paramsFromEvent: { appointmentId: "appointment.id", customerId: "customer.id" },
      },
    ],
  },
];

export function getTemplate(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id);
}
