/**
 * Bella Knowledge Hub — barrel público.
 *
 * Uso mínimo:
 *   import { KnowledgeManager } from "@/features/bella-ai/knowledge";
 *   const result = await KnowledgeManager.search("prazo de troca");
 *
 * A Bella deve chamar `KnowledgeManager.search(...)` ANTES de mandar a
 * pergunta ao AI Gateway e enviar somente `result.contextText`.
 */
export * from "./types";
export * from "./KnowledgeChunker";
export * from "./KnowledgeEmbeddings";
export * from "./KnowledgeSearch";
export * from "./KnowledgePermissions";
export { KnowledgeCache, makeCacheKey } from "./KnowledgeCache";
export { KnowledgeIndexer } from "./KnowledgeIndexer";
export { KnowledgeRetriever } from "./KnowledgeRetriever";
export { KnowledgeManager } from "./KnowledgeManager";
export * from "./hooks";
