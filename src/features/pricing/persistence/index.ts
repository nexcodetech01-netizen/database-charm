/**
 * Persistence Layer — API pública
 * ================================
 * Exporta:
 *   - Interfaces (contratos) — para injeção onde o consumidor precisar.
 *   - Errors.
 *   - Factory in-memory (útil em testes, seeds, previews sem banco).
 *
 * NÃO exporta a implementação Supabase daqui — ela vive em `./supabase.server.ts`
 * e só pode ser importada de contexto server-only (bundler enforcement).
 */

export * from "./types";
export * from "./errors";
export * from "./in-memory";
