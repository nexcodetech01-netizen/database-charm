import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  AlertTriangle,
  ShoppingCart,
  Megaphone,
} from "lucide-react";

export type SuggestionPriority = "critical" | "high" | "medium" | "low";
export type SuggestionTone = "danger" | "warning" | "neutral" | "positive";

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  meta: string;
  deadline: string;
  priority: SuggestionPriority;
  tone: SuggestionTone;
  icon: LucideIcon;
}

export const SUGGESTION_PRIORITY_LABEL: Record<SuggestionPriority, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export const SUGGESTION_PRIORITY_BADGE: Record<SuggestionPriority, string> = {
  critical: "border-danger/30 bg-danger/10 text-danger",
  high: "border-warning/30 bg-warning/10 text-warning",
  medium: "border-primary/30 bg-primary/10 text-primary",
  low: "border-border bg-muted text-muted-foreground",
};

export const SUGGESTION_TONE_MAP: Record<SuggestionTone, string> = {
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-primary/10 text-primary",
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export const SUGGESTIONS: Suggestion[] = [
  {
    id: "review-stock",
    title: "Revisar estoque de 12 produtos",
    description: "Itens abaixo do mínimo aguardando definição de compra.",
    meta: "Estoque",
    deadline: "Até amanhã",
    priority: "high",
    tone: "warning",
    icon: Boxes,
  },
  {
    id: "collect-overdue",
    title: "Cobrar 8 clientes inadimplentes",
    description: "Total em aberto acima de 30 dias.",
    meta: "Financeiro",
    deadline: "Hoje",
    priority: "critical",
    tone: "danger",
    icon: AlertTriangle,
  },
  {
    id: "supplier-order",
    title: "Fazer pedido ao fornecedor X",
    description: "Sugestão baseada no giro dos últimos 60 dias.",
    meta: "Compras",
    deadline: "Esta semana",
    priority: "medium",
    tone: "neutral",
    icon: ShoppingCart,
  },
  {
    id: "reactivation-campaign",
    title: "Criar campanha para clientes inativos",
    description: "Segmento com 42 contatos elegíveis à reativação.",
    meta: "Marketing",
    deadline: "Próximos 7 dias",
    priority: "low",
    tone: "positive",
    icon: Megaphone,
  },
];
