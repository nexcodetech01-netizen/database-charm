import { bellaEventEngine } from "./BellaEventEngine";
import { comparePriority } from "./EventPriority";
import { saveNotification } from "./persistence.functions";
export function deriveEventKey(event) {
    const raw = event.payload?.entityId;
    const entityId = raw !== undefined && raw !== null ? String(raw) : "_";
    return `${event.tenantId}::${event.type}::${entityId}`;
}
const SEVERITY_ORDER = { critical: 3, warning: 2, success: 1, info: 0 };
export class BellaEventRegistry {
    engine;
    sweepIntervalMs;
    active = new Map();
    log = [];
    listeners = new Set();
    unsubscribe = null;
    sweepTimer = null;
    constructor(engine = bellaEventEngine, sweepIntervalMs = 60000) {
        this.engine = engine;
        this.sweepIntervalMs = sweepIntervalMs;
    }
    start() {
        if (this.unsubscribe)
            return;
        this.unsubscribe = this.engine.subscribe((event) => this.upsert(event));
        if (typeof setInterval === "function" && this.sweepIntervalMs > 0) {
            this.sweepTimer = setInterval(() => this.sweepExpired(), this.sweepIntervalMs);
        }
    }
    stop() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.sweepTimer) {
            clearInterval(this.sweepTimer);
            this.sweepTimer = null;
        }
    }
    upsert(event) {
        const key = deriveEventKey(event);
        const existing = this.active.get(key);
        if (existing) {
            const merged = {
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
    resolve(key, reason) {
        const event = this.active.get(key);
        if (!event)
            return null;
        const resolved = { ...event, resolvedAt: new Date() };
        this.active.delete(key);
        this.record("resolved", resolved, key, reason);
        return resolved;
    }
    resolveByPayload(input, reason) {
        return this.resolve(deriveEventKey(input), reason);
    }
    sweepExpired(now = new Date()) {
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
    listActive(query = {}) {
        const out = [];
        for (const event of this.active.values()) {
            if (query.tenantId && event.tenantId !== query.tenantId)
                continue;
            if (query.module && event.module !== query.module)
                continue;
            out.push(event);
        }
        return out;
    }
    getTopPriorities(tenantId, n = 4) {
        return this.listActive({ tenantId })
            .sort((a, b) => {
            const byPriority = comparePriority(a.priority, b.priority);
            if (byPriority !== 0)
                return byPriority;
            const bySeverity = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
            if (bySeverity !== 0)
                return bySeverity;
            return b.createdAt.getTime() - a.createdAt.getTime();
        })
            .slice(0, n);
    }
    getLog(limit = 200) {
        return this.log.slice(-limit);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    clear() {
        this.active.clear();
        this.log = [];
    }
    record(action, event, key, reason) {
        const entry = { action, eventId: event.id, key, at: new Date(), reason };
        this.log.push(entry);
        if (this.log.length > 500)
            this.log.splice(0, this.log.length - 500);
        // CORREÇÃO: Persistência só roda no SERVIDOR (node/workers) via chamada direta.
        // No NAVEGADOR (cliente), a persistência é feita via hook no componente Topbar.
        if (action === "created" && typeof window === "undefined") {
            const payload = event.payload;
            saveNotification({
                data: {
                    companyId: event.tenantId,
                    eventType: event.type,
                    title: event.title,
                    message: event.description,
                    referenceId: payload?.entityId || payload?.ticketId || null,
                    metadata: payload
                }
            }).catch((err) => {
                console.warn("[BellaEventRegistry-Server] Falha na persistência:", err);
            });
        }
        if (typeof console !== "undefined" && typeof console.debug === "function") {
            console.debug("[bella-events]", action, event.type, event.id);
        }
        for (const l of this.listeners) {
            try {
                l(entry, event);
            }
            catch (err) {
                console.error("[BellaEventRegistry] listener falhou:", err);
            }
        }
    }
}
export const bellaEventRegistry = new BellaEventRegistry();
