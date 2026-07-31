import {
  Package,
  Boxes,
  Users,
  TrendingDown,
  Wallet,
  LineChart,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  MessageCircle,
  Megaphone,
  Calculator,
  Target,
  Sparkles,
  Bot,
  Landmark,
  FileText,
  FileCheck,
  Ban,
  Search,
  History,
  Star,
  Cog,
  User,
  type LucideIcon,
} from "lucide-react";

export type OverviewSignalTone = "neutral" | "positive" | "warning" | "danger";
export type SignalGroup = "critical" | "attention" | "opportunity";

export interface OverviewSignal {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: OverviewSignalTone;
  hint: string;
  group: SignalGroup;
}

export const OVERVIEW_SIGNALS: OverviewSignal[] = [
  {
    key: "low-stock",
    title: "Estoque baixo",
    description: "Produtos abaixo do estoque mínimo.",
    icon: Boxes,
    tone: "danger",
    hint: "Bella vai sugerir reposição automática.",
    group: "critical",
  },
  {
    key: "revenue-drop",
    title: "Receitas em queda",
    description: "Categorias com queda semana a semana.",
    icon: TrendingDown,
    tone: "danger",
    hint: "Bella vai investigar causas prováveis.",
    group: "critical",
  },
  {
    key: "idle-products",
    title: "Produtos parados",
    description: "Itens sem giro nos últimos 60 dias.",
    icon: Package,
    tone: "warning",
    hint: "Bella vai sugerir promoções e ajustes.",
    group: "attention",
  },
  {
    key: "inactive-customers",
    title: "Clientes sem comprar",
    description: "Base inativa há mais de 90 dias.",
    icon: Users,
    tone: "warning",
    hint: "Bella pode gerar campanha de reativação.",
    group: "attention",
  },
  {
    key: "expenses-outlier",
    title: "Despesas fora do padrão",
    description: "Lançamentos acima da média histórica.",
    icon: Wallet,
    tone: "warning",
    hint: "Bella vai destacar centros de custo afetados.",
    group: "attention",
  },
  {
    key: "top-product",
    title: "Produto campeão",
    description: "Item com maior contribuição no mês.",
    icon: Star,
    tone: "positive",
    hint: "Bella vai sugerir combos e upsell.",
    group: "opportunity",
  },
  {
    key: "top-customer",
    title: "Melhor cliente do mês",
    description: "Comprador com maior ticket acumulado.",
    icon: User,
    tone: "positive",
    hint: "Bella vai propor benefícios de fidelidade.",
    group: "opportunity",
  },
  {
    key: "growing-category",
    title: "Categoria em crescimento",
    description: "Segmento com maior aceleração de vendas.",
    icon: LineChart,
    tone: "positive",
    hint: "Bella vai recomendar investimento em estoque.",
    group: "opportunity",
  },
];

export const SIGNAL_GROUP_META: Record<
  SignalGroup,
  { label: string; description: string; badge: string; accent: string }
> = {
  critical: {
    label: "Crítico",
    description: "Requer ação imediata.",
    badge: "border-danger/20 bg-danger/10 text-danger",
    accent: "bg-danger",
  },
  attention: {
    label: "Atenção",
    description: "Monitorar de perto.",
    badge: "border-warning/20 bg-warning/10 text-warning",
    accent: "bg-warning",
  },
  opportunity: {
    label: "Oportunidade",
    description: "Potencial de crescimento.",
    badge:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    accent: "bg-emerald-500",
  },
};

export type InsightPriority = "low" | "medium" | "high" | "critical";
export type InsightOrigin =
  | "finance"
  | "sales"
  | "inventory"
  | "customers"
  | "crm"
  | "marketing"
  | "purchases"
  | "agenda";

export interface InsightCard {
  id: string;
  title: string;
  description: string;
  priority: InsightPriority;
  origin: InsightOrigin;
  suggestedAction: string;
  generatedAt: string;
}

export const INSIGHTS_MOCK: InsightCard[] = [];

export const INSIGHT_PRIORITY_LABELS: Record<InsightPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const INSIGHT_PRIORITY_TONE: Record<InsightPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-danger/10 text-danger border-danger/20",
};

