/**
 * Bella Contadora — Recorder de telemetria (Sprint 7.4).
 *
 * Buffer circular em memória. Não persiste nada, não escreve em banco,
 * não registra valores de negócio e não altera nenhum resultado: apenas
 * mede tempo, cache e quantidade de providers.
 */
import type {
  BellaCacheOutcome,
  BellaTelemetryEvent,
  BellaTelemetryKind,
  BellaTelemetryKindMetrics,
  BellaTelemetrySnapshot,
} from "./types";

const MAX_EVENTS = 200;

/** Relógio monotônico quando disponível. */
export function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Higieniza o rótulo: remove dígitos, moeda e qualquer sequência que possa
 * carregar valor de negócio. Sobra apenas um identificador técnico.
 */
export function sanitizeLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z_.\-\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "operacao"
  );
}

export interface RecordInput {
  kind: BellaTelemetryKind;
  label: string;
  durationMs: number;
  cache?: BellaCacheOutcome;
  providers?: number;
  ok?: boolean;
}

class BellaTelemetryRecorder {
  private events: BellaTelemetryEvent[] = [];
  private seq = 0;
  private enabled = true;

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  record(input: RecordInput): BellaTelemetryEvent | null {
    if (!this.enabled) return null;
    this.seq += 1;
    const event: BellaTelemetryEvent = {
      seq: this.seq,
      kind: input.kind,
      label: sanitizeLabel(input.label),
      durationMs: Math.max(0, Math.round(input.durationMs * 1000) / 1000),
      cache: input.cache ?? "none",
      providers: Math.max(0, input.providers ?? 0),
      ok: input.ok ?? true,
      at: Date.now(),
    };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
    return event;
  }

  /** Mede uma operação assíncrona sem alterar o resultado nem engolir erro. */
  async measure<T>(
    input: Omit<RecordInput, "durationMs" | "ok">,
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = now();
    try {
      const result = await fn();
      this.record({ ...input, durationMs: now() - started, ok: true });
      return result;
    } catch (error) {
      this.record({ ...input, durationMs: now() - started, ok: false });
      throw error;
    }
  }

  list(kind?: BellaTelemetryKind): BellaTelemetryEvent[] {
    return kind ? this.events.filter((e) => e.kind === kind) : [...this.events];
  }

  snapshot(): BellaTelemetrySnapshot {
    const byKind = new Map<BellaTelemetryKind, BellaTelemetryKindMetrics>();
    let totalMs = 0;
    let hits = 0;
    let misses = 0;

    for (const event of this.events) {
      totalMs += event.durationMs;
      if (event.cache === "hit") hits += 1;
      if (event.cache === "miss") misses += 1;

      const current: BellaTelemetryKindMetrics = byKind.get(event.kind) ?? {
        kind: event.kind,
        count: 0,
        averageMs: 0,
        maxMs: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0,
        failures: 0,
        providers: 0,
      };
      const sum = current.averageMs * current.count + event.durationMs;
      current.count += 1;
      current.averageMs = Math.round((sum / current.count) * 1000) / 1000;
      current.maxMs = Math.max(current.maxMs, event.durationMs);
      current.cacheHits += event.cache === "hit" ? 1 : 0;
      current.cacheMisses += event.cache === "miss" ? 1 : 0;
      current.failures += event.ok ? 0 : 1;
      current.providers += event.providers;
      const seen = current.cacheHits + current.cacheMisses;
      current.cacheHitRate = seen === 0 ? 0 : Math.round((current.cacheHits / seen) * 100) / 100;
      byKind.set(event.kind, current);
    }

    const observed = hits + misses;
    return {
      events: [...this.events],
      byKind: [...byKind.values()],
      totalEvents: this.events.length,
      averageMs:
        this.events.length === 0 ? 0 : Math.round((totalMs / this.events.length) * 1000) / 1000,
      cacheHitRate: observed === 0 ? 0 : Math.round((hits / observed) * 100) / 100,
    };
  }

  metricsFor(kind: BellaTelemetryKind): BellaTelemetryKindMetrics | null {
    return this.snapshot().byKind.find((m) => m.kind === kind) ?? null;
  }

  reset(): void {
    this.events = [];
    this.seq = 0;
    this.enabled = true;
  }
}

/** Instância única — leitura/diagnóstico apenas. */
export const bellaTelemetry = new BellaTelemetryRecorder();
