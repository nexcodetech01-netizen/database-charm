import { bellaEventEngine } from "./BellaEventEngine";
import { comparePriority } from "./EventPriority";
/**
 * Deriva a chave estável usada para deduplicar o mesmo "fato".
 * Prioriza `payload.entityId` (ex.: productId, customerId, invoiceId).
 * Sem entityId, cai para o tipo + tenant — apropriado para eventos globais
 * como `finance.cashflow.negative`.
 */
export function deriveEventKey(event) {
    const raw = event.payload?.entityId;
    const entityId = raw !== undefined && raw !== null ? String(raw) : "_";
    return `${event.tenantId}::${event.type}::${entityId}`;
}
const SEVERITY_ORDER = { critical: 3, warning: 2, success: 1, info: 0 };
/**
 * BellaEventRegistry
 *
 * Mantém o **estado ativo** dos eventos — o que ainda é verdade agora.
 * O `BellaEventEngine` é o barramento pub/sub; o Registry é a projeção
 * consultável usada pela Home (top-N prioridades) e pelo InsightsEngine.
 *
 * Responsabilidades:
 *  - Dedup por chave estável.
 *  - Ciclo de vida: create/update/resolve/expire com log interno.
 *  - Sweep periódico para eventos com `expiresAt`.
 *  - Consultas por tenant/módulo + top-N por prioridade.
 */
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
    /** Começa a escutar o engine e a varrer expirações periodicamente. */
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
    /**
     * Insere ou atualiza o evento pela chave estável. Retorna o evento final
     * (com `createdAt` original preservado em caso de update).
     */
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
    /** Resolve o evento correspondente à chave, se ainda ativo. */
    resolve(key, reason) {
        const event = this.active.get(key);
        if (!event)
            return null;
        const resolved = { ...event, resolvedAt: new Date() };
        this.active.delete(key);
        this.record("resolved", resolved, key, reason);
        return resolved;
    }
    /** Atalho: resolve pelo `tenantId + type + entityId` do payload. */
    resolveByPayload(input, reason) {
        return this.resolve(deriveEventKey(input), reason);
    }
    /** Remove eventos cujo `expiresAt` já passou. Retorna quantos expiraram. */
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
    /** Lista eventos ativos, opcionalmente filtrados. */
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
    /**
     * Top-N prioridades ativas para exibir na Home.
     * Ordenação: prioridade DESC → severidade DESC → createdAt DESC.
     */
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
    /** Diagnóstico: histórico das últimas N transições (default 200). */
    getLog(limit = 200) {
        return this.log.slice(-limit);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /** Zera estado — usado por testes e ferramentas de diagnóstico. */
    clear() {
        this.active.clear();
        this.log = [];
    }
    record(action, event, key, reason) {
        const entry = { action, eventId: event.id, key, at: new Date(), reason };
        this.log.push(entry);
        if (this.log.length > 500)
            this.log.splice(0, this.log.length - 500);
        // Log operacional silencioso — sem I/O externo.
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
/** Singleton acoplado ao `bellaEventEngine` padrão. `start()` sob demanda. */
export const bellaEventRegistry = new BellaEventRegistry();