export const INSIGHT_ORIGIN_LABELS: Record<InsightOrigin, string> = {
  finance: "Financeiro",
  sales: "Vendas",
  inventory: "Estoque",
  customers: "Clientes",
  crm: "CRM",
  marketing: "Marketing",
  purchases: "Compras",
  agenda: "Agenda",
};

export interface AutomationBlueprint {
  id: string;
  trigger: string;
  triggerIcon: LucideIcon;
  action: string;
  actionIcon: LucideIcon;
  description: string;
}

export const AUTOMATION_BLUEPRINTS: AutomationBlueprint[] = [
  {
    id: "after-sale",
    trigger: "Após venda",
    triggerIcon: Receipt,
    action: "Enviar WhatsApp",
    actionIcon: MessageCircle,
    description: "Confirmação, agradecimento e recibo automáticos.",
  },
  {
    id: "after-payment",
    trigger: "Após pagamento",
    triggerIcon: Wallet,
    action: "Enviar recibo",
    actionIcon: FileText,
    description: "Comprovante enviado por WhatsApp ou e-mail.",
  },
  {
    id: "after-low-stock",
    trigger: "Após estoque baixo",
    triggerIcon: Boxes,
    action: "Criar compra",
    actionIcon: ShoppingCart,
    description: "Sugestão de pedido com fornecedor preferencial.",
  },
  {
    id: "after-overdue",
    trigger: "Após atraso",
    triggerIcon: AlertTriangle,
    action: "Enviar cobrança",
    actionIcon: MessageCircle,
    description: "Mensagem cordial com link Bella Pay.",
  },
  {
    id: "after-idle-customer",
    trigger: "Após cliente parado",
    triggerIcon: Users,
    action: "Criar campanha",
    actionIcon: Megaphone,
    description: "Campanha segmentada de reativação.",
  },
];

export interface AgentBlueprint {
  id: string;
  name: string;
  scope: string;
  icon: LucideIcon;
  skills: string[];
}

export const AGENT_BLUEPRINTS: AgentBlueprint[] = [
  {
    id: "finance",
    name: "Assistente Financeiro",
    scope: "Fluxo de caixa, DRE, contas a pagar e receber.",
    icon: Wallet,
    skills: ["Projeção", "Conciliação", "Alertas"],
  },
  {
    id: "commercial",
    name: "Assistente Comercial",
    scope: "Vendas, pipeline e performance.",
    icon: Target,
    skills: ["Metas", "Pipeline", "Ticket médio"],
  },
  {
    id: "purchases",
    name: "Assistente de Compras",
    scope: "Reposição, fornecedores e custos.",
    icon: ShoppingCart,
    skills: ["Reposição", "Preço médio", "Prazo"],
  },
  {
    id: "inventory",
    name: "Assistente de Estoque",
    scope: "Curva ABC, giro e ruptura.",
    icon: Boxes,
    skills: ["Curva ABC", "Ruptura", "Giro"],
  },
  {
    id: "crm",
    name: "Assistente CRM",
    scope: "Relacionamento e retenção.",
    icon: Users,
    skills: ["Segmentação", "Reativação", "NPS"],
  },
  {
    id: "fiscal",
    name: "Assistente Fiscal",
    scope: "Impostos, NF-e e obrigações.",
    icon: Landmark,
    skills: ["NF-e", "Impostos", "Prazos"],
  },
  {
    id: "marketing",
    name: "Assistente Marketing",
    scope: "Campanhas, funil e conteúdo.",
    icon: Megaphone,
    skills: ["Campanhas", "Segmentos", "Copy"],
  },
];

export type PromptCategory = "favorites" | "recent" | "system" | "custom";

export interface PromptCatalogItem {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  icon: LucideIcon;
}

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  favorites: "Favoritos",
  recent: "Recentes",
  system: "Sistema",
  custom: "Personalizados",
};

export const PROMPT_CATEGORY_ICON: Record<PromptCategory, LucideIcon> = {
  favorites: Star,
  recent: History,
  system: Cog,
  custom: User,
};

export const PROMPT_CATALOG: PromptCatalogItem[] = [];

export interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  user: string;
  time: string;
  tokens: number;
  origin: string;
}

export const HISTORY_MOCK: HistoryEntry[] = [];

export const ASK_EXAMPLES = [
  "Quais produtos estão parados?",
  "Quem mais compra?",
  "Quanto vendi este mês?",
  "Quais clientes estão inadimplentes?",
];

