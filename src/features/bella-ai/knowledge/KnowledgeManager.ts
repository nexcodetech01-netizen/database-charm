/**
 * KnowledgeManager — fachada única do Bella Knowledge Hub.
 *
 * Todo consumidor (UI, futuras skills, integrações) fala com este objeto.
 * Ele orquestra Indexer + Retriever + Cache, garante que documentos completos
 * NUNCA sejam expostos ao modelo e centraliza o contrato de RAG.
 */
import { KnowledgeIndexer } from "./KnowledgeIndexer";
import { KnowledgeRetriever, type RetrieveOptions } from "./KnowledgeRetriever";
import { KnowledgeCache } from "./KnowledgeCache";
import type {
  KnowledgeDocStatus,
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeUploadInput,
} from "./types";

export const KnowledgeManager = {
  /* ---------- Escrita ---------- */
  upload: (input: KnowledgeUploadInput) => KnowledgeIndexer.upload(input),
  reindex: (id: string, content: string) => KnowledgeIndexer.reindex(id, content),
  remove: (id: string, companyId: string) => KnowledgeIndexer.remove(id, companyId),
  setStatus: (id: string, status: KnowledgeDocStatus) =>
    KnowledgeIndexer.setStatus(id, status),

  /* ---------- Leitura ---------- */
  list: (): Promise<KnowledgeDocument[]> => KnowledgeRetriever.list(),
  search: (query: string, options?: RetrieveOptions): Promise<KnowledgeSearchResult> =>
    KnowledgeRetriever.search(query, options),

  /* ---------- Cache ---------- */
  invalidateCache: (companyId: string) => KnowledgeCache.invalidateCompany(companyId),
  cacheSize: () => KnowledgeCache.size(),
};

export type { KnowledgeUploadInput, KnowledgeDocument, KnowledgeSearchResult };
