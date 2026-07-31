// OFFLINE-001 — DraftStorage
// Salvamento local (localStorage) de trabalhos em andamento.
// Sem sincronização offline. Sem banco paralelo. Sem alterações no backend.

const PREFIX = "nexos:draft:";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

type Envelope<T> = {
  data: T;
  updatedAt: number;
  expiresAt: number;
  version: 1;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const draftStorage = {
  save<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): number | null {
    if (!isBrowser()) return null;
    try {
      const now = Date.now();
      const envelope: Envelope<T> = {
        data,
        updatedAt: now,
        expiresAt: now + ttlMs,
        version: 1,
      };
      window.localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
      return now;
    } catch {
      return null;
    }
  },

  load<T>(key: string): { data: T; updatedAt: number } | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const env = JSON.parse(raw) as Envelope<T>;
      if (!env || typeof env.expiresAt !== "number") {
        window.localStorage.removeItem(PREFIX + key);
        return null;
      }
      if (Date.now() > env.expiresAt) {
        window.localStorage.removeItem(PREFIX + key);
        return null;
      }
      return { data: env.data, updatedAt: env.updatedAt };
    } catch {
      return null;
    }
  },

  remove(key: string): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* noop */
    }
  },

  clearExpired(): void {
    if (!isBrowser()) return;
    try {
      const now = Date.now();
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || !k.startsWith(PREFIX)) continue;
        try {
          const raw = window.localStorage.getItem(k);
          if (!raw) {
            toRemove.push(k);
            continue;
          }
          const env = JSON.parse(raw) as Envelope<unknown>;
          if (!env || typeof env.expiresAt !== "number" || now > env.expiresAt) {
            toRemove.push(k);
          }
        } catch {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) window.localStorage.removeItem(k);
    } catch {
      /* noop */
    }
  },
};

export const DRAFT_KEYS = {
  sale: (companyId: string) => `sale:new:${companyId}`,
  purchase: (companyId: string) => `purchase:new:${companyId}`,
  product: (companyId: string) => `product:new:${companyId}`,
  customer: (companyId: string) => `customer:new:${companyId}`,
} as const;
