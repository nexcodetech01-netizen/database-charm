/**
 * KnowledgeRetriever — camada de leitura (busca + listagem).
 *
 * Aplica cache LRU antes de chamar o server function de busca. O cache é
 * invalidado pelo `KnowledgeIndexer` sempre que um documento muda.
 */
import { searchKnowledge, listKnowledgeDocuments } from "@/lib/knowledge.functions";
import { KnowledgeCache, makeCacheKey } from "./KnowledgeCache";
import type { KnowledgeDocument, KnowledgeSearchResult } from "./types";

export interface RetrieveOptions {
  topK?: number;
  minSimilarity?: number;
  useCache?: boolean;
  companyId?: string; // usado para chave de cache
}

export const KnowledgeRetriever = {
  async list(): Promise<KnowledgeDocument[]> {
    return listKnowledgeDocuments();
  },
  async search(query: string, options: RetrieveOptions = {}): Promise<KnowledgeSearchResult> {
    const topK = options.topK ?? 5;
    const useCache = options.useCache ?? true;
    const cacheKey = options.companyId
      ? makeCacheKey(options.companyId, query, topK)
      : null;
    if (useCache && cacheKey) {
      const hit = KnowledgeCache.get(cacheKey);
      if (hit) return hit;
    }
    const result = await searchKnowledge({
      data: {
        query,
        topK,
        minSimilarity: options.minSimilarity,
      },
    });
    if (useCache && cacheKey) {
      KnowledgeCache.set(cacheKey, options.companyId ?? "unknown", result);
    }
    return result;
  },
};
