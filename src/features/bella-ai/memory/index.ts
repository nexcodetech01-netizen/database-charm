/**
 * Bella Memory — camada desacoplada de memória de curto prazo.
 *
 * Escopo:
 *  - Contexto conversacional em memória (tenant + user).
 *  - Entidades ativas (cliente/produto/orçamento/venda).
 *  - Parâmetros coletados e campos pendentes.
 *  - Expiração automática por inatividade.
 *
 * Fora de escopo (não implementar aqui):
 *  - Persistência, embeddings, RAG, aprendizado do usuário.
 *  - Alteração de Skills, Services, Providers ou Regras de Negócio.
 */

export * from "./MemoryTypes";
export * from "./MemoryValidator";
export * from "./MemorySerializer";
export {
  createMemory,
  applyPatch,
  clearMemory,
  isExpired,
  touch,
  DEFAULT_TTL_MS,
} from "./BellaMemory";
export { BellaMemoryManager, bellaMemoryManager } from "./BellaMemoryManager";
