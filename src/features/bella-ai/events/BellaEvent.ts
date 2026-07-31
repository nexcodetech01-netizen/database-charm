/**
 * Bella IA — Modelo canônico de evento
 *
 * Um `BellaEvent` representa um fato observado pelo ERP em um momento
 * específico. Ele é totalmente desacoplado da UI, de providers e de
 * skills: qualquer camada (detectores, webhooks, cron, testes) pode
 * emiti-lo, e qualquer consumidor pode reagir sem conhecer a fonte.
 */

import type { EventPriority } from "./EventPriority";
import type {
  BellaEventModule,
  BellaEventSeverity,
  BellaEventType,
} from "./BellaEventTypes";

export interface BellaEvent<TPayload = Record<string, unknown>> {
  /** Identificador único gerado pelo engine. */
  id: string;
  /** Tenant/empresa a que o evento pertence — obrigatório para isolamento. */
  tenantId: string;
  module: BellaEventModule;
  type: BellaEventType;
  severity: BellaEventSeverity;
  priority: EventPriority;
  title: string;
  description: string;
  /**
   * Texto curto de recomendação embutido (uma frase). A recomendação rica
   * acionável continua sendo produzida pelo `BellaRecommendationEngine`
   * — este campo existe para consumo direto em cartões compactos.
   */
  recommendation?: string;
  /** Dados contextuais brutos do módulo emissor. */
  payload: TPayload;
  createdAt: Date;
  updatedAt?: Date;
  /** Quando definido, o Registry expira o evento automaticamente. */
  expiresAt?: Date;
  /** Preenchido pelo Registry quando o evento é resolvido. */
  resolvedAt?: Date;
  /** Fonte lógica: `"detector:finance.cashflow"`, `"webhook:asaas"`, etc. */
  source?: string;
}

/**
 * Recomendação acionável gerada pelo `BellaRecommendationEngine`.
 * O `actionId` referencia declarativamente uma skill — a execução
 * é responsabilidade de camadas superiores.
 */
export interface BellaRecommendation {
  id: string;
  eventId: string;
  module: BellaEventModule;
  severity: BellaEventSeverity;
  priority: EventPriority;
  title: string;
  reason: string;
  actionLabel: string;
  actionId?: string;
  createdAt: Date;
}

export type BellaEventListener = (event: BellaEvent) => void;

/**
 * Contrato para fontes externas plugáveis (Realtime/Webhooks/Filas/Cron).
 * A implementação concreta é responsabilidade de cada adapter.
 */
export interface BellaEventSource {
  id: string;
  start(emit: (event: BellaEvent) => void): void | Promise<void>;
  stop(): void | Promise<void>;
}
