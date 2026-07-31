/**
 * Bella Event Engine — tipos públicos.
 *
 * Este módulo NÃO substitui `BellaEvent` / `BellaEventEngine` existentes
 * (que continuam sendo o barramento de eventos internos do dashboard).
 * Ele adiciona a camada operacional exigida pelo produto: detecção,
 * fila, dispatch (Workflow → Automação → Skill → Notificação) e
 * persistência auditável (`nexos_event_log`).
 *
 * Nenhuma regra de negócio nova vive aqui: toda execução delega para
 * o `BellaWorkflowEngine`, `AutomationEngine` ou `BellaSkillRegistry`.
 */

export type NexosEventPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type NexosEventModule =
  | "customers"
  | "products"
  | "sales"
  | "finance"
  | "inventory"
  | "quotes"
  | "whatsapp"
  | "workflow"
  | "automation";

/** Catálogo de eventos nativos suportados. */
export type NexosEventType =
  | "customer.created"
  | "customer.updated"
  | "product.created"
  | "product.updated"
  | "sale.created"
  | "sale.completed"
  | "payment.received"
  | "invoice.overdue"
  | "inventory.critical"
  | "inventory.out_of_stock"
  | "quote.created"
  | "quote.approved"
  | "quote.lost"
  | "whatsapp.message.received"
  | "workflow.finished"
  | "automation.executed"
  // detectores
  | "customer.inactive"
  | "product.stalled"
  | "sales.decline"
  | "sales.spike"
  | "invoice.batch_overdue"
  | "quote.multiple_lost";

export type NexosEventStatus = "pending" | "processing" | "success" | "error" | "skipped";

export interface NexosEvent<TPayload = Record<string, unknown>> {
  id: string;
  companyId: string;
  userId?: string | null;
  type: NexosEventType;
  module: NexosEventModule;
  priority: NexosEventPriority;
  source?: string;
  /** Chave estável para deduplicação idempotente por empresa+tipo. */
  dedupeKey?: string;
  payload: TPayload;
  createdAt: string;
  status?: NexosEventStatus;
}

export interface EmitNexosEventInput<TPayload = Record<string, unknown>> {
  companyId: string;
  type: NexosEventType;
  payload: TPayload;
  priority?: NexosEventPriority;
  module?: NexosEventModule;
  source?: string;
  userId?: string | null;
  dedupeKey?: string;
  /** Se `true`, publica sem persistir (uso em testes). */
  ephemeral?: boolean;
}

export interface NexosEventFilter {
  companyId?: string;
  userId?: string | null;
  module?: NexosEventModule;
  type?: NexosEventType | NexosEventType[];
  priority?: NexosEventPriority | NexosEventPriority[];
  status?: NexosEventStatus | NexosEventStatus[];
  since?: string;
  limit?: number;
}

/** Reação declarativa a um tipo de evento. */
export type NexosEventReaction =
  | { kind: "workflow"; workflowId: string }
  | { kind: "automation"; triggerType: string }
  | { kind: "skill"; skillId: string; buildPayload?: (evt: NexosEvent) => Record<string, unknown> }
  | { kind: "notify"; level: "info" | "success" | "warning" | "critical"; message: (evt: NexosEvent) => string };

export interface NexosEventReactionOutcome {
  kind: NexosEventReaction["kind"];
  ok: boolean;
  detail?: string;
  ref?: string;
}

export interface NexosEventProcessResult {
  status: NexosEventStatus;
  durationMs: number;
  outcomes: NexosEventReactionOutcome[];
  error?: string;
}

export interface NexosEventMetrics {
  total: number;
  perHour: number;
  processed: number;
  failures: number;
  queued: number;
  avgDurationMs: number;
}

/** Módulo por tipo (usado quando o emissor não informa). */
export const MODULE_BY_TYPE: Record<NexosEventType, NexosEventModule> = {
  "customer.created": "customers",
  "customer.updated": "customers",
  "customer.inactive": "customers",
  "product.created": "products",
  "product.updated": "products",
  "product.stalled": "products",
  "sale.created": "sales",
  "sale.completed": "sales",
  "sales.decline": "sales",
  "sales.spike": "sales",
  "payment.received": "finance",
  "invoice.overdue": "finance",
  "invoice.batch_overdue": "finance",
  "inventory.critical": "inventory",
  "inventory.out_of_stock": "inventory",
  "quote.created": "quotes",
  "quote.approved": "quotes",
  "quote.lost": "quotes",
  "quote.multiple_lost": "quotes",
  "whatsapp.message.received": "whatsapp",
  "workflow.finished": "workflow",
  "automation.executed": "automation",
};

/** Prioridade default por tipo (pode ser sobreposta no emit). */
export const PRIORITY_BY_TYPE: Record<NexosEventType, NexosEventPriority> = {
  "customer.created": "NORMAL",
  "customer.updated": "LOW",
  "customer.inactive": "NORMAL",
  "product.created": "LOW",
  "product.updated": "LOW",
  "product.stalled": "NORMAL",
  "sale.created": "NORMAL",
  "sale.completed": "HIGH",
  "sales.decline": "HIGH",
  "sales.spike": "HIGH",
  "payment.received": "HIGH",
  "invoice.overdue": "HIGH",
  "invoice.batch_overdue": "CRITICAL",
  "inventory.critical": "HIGH",
  "inventory.out_of_stock": "CRITICAL",
  "quote.created": "NORMAL",
  "quote.approved": "HIGH",
  "quote.lost": "NORMAL",
  "quote.multiple_lost": "HIGH",
  "whatsapp.message.received": "NORMAL",
  "workflow.finished": "LOW",
  "automation.executed": "LOW",
};
