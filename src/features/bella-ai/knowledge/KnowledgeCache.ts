/**
 * KnowledgeCache — cache LRU em memória (client + server) para respostas
 * de busca semântica. Chave: `${companyId}::${normalizedQuery}::topK`.
 *
 * Invalidado automaticamente por `invalidateCompany(companyId)` quando um
 * documento é criado, reindexado, atualizado ou removido.
 */

import type { KnowledgeSearchResult } from "./types";

interface Entry {
  value: KnowledgeSearchResult;
  companyId: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_ENTRIES = 200;

const store = new Map<string, Entry>();

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function makeCacheKey(companyId: string, query: string, topK: number): string {
  return `${companyId}::${normalize(query)}::${topK}`;
}

export const KnowledgeCache = {
  get(key: string): KnowledgeSearchResult | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    // Marca como MRU
    store.delete(key);
    store.set(key, entry);
    return { ...entry.value, cacheHit: true };
  },
  set(key: string, companyId: string, value: KnowledgeSearchResult, ttlMs = DEFAULT_TTL_MS): void {
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest) store.delete(oldest);
    }
    store.set(key, { value, companyId, expiresAt: Date.now() + ttlMs });
  },
  invalidateCompany(companyId: string): void {
    for (const [key, entry] of store.entries()) {
      if (entry.companyId === companyId) store.delete(key);
    }
  },
  clear(): void {
    store.clear();
  },
  size(): number {
    return store.size;
  },
};
