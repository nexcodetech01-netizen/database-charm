/**
 * FlowTemplates — modelos declarativos de processos comuns.
 *
 * Cada template é um `FlowDefinition` puro. As Skills referenciadas
 * são compiladas apenas na publicação; na simulação, mostram-se como
 * pendentes caso a Skill ainda não esteja registrada.
 */
import { createFlow, createNode } from "./FlowBuilder";
import type { FlowDefinition } from "./types";

export interface FlowTemplateMeta {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  build(companyId: string, authorId?: string | null): FlowDefinition;
}

function tpl(
  key: string,
  name: string,
  description: string,
  tags: string[],
  build: (companyId: string, authorId?: string | null) => FlowDefinition,
): FlowTemplateMeta {
  return { key, name, description, tags, build };
}

export const FLOW_TEMPLATES: readonly FlowTemplateMeta[] = [
  tpl(
    "quote-followup",
    "Follow-up de orçamento",
    "Aguarda 24h após o orçamento e envia lembrete via WhatsApp.",
    ["vendas", "whatsapp"],
    (companyId, authorId) =>
      createFlow({
        companyId,
        authorId,
        name: "Follow-up de orçamento",
        description: "Lembrete automático 24h após envio do orçamento.",
        tags: ["vendas"],
        nodes: [
          createNode("start", "Início"),
          createNode("event", "Orçamento enviado", { event: "quote.sent" }),
          createNode("delay", "Aguardar 24h", { ms: 24 * 60 * 60 * 1000 }),
          createNode("whatsapp", "Enviar lembrete", {
            message: "Olá! Podemos ajudar com o orçamento enviado ontem?",
          }),
          createNode("end", "Fim"),
        ],
      }),
  ),
  tpl(
    "auto-billing",
    "Cobrança automática",
    "Emite cobrança quando a venda é confirmada.",
    ["financeiro", "pagamentos"],
    (companyId, authorId) =>
      createFlow({
        companyId,
        authorId,
        name: "Cobrança automática",
        description: "Ao confirmar a venda, gera cobrança e notifica cliente.",
        tags: ["financeiro"],
        nodes: [
          createNode("start", "Início"),
          createNode("event", "Venda confirmada", { event: "sale.confirmed" }),
          createNode("skill", "Gerar cobrança", { skillId: "finance.create_charge" }),
          createNode("whatsapp", "Enviar link de pagamento", {
            message: "Sua cobrança está disponível. Segue o link.",
          }),
          createNode("end", "Fim"),
        ],
      }),
  ),
  tpl(
    "welcome-customer",
    "Boas-vindas ao cliente",
    "Envia mensagem de boas-vindas ao cadastrar um novo cliente.",
    ["crm", "onboarding"],
    (companyId, authorId) =>
      createFlow({
        companyId,
        authorId,
        name: "Boas-vindas ao cliente",
        description: "Cadastro → boas-vindas → registro de contato.",
        tags: ["crm"],
        nodes: [
          createNode("start", "Início"),
          createNode("event", "Cliente cadastrado", { event: "customer.created" }),
          createNode("whatsapp", "Enviar boas-vindas", {
            message: "Seja muito bem-vindo(a)!",
          }),
          createNode("notification", "Notificar equipe", {
            message: "Novo cliente cadastrado.",
          }),
          createNode("end", "Fim"),
        ],
      }),
  ),
  tpl(
    "cart-recovery",
    "Recuperação de carrinho",
    "Recupera vendas abandonadas após 1h.",
    ["vendas", "recuperacao"],
    (companyId, authorId) =>
      createFlow({
        companyId,
        authorId,
        name: "Recuperação de carrinho",
        description: "Detecta abandono e envia lembrete personalizado.",
        tags: ["vendas"],
        nodes: [
          createNode("start", "Início"),
          createNode("event", "Carrinho abandonado", { event: "cart.abandoned" }),
          createNode("delay", "Aguardar 1h", { ms: 60 * 60 * 1000 }),
          createNode("condition", "Cliente com WhatsApp?", { expression: "customer.hasWhatsapp" }),
          createNode("whatsapp", "Lembrete de checkout", {
            message: "Notamos que você deixou itens no carrinho. Podemos ajudar?",
          }),
          createNode("end", "Fim"),
        ],
      }),
  ),
  tpl(
    "stock-restock",
    "Reposição de estoque",
    "Cria pedido de compra quando estoque atinge o mínimo.",
    ["estoque", "compras"],
    (companyId, authorId) =>
      createFlow({
        companyId,
        authorId,
        name: "Reposição de estoque",
        description: "Estoque crítico → aprovação → sugestão de compra.",
        tags: ["estoque"],
        nodes: [
          createNode("start", "Início"),
          createNode("event", "Estoque crítico", { event: "stock.critical" }),
          createNode("approval", "Aprovar reposição", {
            message: "Aprovar sugestão de compra?",
          }),
          createNode("skill", "Gerar pedido de compra", {
            skillId: "purchase.create_suggestion",
          }),
          createNode("end", "Fim"),
        ],
      }),
  ),
  tpl(
    "finance-approval",
    "Aprovação financeira",
    "Solicita aprovação humana antes de lançamentos acima do limite.",
    ["financeiro", "governanca"],
    (companyId, authorId) =>
      createFlow({
        companyId,
        authorId,
        name: "Aprovação financeira",
        description: "Bloqueia lançamentos altos até aprovação.",
        tags: ["financeiro"],
        nodes: [
          createNode("start", "Início"),
          createNode("event", "Lançamento criado", { event: "finance.entry.created" }),
          createNode("condition", "Valor > limite?", { expression: "entry.amount > 5000" }),
          createNode("approval", "Aprovar lançamento", {
            message: "Aprovar lançamento acima do limite?",
          }),
          createNode("notification", "Notificar solicitante", {
            message: "Seu lançamento foi analisado.",
          }),
          createNode("end", "Fim"),
        ],
      }),
  ),
  tpl(
    "whatsapp-initial",
    "Atendimento inicial WhatsApp",
    "Recebe mensagem, saúda e classifica a intenção.",
    ["whatsapp", "atendimento"],
    (companyId, authorId) =>
      createFlow({
        companyId,
        authorId,
        name: "Atendimento inicial WhatsApp",
        description: "Fluxo padrão de recepção no WhatsApp.",
        tags: ["whatsapp"],
        nodes: [
          createNode("start", "Início"),
          createNode("event", "Mensagem recebida", { event: "whatsapp.message.received" }),
          createNode("whatsapp", "Saudação", {
            message: "Olá! Sou a Bella. Como posso ajudar?",
          }),
          createNode("question", "Qual o assunto?", {
            prompt: "Escolha: 1) Comprar 2) Suporte 3) Falar com humano",
          }),
          createNode("decision", "Rotear atendimento", { options: ["compra", "suporte", "humano"] }),
          createNode("end", "Fim"),
        ],
      }),
  ),
];

export function getTemplate(key: string): FlowTemplateMeta | undefined {
  return FLOW_TEMPLATES.find((t) => t.key === key);
}
