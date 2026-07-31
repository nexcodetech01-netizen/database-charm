import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  PackageMinus,
  CalendarClock,
  Wallet,
  TrendingDown,
  Users,
} from "lucide-react";

export type InsightPriority = "critical" | "high" | "medium" | "low";
export type InsightStatus = "pending" | "in_progress" | "done" | "snoozed" | "ignored";
export type InsightOrigin =
  | "finance"
  | "sales"
  | "inventory"
  | "customers"
  | "crm"
  | "marketing"
  | "purchases"
  | "agenda";

export type InsightCategory =
  | "risk"
  | "opportunity"
  | "operational"
  | "growth";

export interface RecommendedAction {
  label: string;
  hint?: string;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  category: InsightCategory;
  priority: InsightPriority;
  origin: InsightOrigin;
  status: InsightStatus;
  recommendedAction: RecommendedAction;
  date: string;
  icon: LucideIcon;
}

export const INSIGHT_PRIORITY_LABEL: Record<InsightPriority, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export const INSIGHT_PRIORITY_BADGE: Record<InsightPriority, string> = {
  critical: "border-danger/30 bg-danger/10 text-danger",
  high: "border-warning/30 bg-warning/10 text-warning",
  medium: "border-primary/30 bg-primary/10 text-primary",
  low: "border-border bg-muted text-muted-foreground",
};

export const INSIGHT_ORIGIN_LABEL: Record<InsightOrigin, string> = {
  finance: "Financeiro",
  sales: "Vendas",
  inventory: "Estoque",
  customers: "Clientes",
  crm: "CRM",
  marketing: "Marketing",
  purchases: "Compras",
  agenda: "Agenda",
};

export const INSIGHT_CATEGORY_LABEL: Record<InsightCategory, string> = {
  risk: "Risco",
  opportunity: "Oportunidade",
  operational: "Operacional",
  growth: "Crescimento",
};

export const INSIGHT_STATUS_LABEL: Record<InsightStatus, string> = {
  pending: "Pendente",
  in_progress: "Em execução",
  done: "Concluído",
  snoozed: "Adiado",
  ignored: "Ignorado",
};

export const INSIGHTS: Insight[] = [
  {
    id: "insight-overdue",
    title: "8 clientes inadimplentes há mais de 5 dias",
    description: "Total de R$ 4.320 em aberto. Cobrança imediata reduz risco.",
    category: "risk",
    priority: "critical",
    origin: "finance",
    status: "pending",
    recommendedAction: {
      label: "Iniciar cobrança",
      hint: "Enviar lembrete via WhatsApp e gerar 2ª via.",
    },
    date: "2026-07-19",
    icon: AlertTriangle,
  },
  {
    id: "insight-low-stock",
    title: "5 produtos abaixo do estoque mínimo",
    description: "Reposição sugerida antes do próximo fim de semana.",
    category: "operational",
    priority: "high",
    origin: "inventory",
    status: "pending",
    recommendedAction: {
      label: "Gerar pedido de compra",
      hint: "Baseado no giro dos últimos 30 dias.",
    },
    date: "2026-07-19",
    icon: PackageMinus,
  },
  {
    id: "insight-payroll",
    title: "Pró-labore vence em 2 dias",
    description: "Programar transferência para os sócios da empresa.",
    category: "operational",
    priority: "high",
    origin: "finance",
    status: "pending",
    recommendedAction: {
      label: "Agendar transferência",
    },
    date: "2026-07-21",
    icon: CalendarClock,
  },
  {
    id: "insight-cash-open",
    title: "Fechar caixa de hoje",
    description: "Sessão aberta há 6h aguardando conferência final.",
    category: "operational",
    priority: "medium",
    origin: "finance",
    status: "pending",
    recommendedAction: { label: "Abrir fechamento de caixa" },
    date: "2026-07-19",
    icon: Wallet,
  },
  {
    id: "insight-category-drop",
    title: "Queda de 18% nas vendas de Bolsas",
    description: "Categoria caiu vs. mesma semana do mês anterior.",
    category: "risk",
    priority: "high",
    origin: "sales",
    status: "pending",
    recommendedAction: { label: "Analisar categoria" },
    date: "2026-07-18",
    icon: TrendingDown,
  },
  {
    id: "insight-inactive-clients",
    title: "42 clientes inativos há mais de 90 dias",
    description: "Oportunidade de campanha de reativação com cupom.",
    category: "opportunity",
    priority: "medium",
    origin: "customers",
    status: "pending",
    recommendedAction: { label: "Criar campanha de reativação" },
    date: "2026-07-17",
    icon: Users,
  },
];
