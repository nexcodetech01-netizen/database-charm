/**
 * Bella Contadora — Proactive (Sprint 5.5): contratos das notificações.
 *
 * Camada 100% pura. Nenhuma regra de negócio nova: o motor proativo apenas
 * interpreta dados já apurados (summary/insights/advisor/health) e devolve
 * recomendações. Nunca executa nada.
 */
import type {
  AccountingSummary,
  FinancialHealth,
} from "../types";
import type { AccountingInsight } from "../insights";
import type { FinancialAdvice } from "../advisor";

/** Severidade da notificação (define a ordenação padrão). */
export type NotificationSeverity = "critical" | "warning" | "success" | "info";

/** Categorias oficiais da Sprint 5.5. */
export type NotificationCategory =
  | "financeiro"
  | "caixa"
  | "estoque"
  | "clientes"
  | "produtos"
  | "fiscal"
  | "receita"
  | "lucro"
  | "sistema";

/** Ação sugerida — apenas recomendação, jamais executada automaticamente. */
export type NotificationActionId =
  | "comprar_estoque"
  | "cobrar_cliente"
  | "revisar_preco"
  | "reduzir_despesas"
  | "aumentar_divulgacao"
  | "negociar_prazos"
  | "reativar_cliente"
  | "revisar_mix"
  | "manter_ritmo"
  | "acompanhar"
  | "revisar_retirada"
  | "ajustar_prolabore"
  | "programar_imposto"
  | "conferir_dados";

export interface NotificationAction {
  id: NotificationActionId;
  label: string;
}

/** Ícone sugerido (nome estável) — o mapeamento visual vive na UI. */
export type NotificationIconName =
  | "trending-up"
  | "trending-down"
  | "wallet"
  | "boxes"
  | "users"
  | "package"
  | "receipt"
  | "percent"
  | "alert"
  | "check"
  | "info";

export interface BellaNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  recommendation: string;
  action: NotificationAction;
  /** 0–100 — severidade + magnitude. */
  priority: number;
  createdAt: string;
  /** Usuário pode fechar (estado de sessão apenas). */
  dismissible: boolean;
  /** Reaparece mesmo após dismiss em uma nova sessão/refresh. */
  persistent: boolean;
}

/** Entrada do Proactive Engine — apenas dados já apurados. */
export interface ProactiveInput {
  summary: AccountingSummary | null;
  insights?: readonly AccountingInsight[];
  advice?: FinancialAdvice | null;
  health?: FinancialHealth | null;
}

export interface ProactiveOptions {
  /** Timestamp determinístico (testes). */
  now?: string;
  /** Notificações fechadas na sessão. */
  dismissedIds?: readonly string[];
  /** Limite de itens retornados. */
  limit?: number;
}

export interface ProactiveContext {
  summary: AccountingSummary;
  insights: readonly AccountingInsight[];
  advice: FinancialAdvice | null;
  health: FinancialHealth | null;
  createdAt: string;
}

export type ProactiveRule = (ctx: ProactiveContext) => BellaNotification | null;

export interface ProactiveRuleDescriptor {
  id: string;
  category: NotificationCategory;
  description: string;
  run: ProactiveRule;
}

export interface NotificationGroup {
  category: NotificationCategory;
  notifications: BellaNotification[];
}
