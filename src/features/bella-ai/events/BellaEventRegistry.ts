import { bellaEventEngine, type BellaEventEngine } from "./BellaEventEngine";
import { comparePriority } from "./EventPriority";
import type { BellaEvent } from "./BellaEvent";
import type { BellaEventModule } from "./BellaEventTypes";
import { saveNotification } from "./persistence.functions";

export type RegistryAction = "created" | "updated" | "resolved" | "expired";

export interface RegistryLogEntry {
  action: RegistryAction;
  eventId: string;
  key: string;
  at: Date;
  reason?: string;
}

export type RegistryListener = (entry: RegistryLogEntry, event: BellaEvent) => void;

export function deriveEventKey(event: Pick<BellaEvent, "tenantId" | "type" | "payload">): string {
  const raw = (event.payload as { entityId?: string | number } | null | undefined)?.entityId;
  const entityId = raw !== undefined && raw !== null ? String(raw) : "_";
  return `${event.tenantId}::${event.type}::${entityId}`;
}

const SEVERITY_ORDER = { critical: 3, warning: 2, success: 1, info: 0 } as const;

export class BellaEventRegistry {
  private active = new Map<string, BellaEvent>();
  private log: RegistryLogEntry[] = [];
  private listeners = new Set<RegistryListener>();
  private unsubscribe: (() => void) | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly engine: BellaEventEngine = bellaEventEngine,
    private readonly sweepIntervalMs = 60_000,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.engine.subscribe((event) => this.upsert(event));
    if (typeof setInterval === "function" && this.sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => this.sweepExpired(), this.sweepIntervalMs);
    }
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  upsert(event: BellaEvent): BellaEvent {
    const key = deriveEventKey(event);
    const existing = this.active.get(key);
    if (existing) {
      const merged: BellaEvent = {
        ...existing,
        ...event,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      };
      this.active.set(key, merged);
      this.record("updated", merged, key);
      return merged;
    }
    this.active.set(key, event);
    this.record("created", event, key);
    return event;
  }

  resolve(key: string, reason?: string): BellaEvent | null {
    const event = this.active.get(key);
    if (!event) return null;
    const resolved: BellaEvent = { ...event, resolvedAt: new Date() };
    this.active.delete(key);
    this.record("resolved", resolved, key, reason);
    return resolved;
  }

  resolveByPayload(input: Pick<BellaEvent, "tenantId" | "type" | "payload">, reason?: string): BellaEvent | null {
    return this.resolve(deriveEventKey(input), reason);
  }

  sweepExpired(now: Date = new Date()): number {
    let count = 0;
    for (const [key, event] of this.active) {
      if (event.expiresAt && event.expiresAt.getTime() <= now.getTime()) {
        this.active.delete(key);
        this.record("expired", { ...event, resolvedAt: now }, key);
        count += 1;
      }
    }
    return count;
  }

  listActive(query: { tenantId?: string; module?: BellaEventModule } = {}): BellaEvent[] {
    const out: BellaEvent[] = [];
    for (const event of this.active.values()) {
      if (query.tenantId && event.tenantId !== query.tenantId) continue;
      if (query.module && event.module !== query.module) continue;
      out.push(event);
    }
    return out;
  }

  getTopPriorities(tenantId: string, n = 4): BellaEvent[] {
    return this.listActive({ tenantId })
      .sort((a, b) => {
        const byPriority = comparePriority(a.priority, b.priority);
        if (byPriority !== 0) return byPriority;
        const bySeverity = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
        if (bySeverity !== 0) return bySeverity;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, n);
  }

  getLog(limit = 200): RegistryLogEntry[] {
    return this.log.slice(-limit);
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.active.clear();
    this.log = [];
  }

  private record(action: RegistryAction, event: BellaEvent, key: string, reason?: string): void {
    const entry: RegistryLogEntry = { action, eventId: event.id, key, at: new Date(), reason };
    this.log.push(entry);
    if (this.log.length > 500) this.log.splice(0, this.log.length - 500);

    // CORREÇÃO: Persistência só roda no SERVIDOR (node/workers) via chamada direta.
    // No NAVEGADOR (cliente), a persistência é feita via hook no componente Topbar.
    if (action === "created" && typeof window === "undefined") {
      const payload = event.payload as any;
      saveNotification({
        data: {
          companyId: event.tenantId,
          eventType: event.type,
          title: event.title,
          message: event.description,
          referenceId: payload?.entityId || payload?.ticketId || null,
          metadata: payload
        }
      }).catch((err: any) => {
        console.warn("[BellaEventRegistry-Server] Falha na persistência:", err);
      });
    }

    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[bella-events]", action, event.type, event.id);
    }
    for (const l of this.listeners) {
      try {
        l(entry, event);
      } catch (err) {
        console.error("[BellaEventRegistry] listener falhou:", err);
      }
    }
  }
}

export const bellaEventRegistry = new BellaEventRegistry();
