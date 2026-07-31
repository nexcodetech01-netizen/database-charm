/**
 * Bella Knowledge Hub — tipos públicos.
 *
 * Regras:
 *   - Nenhum consumidor toca no banco direto: sempre via KnowledgeManager.
 *   - Documento completo nunca é enviado à IA; apenas trechos relevantes.
 */

export type KnowledgeFileType = "pdf" | "docx" | "txt" | "md" | "text";
export type KnowledgeDocStatus = "active" | "inactive";
export type KnowledgeIndexStatus = "pending" | "indexing" | "indexed" | "error";

export interface KnowledgeDocument {
  id: string;
  companyId: string;
  title: string;
  category: string | null;
  author: string | null;
  version: string;
  tags: string[];
  status: KnowledgeDocStatus;
  fileType: KnowledgeFileType;
  fileName: string | null;
  fileSize: number | null;
  contentHash: string | null;
  chunkCount: number;
  indexStatus: KnowledgeIndexStatus;
  indexError: string | null;
  indexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeUploadInput {
  title: string;
  category?: string | null;
  author?: string | null;
  version?: string;
  tags?: string[];
  fileType?: KnowledgeFileType;
  fileName?: string | null;
  fileSize?: number | null;
  content: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
}

export interface KnowledgeSearchHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentCategory: string | null;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface KnowledgeSearchResult {
  query: string;
  hits: KnowledgeSearchHit[];
  contextText: string;
  durationMs: number;
  cacheHit: boolean;
}

export interface KnowledgeStats {
  totalDocuments: number;
  activeDocuments: number;
  totalChunks: number;
  indexedDocuments: number;
  pendingDocuments: number;
  errorDocuments: number;
}

export interface KnowledgeQueryLog {
  id: string;
  query: string;
  topScore: number | null;
  documentIds: string[];
  durationMs: number | null;
  cacheHit: boolean;
  createdAt: string;
}
