/**
 * PDV — Cache de busca de produtos (Sprint 2.8).
 *
 * Objetivo único: evitar consultas repetidas ao digitar/bipar o mesmo termo.
 * Não altera a estratégia de busca (`applyProductSearch`, SEARCH-001) nem
 * qualquer regra de produto — é só memória de curto prazo em memória local.
 */
import type { PDVProductOption } from "../types";

/** Termo normalizado usado como chave de cache. */
export function searchCacheKey(term: string): string {
  return (term ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export type SearchCache<T> = {
  get: (term: string) => T | undefined;
  set: (term: string, value: T) => void;
  has: (term: string) => boolean;
  clear: () => void;
  size: () => number;
};

export type SearchCacheOptions = {
  /** Validade de cada entrada (ms). */
  ttlMs?: number;
  /** Número máximo de termos guardados (descarte do mais antigo). */
  max?: number;
  /** Relógio injetável (testes). */
  now?: () => number;
};

/** Cache LRU simples com expiração por tempo. */
export function createSearchCache<T>({
  ttlMs = 30_000,
  max = 40,
  now = () => Date.now(),
}: SearchCacheOptions = {}): SearchCache<T> {
  const entries = new Map<string, { value: T; at: number }>();

  function read(key: string) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now() - entry.at > ttlMs) {
      entries.delete(key);
      return undefined;
    }
    // LRU: reposiciona no fim
    entries.delete(key);
    entries.set(key, entry);
    return entry;
  }

  return {
    get: (term) => read(searchCacheKey(term))?.value,
    has: (term) => read(searchCacheKey(term)) !== undefined,
    set(term, value) {
      const key = searchCacheKey(term);
      entries.delete(key);
      entries.set(key, { value, at: now() });
      while (entries.size > max) {
        const oldest = entries.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear: () => entries.clear(),
    size: () => entries.size,
  };
}

/** Produto retornado pela busca, com os campos usados no casamento exato. */
export type PdvSearchOption = PDVProductOption & {
  barcode?: string | null;
  reference?: string | null;
};

function eq(a: string | null | undefined, term: string): boolean {
  return (a ?? "").trim().toLowerCase() === term;
}

/**
 * Escolhe o produto de uma confirmação (ENTER / leitor).
 *
 * Ordem: código de barras -> SKU -> referência -> nome exato -> resultado
 * único. Nada é escolhido "no chute" quando há ambiguidade.
 */
export function pickSearchProduct(
  term: string,
  options: PdvSearchOption[],
): PDVProductOption | null {
  const value = searchCacheKey(term);
  if (!value || options.length === 0) return null;

  return (
    options.find((p) => eq(p.barcode, value)) ??
    options.find((p) => eq(p.sku, value)) ??
    options.find((p) => eq(p.reference, value)) ??
    options.find((p) => eq(p.name, value)) ??
    (options.length === 1 ? options[0] : null)
  );
}
