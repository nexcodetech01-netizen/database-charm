/**
 * EventQueue — fila FIFO in-memory, concorrência 1 por instância,
 * com dedupe curto (janela em memória) para evitar processamento
 * duplicado quando o mesmo evento chega duas vezes muito rápido.
 *
 * A idempotência DURÁVEL é garantida pela chave única no banco
 * (`nexos_event_log_dedupe_idx`). Este dedupe é apenas otimização.
 */
import type { NexosEvent } from "./types";

type Handler = (evt: NexosEvent) => Promise<void>;

interface QueueItem {
  event: NexosEvent;
  attempt: number;
}

const DEDUPE_WINDOW_MS = 30_000;
const MAX_ATTEMPTS = 3;

export class EventQueue {
  private items: QueueItem[] = [];
  private processing = false;
  private recent = new Map<string, number>(); // dedupeKey → timestamp
  private lastError: string | null = null;
  private processedCount = 0;
  private failedCount = 0;

  constructor(private readonly handler: Handler) {}

  private dedupeKey(evt: NexosEvent): string {
    return evt.dedupeKey
      ? `${evt.companyId}::${evt.type}::${evt.dedupeKey}`
      : `${evt.companyId}::${evt.id}`;
  }

  enqueue(evt: NexosEvent): boolean {
    const key = this.dedupeKey(evt);
    const now = Date.now();
    const seenAt = this.recent.get(key);
    if (seenAt && now - seenAt < DEDUPE_WINDOW_MS) return false;
    this.recent.set(key, now);
    // GC leve
    if (this.recent.size > 500) {
      for (const [k, t] of this.recent) {
        if (now - t > DEDUPE_WINDOW_MS) this.recent.delete(k);
      }
    }
    this.items.push({ event: evt, attempt: 0 });
    void this.drain();
    return true;
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.items.length > 0) {
        const item = this.items.shift()!;
        try {
          await this.handler(item.event);
          this.processedCount += 1;
        } catch (err) {
          item.attempt += 1;
          this.lastError = err instanceof Error ? err.message : String(err);
          if (item.attempt < MAX_ATTEMPTS) {
            // reenfileira ao fim, sem bloquear.
            this.items.push(item);
          } else {
            this.failedCount += 1;
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  snapshot() {
    return {
      queued: this.items.length,
      processing: this.processing,
      processed: this.processedCount,
      failed: this.failedCount,
      lastError: this.lastError,
    };
  }
}
