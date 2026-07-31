/**
 * Cache em memória por (companyId, periodKey).
 * TTL padrão: 5 minutos. Chave por período do dia (bucket) para
 * evitar recalcular repetidamente dentro da janela.
 *
 * Observação: em Cloudflare Workers cada instância mantém seu próprio
 * cache — o objetivo é economizar recomputação dentro da mesma
 * invocação/instância, não substituir persistência.
 */
import type { PeriodKey } from "./types";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

class InMemoryCache<T> {
  private store = new Map<string, Entry<T>>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private key(companyId: string, period: PeriodKey): string {
    return `${companyId}:${period}`;
  }

  get(companyId: string, period: PeriodKey): T | undefined {
    const k = this.key(companyId, period);
    const entry = this.store.get(k);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(k);
      return undefined;
    }
    return entry.value;
  }

  set(companyId: string, period: PeriodKey, value: T): void {
    this.store.set(this.key(companyId, period), {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(companyId: string): void {
    for (const k of Array.from(this.store.keys())) {
      if (k.startsWith(`${companyId}:`)) this.store.delete(k);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// Singleton por processo. Genérico via `unknown` — cada consumidor faz cast.
export const executiveCache = new InMemoryCache<unknown>();

export function getCached<T>(
  companyId: string,
  period: PeriodKey,
): T | undefined {
  return executiveCache.get(companyId, period) as T | undefined;
}

export function setCached<T>(
  companyId: string,
  period: PeriodKey,
  value: T,
): void {
  executiveCache.set(companyId, period, value);
}

export function invalidateCompanyCache(companyId: string): void {
  executiveCache.invalidate(companyId);
}