export type IntegrationStatus = "planned" | "in_development" | "connected";

export const INTEGRATION_STATUS_META: Record<
  IntegrationStatus,
  { label: string; badge: string; dot: string }
> = {
  planned: {
    label: "Planejado",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  in_development: {
    label: "Em desenvolvimento",
    badge: "border-warning/20 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  connected: {
    label: "Conectado",
    badge:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};

export interface FutureIntegration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: IntegrationStatus;
}

export const FUTURE_INTEGRATIONS: FutureIntegration[] = [
  { id: "openai", name: "OpenAI", description: "GPT-4o, GPT-4.1, o-series.", icon: Sparkles, status: "in_development" },
  { id: "gemini", name: "Google Gemini", description: "Gemini 1.5 / 2.0.", icon: Bot, status: "planned" },
  { id: "claude", name: "Anthropic Claude", description: "Claude 3.5 Sonnet, Opus.", icon: Bot, status: "planned" },
  { id: "azure", name: "Azure OpenAI", description: "Deploy corporativo.", icon: Sparkles, status: "planned" },
  { id: "local", name: "Modelos locais", description: "Ollama, LM Studio.", icon: Bot, status: "planned" },
];

export interface QuickActionPrompt {
  id: string;
  label: string;
  prompt: string;
  icon: LucideIcon;
}

export const QUICK_ACTION_PROMPTS: QuickActionPrompt[] = [
  { id: "sales", label: "Analisar vendas", prompt: "Analise as vendas dos últimos 30 dias e destaque tendências e produtos de maior contribuição.", icon: Receipt },
  { id: "cashflow", label: "Fluxo de caixa", prompt: "Mostre o fluxo de caixa projetado para os próximos 30 dias e possíveis gargalos.", icon: Wallet },
  { id: "critical-stock", label: "Estoque crítico", prompt: "Liste os produtos com estoque abaixo do mínimo e sugestão de reposição por fornecedor.", icon: Boxes },
  { id: "inactive-customers", label: "Clientes inativos", prompt: "Quais clientes não compram há mais de 90 dias? Sugira uma campanha de reativação.", icon: Users },
  { id: "profitable-products", label: "Produtos mais lucrativos", prompt: "Quais são os produtos com maior margem de contribuição no mês?", icon: Star },
  { id: "suggested-purchases", label: "Compras sugeridas", prompt: "Gere uma lista de compras sugeridas com base no giro e no estoque atual.", icon: ShoppingCart },
  { id: "fiscal-issue", label: "Emitir NF-e", prompt: "Emita uma NF-e para a última venda paga em homologação.", icon: FileCheck },
  { id: "fiscal-status", label: "Status de NF-e", prompt: "Qual o status da última NF-e emitida?", icon: Search },
  { id: "fiscal-cancel", label: "Cancelar NF-e", prompt: "Cancele a NF-e {número} com a justificativa {motivo}.", icon: Ban },
  { id: "fiscal-search", label: "Buscar notas", prompt: "Liste as NF-e autorizadas nos últimos 7 dias.", icon: FileText },
];

export interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "neutral" | "positive";
  meta: string;
}

export const SUGGESTED_TASKS: SuggestedTask[] = [
  {
    id: "review-stock",
    title: "Revisar estoque de 12 produtos",
    description: "Itens abaixo do mínimo aguardando definição de compra.",
    icon: Boxes,
    tone: "warning",
    meta: "Estoque",
  },
  {
    id: "collect-overdue",
    title: "Cobrar 8 clientes inadimplentes",
    description: "Total em aberto acima de 30 dias.",
    icon: AlertTriangle,
    tone: "danger",
    meta: "Financeiro",
  },
  {
    id: "supplier-order",
    title: "Fazer pedido ao fornecedor X",
    description: "Sugestão baseada no giro dos últimos 60 dias.",
    icon: ShoppingCart,
    tone: "neutral",
    meta: "Compras",
  },
  {
    id: "reactivation-campaign",
    title: "Criar campanha para clientes inativos",
    description: "Segmento com 42 contatos elegíveis à reativação.",
    icon: Megaphone,
    tone: "positive",
    meta: "Marketing",
  },
];

export const TASK_TONE_MAP: Record<SuggestedTask["tone"], string> = {
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-primary/10 text-primary",
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};
