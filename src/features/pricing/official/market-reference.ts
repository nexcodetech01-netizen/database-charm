/**
 * BELLA — REFERÊNCIAS DE MERCADO (consultivo)
 * ===========================================
 * A Bella NUNCA define margem. Ela apenas exibe faixas de referência
 * (conservadora / comum / premium) para auxiliar a configuração inicial
 * de uma categoria. A decisão final é sempre do usuário.
 *
 * As referências vivem em `pricing_market_references` (catálogo
 * configurável, separado da política comercial da empresa). Este módulo
 * contém apenas normalização e casamento — PURO, sem I/O e sem valores
 * hardcoded de margem.
 */

export interface MarketReference {
  readonly categoryKey: string;
  readonly label: string;
  readonly conservativePct: number;
  readonly commonPct: number;
  readonly premiumPct: number;
  readonly sourceNote?: string | null;
  /** true quando a referência é própria da empresa (sobrepõe a global). */
  readonly companyScoped: boolean;
}

/** Chave canônica de categoria: sem acento, minúscula, singular tolerante. */
export function marketReferenceKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

const singular = (key: string) => (key.endsWith("s") ? key.slice(0, -1) : key);

/**
 * Encontra a referência de mercado para o nome de uma categoria.
 * Referência da empresa vence a global. Tolera plural/singular e acentos.
 * Retorna `null` quando não há referência — a UI então não sugere nada.
 */
export function findMarketReference(
  references: readonly MarketReference[],
  categoryName: string | null | undefined,
): MarketReference | null {
  if (!categoryName?.trim()) return null;
  const key = marketReferenceKey(categoryName);
  const base = singular(key);

  const matches = references.filter((r) => {
    const rk = marketReferenceKey(r.categoryKey);
    return rk === key || singular(rk) === base;
  });
  if (matches.length === 0) return null;

  return matches.find((r) => r.companyScoped) ?? (matches[0] as MarketReference);
}
