/**
 * Bella Automations — tipos
 *
 * Camada de configuração de automações. NENHUMA regra de negócio vive aqui:
 * um `TriggerType` descreve o evento que dispara a automação, `Condition[]`
 * filtra pelo payload do evento e cada `AutomationActionDef` referencia uma
 * Skill já registrada no `BellaSkillRegistry` (single-source of business
 * logic). O `AutomationEngine` apenas orquestra: evento → condições →
 * ações via `BellaActionEngine`.
 */

export type AutomationTriggerType =
  // Vendas / CRM
  | "sale.completed"
  | "customer.created"
  | "customer.inactive"          // scheduler: cliente sem compra há N dias
  // Financeiro
  | "invoice.overdue"            // scheduler: cobrança vencida
  | "payment.received"
  // Estoque
  | "stock.critical"             // scheduler: estoque abaixo do mínimo
  // Agenda
  | "appointment.upcoming"       // scheduler: agendamento em X min
  // Genérico
  | "schedule.cron";             // execução recorrente pura

/** JSON serializável — usado em tudo que atravessa server functions. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };
export type JsonObject = { [k: string]: JsonValue };

export interface AutomationTriggerConfig {
  /** Para triggers baseados em tempo — cron 5-field. */
  cron?: string;
  /** Janela em dias para inactivity / overdue detection. */
  windowDays?: number;
  /** Overrides livres por tipo. */
  extras?: JsonObject;
}

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "exists";

export interface AutomationCondition {
  /** Caminho dot-notation dentro do payload do evento (ex.: "sale.total"). */
  path: string;
  operator: ConditionOperator;
  value?: JsonValue;
}

export interface AutomationActionDef {
  /** ID de uma Skill registrada no BellaSkillRegistry. */
  skillId: string;
  /** Parâmetros estáticos do payload da Skill. */
  params?: JsonObject;
  /**
   * Mapeamento de campos do evento para o payload da Skill.
   * Ex.: `{ customerId: "customer.id" }` copia event.customer.id
   * para payload.customerId no momento da execução.
   */
  paramsFromEvent?: Record<string, string>;
  /** Rótulo humano usado nos logs. */
  label?: string;
}

export interface Automation {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  triggerConfig: AutomationTriggerConfig;
  conditions: AutomationCondition[];
  actions: AutomationActionDef[];
  templateId: string | null;
  lastRunAt: string | null;
  lastRunStatus: AutomationRunStatus | null;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export type AutomationRunStatus = "success" | "error" | "skipped" | "partial";

export interface AutomationActionOutcome {
  skillId: string;
  label: string;
  ok: boolean;
  message: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  companyId: string;
  triggerType: AutomationTriggerType;
  triggerPayload: JsonObject;
  status: AutomationRunStatus;
  durationMs: number | null;
  actionsSummary: AutomationActionOutcome[];
  error: string | null;
  createdAt: string;
}

/** Evento entregue ao engine no momento do disparo. */
export interface AutomationEvent<T = Record<string, unknown>> {
  companyId: string;
  triggerType: AutomationTriggerType;
  payload: T;
  /** Origem do evento (útil para logging). */
  source?: string;
}
