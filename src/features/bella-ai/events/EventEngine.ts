/**
 * EventEngine — fachada única do Bella Event Engine.
 *
 * Fluxo: `emit()` → validação → dedupe curto → fila assíncrona
 * → Dispatcher (Workflow/Automação/Skill/Notificação) → History
 * → persistência (via server function, chamada pelo emissor server-side
 *   quando aplicável).
 *
 * Regras invioláveis:
 *  - Nenhuma Skill/Service/Provider alterado.
 *  - Toda execução delega ao Workflow Engine, Automation Engine ou
 *    BellaSkillRegistry (single source of business logic).
 *  - Idempotência: `dedupeKey` + índice único no banco.
 */
import { EventDispatcher } from "./EventDispatcher";
import { EventHistory } from "./EventHistory";
import { EventQueue } from "./EventQueue";
import {
  MODULE_BY_TYPE,
  PRIORITY_BY_TYPE,
  type EmitNexosEventInput,
  type NexosEvent,
  type NexosEventFilter,
  type NexosEventType,
} from "./types";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `nxe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

class NexosEventEngineImpl {
  private queue: EventQueue;

  constructor() {
    this.queue = new EventQueue(async (evt) => {
      EventHistory.update(evt.id, { status: "processing" });
      const result = await EventDispatcher.dispatch(evt);
      EventHistory.update(evt.id, { status: result.status });
    });
  }

  emit<TPayload = Record<string, unknown>>(input: EmitNexosEventInput<TPayload>): NexosEvent<TPayload> {
    if (!input.companyId) throw new Error("[NexosEventEngine] companyId obrigatório");
    if (!input.type) throw new Error("[NexosEventEngine] type obrigatório");

    const evt: NexosEvent<TPayload> = {
      id: newId(),
      companyId: input.companyId,
      userId: input.userId ?? null,
      type: input.type,
      module: input.module ?? MODULE_BY_TYPE[input.type],
      priority: input.priority ?? PRIORITY_BY_TYPE[input.type] ?? "NORMAL",
      source: input.source,
      dedupeKey: input.dedupeKey,
      payload: input.payload,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    EventHistory.push(evt as NexosEvent);
    this.queue.enqueue(evt as NexosEvent);
    return evt;
  }

  list(f: NexosEventFilter = {}): NexosEvent[] {
    return EventHistory.list(f);
  }

  snapshot() {
    return this.queue.snapshot();
  }

  subscribe(listener: (evt: NexosEvent) => void): () => void {
    return EventHistory.subscribe(listener);
  }

  /** Somente para testes/reset em dev. */
  __reset(): void {
    EventHistory.clear();
  }

  supportedTypes(): NexosEventType[] {
    return Object.keys(MODULE_BY_TYPE) as NexosEventType[];
  }
}

export const NexosEventEngine = new NexosEventEngineImpl();
