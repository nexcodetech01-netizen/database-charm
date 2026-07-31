import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// -------- Database mapped types --------
export type AssistantConversation = Tables<"assistant_conversations">;
export type AssistantConversationInsert = TablesInsert<"assistant_conversations">;
export type AssistantConversationUpdate = TablesUpdate<"assistant_conversations">;

export type AssistantMessage = Tables<"assistant_messages">;
export type AssistantMessageInsert = TablesInsert<"assistant_messages">;

export type AssistantContext = Tables<"assistant_context">;
export type AssistantContextInsert = TablesInsert<"assistant_context">;

export type AssistantRecommendation = Tables<"assistant_recommendations">;
export type AssistantRecommendationInsert = TablesInsert<"assistant_recommendations">;
export type AssistantRecommendationUpdate = TablesUpdate<"assistant_recommendations">;

export type AssistantAlert = Tables<"assistant_alerts">;
export type AssistantAlertInsert = TablesInsert<"assistant_alerts">;
export type AssistantAlertUpdate = TablesUpdate<"assistant_alerts">;

// -------- Domain enums --------
export type AIProvider = "openai" | "anthropic" | "gemini" | "deepseek";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type ContextType =
  | "products"
  | "purchases"
  | "inventory"
  | "customers"
  | "crm"
  | "sales"
  | "finance"
  | "agenda"
  | "marketing"
  | "reports"
  | "global";

export type RecommendationCategory =
  | "finance"
  | "sales"
  | "customers"
  | "products"
  | "marketing"
  | "agenda"
  | "inventory"
  | "general";

export type RecommendationPriority = "low" | "medium" | "high" | "urgent";
export type RecommendationStatus = "pending" | "accepted" | "dismissed" | "done";

export type AlertType =
  | "low_stock"
  | "inactive_customer"
  | "negative_cashflow"
  | "sale_above_average"
  | "purchase_out_of_pattern"
  | "overdue_payment"
  | "important_appointment"
  | "custom";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "snoozed";

// -------- Labels --------
export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  low_stock: "Estoque baixo",
  inactive_customer: "Cliente inativo",
  negative_cashflow: "Fluxo negativo",
  sale_above_average: "Venda acima da média",
  purchase_out_of_pattern: "Compra fora do padrão",
  overdue_payment: "Pagamento vencido",
  important_appointment: "Agendamento importante",
  custom: "Personalizado",
};

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-danger/10 text-danger border-danger/20",
};

export const RECOMMENDATION_CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  finance: "Financeiro",
  sales: "Vendas",
  customers: "Clientes",
  products: "Produtos",
  marketing: "Marketing",
  agenda: "Agenda",
  inventory: "Estoque",
  general: "Geral",
};

export const RECOMMENDATION_PRIORITY_COLORS: Record<RecommendationPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-warning/10 text-warning border-warning/20",
  urgent: "bg-danger/10 text-danger border-danger/20",
};

export const CONTEXT_TYPE_LABELS: Record<ContextType, string> = {
  products: "Produtos",
  purchases: "Compras",
  inventory: "Estoque",
  customers: "Clientes",
  crm: "CRM",
  sales: "Vendas",
  finance: "Financeiro",
  agenda: "Agenda",
  marketing: "Marketing",
  reports: "Relatórios",
  global: "Global",
};

// -------- Dashboard aggregates --------
export interface BellaDashboardMetrics {
  insightsAvailable: number;
  activeAlerts: number;
  pendingRecommendations: number;
  suggestedTasks: number;
}
