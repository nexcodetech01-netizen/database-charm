import { BELLA_EVENT_CATALOG } from "./catalog";
import {
  priorityFromSeverity,
  type EventPriority,
} from "./EventPriority";
import type {
  BellaEvent,
  BellaEventListener,
  BellaEventSource,
} from "./BellaEvent";
import type {
  BellaEventModule,
  BellaEventSeverity,
  BellaEventType,
} from "./BellaEventTypes";

/**
 * Entrada aceita por `emit`. Campos derivados do catálogo
 * (module/severity/title/description/recommendation/priority) são opcionais.
 */
export interface EmitInput<TPayload = Record<string, unknown>> {
  type: BellaEventType;
  tenantId: string;
  payload: TPayload;
  severity?: BellaEventSeverity;
  priority?: EventPriority;
  title?: string;
  description?: string;
  recommendation?: string;
  source?: string;
  createdAt?: Date;
  expiresAt?: Date;
  id?: string;
}

export interface BellaEventQuery {
  tenantId?: string;
  module?: BellaEventModule;
  type?: BellaEventType;
  severity?: BellaEventSeverity;
  since?: Date;
  limit?: number;
}

const MAX_BUFFER = 500;

/**
 * BellaEventEngine
 *
 * Barramento in-memory de eventos do ERP.
 *
 * Responsabilidades:
 *  - Receber eventos de qualquer emissor (detectores + fontes plugáveis).
 *  - Normalizar via catálogo (severity/priority/title/description defaults).
 *  - Manter buffer circular consultável (últimos N eventos por tenant).
 *  - Notificar listeners (Registry, Prioridades, KPIs, Insights).
 *
 * Não conhece providers, services, skills ou UI — é apenas um barramento.
 */
export class BellaEventEngine {
  private events: BellaEvent[] = [];
  private listeners = new Set<BellaEventListener>();
  private sources = new Map<string, BellaEventSource>();
  private seq = 0;

  emit<TPayload = Record<string, unknown>>(
    input: EmitInput<TPayload>,
  ): BellaEvent<TPayload> {
    const meta = BELLA_EVENT_CATALOG[input.type];
    if (!meta) {
      throw new Error(`[BellaEventEngine] Tipo de evento desconhecido: ${input.type}`);
    }
    if (!input.tenantId) {
      throw new Error(`[BellaEventEngine] tenantId é obrigatório (${input.type})`);
    }

    const severity = input.severity ?? meta.defaultSeverity;
    const event: BellaEvent<TPayload> = {
      id: input.id ?? this.nextId(),
      tenantId: input.tenantId,
      module: meta.module,
      type: input.type,
      severity,
      priority: input.priority ?? priorityFromSeverity(severity),
      title: input.title ?? meta.title,
      description: input.description ?? meta.description,
      recommendation: input.recommendation ?? meta.defaultRecommendation,
      createdAt: input.createdAt ?? new Date(),
      expiresAt: input.expiresAt,
      payload: input.payload,
      source: input.source,
    };

    this.events.unshift(event as BellaEvent);
    if (this.events.length > MAX_BUFFER) {
      this.events.length = MAX_BUFFER;
    }

    for (const listener of this.listeners) {
      try {
        listener(event as BellaEvent);
      } catch (err) {
        // Um listener quebrado nunca deve derrubar o barramento.
        console.error("[BellaEventEngine] listener falhou:", err);
      }
    }

    return event;
  }

  subscribe(listener: BellaEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(query: BellaEventQuery = {}): BellaEvent[] {
    let out = this.events;
    if (query.tenantId) out = out.filter((e) => e.tenantId === query.tenantId);
    if (query.module) out = out.filter((e) => e.module === query.module);
    if (query.type) out = out.filter((e) => e.type === query.type);
    if (query.severity) out = out.filter((e) => e.severity === query.severity);
    if (query.since) {
      const since = query.since.getTime();
      out = out.filter((e) => e.createdAt.getTime() >= since);
    }
    return typeof query.limit === "number" ? out.slice(0, query.limit) : out.slice();
  }

  clear(): void {
    this.events = [];
  }

  // ==================== Fontes externas plugáveis ====================

  async registerSource(source: BellaEventSource): Promise<void> {
    if (this.sources.has(source.id)) {
      await this.unregisterSource(source.id);
    }
    this.sources.set(source.id, source);
    await source.start((event) => {
      // Fontes externas já produzem BellaEvent completo — republicamos
      // preservando os campos, apenas garantindo `source` default.
      this.events.unshift({ ...event, source: event.source ?? source.id });
      if (this.events.length > MAX_BUFFER) this.events.length = MAX_BUFFER;
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error("[BellaEventEngine] listener falhou:", err);
        }
      }
    });
  }

  async unregisterSource(id: string): Promise<void> {
    const source = this.sources.get(id);
    if (!source) return;
    await source.stop();
    this.sources.delete(id);
  }

  listSources(): string[] {
    return Array.from(this.sources.keys());
  }

  private nextId(): string {
    this.seq += 1;
    return `bella-evt-${Date.now().toString(36)}-${this.seq}`;
  }
}

/**
 * Singleton para uso em todo o app. Todos os consumidores devem importar
 * `bellaEventEngine` — nunca instanciar cópias — para compartilhar o fluxo.
 */
export const bellaEventEngine = new BellaEventEngine();
