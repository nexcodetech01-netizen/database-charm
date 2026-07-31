/**
 * EventHistory — buffer in-memory + ponte para a persistência
 * (`nexos_event_log`). As leituras reais em produção usam as server
 * functions em `src/lib/nexos-events.functions.ts`; este módulo
 * é a memória viva do runtime do cliente (últimos eventos vistos).
 */
import { applyFilter } from "./EventFilter";
import type { NexosEvent, NexosEventFilter } from "./types";

const MAX = 300;

class EventHistoryImpl {
  private buffer: NexosEvent[] = [];
  private listeners = new Set<(evt: NexosEvent) => void>();

  push(evt: NexosEvent): void {
    this.buffer.unshift(evt);
    if (this.buffer.length > MAX) this.buffer.length = MAX;
    for (const l of this.listeners) {
      try {
        l(evt);
      } catch {
        /* listener isolado */
      }
    }
  }

  update(id: string, patch: Partial<NexosEvent>): void {
    const idx = this.buffer.findIndex((e) => e.id === id);
    if (idx >= 0) this.buffer[idx] = { ...this.buffer[idx], ...patch };
  }

  list(f: NexosEventFilter = {}): NexosEvent[] {
    return applyFilter(this.buffer, f);
  }

  subscribe(listener: (evt: NexosEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.buffer = [];
  }
}

export const EventHistory = new EventHistoryImpl();
