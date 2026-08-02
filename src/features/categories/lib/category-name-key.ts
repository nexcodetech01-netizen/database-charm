/**
 * Chave canônica de comparação de nomes de categoria.
 * ===================================================
 * Espelha EXATAMENTE a função SQL `public.category_name_key`:
 * ignora acentos, maiúsculas/minúsculas, espaços extras, pontuação
 * e plural simples (sufixo "s").
 *
 * Uso: impedir a criação de categorias equivalentes ("Bolsa" x "Bolsas")
 * e sugerir a categoria já existente. NÃO altera preço, margem ou produto.
 */
export function categoryNameKey(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/s$/, "");
}

export function areCategoryNamesEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = categoryNameKey(a);
  return ka.length > 0 && ka === categoryNameKey(b);
}

export interface CategoryNameLike {
  id: string;
  name: string;
}

/**
 * Retorna a categoria existente equivalente ao nome informado (se houver).
 * `ignoreId` permite renomear a própria categoria.
 */
export function findEquivalentCategory<T extends CategoryNameLike>(
  categories: readonly T[],
  name: string,
  ignoreId?: string | null,
): T | null {
  const key = categoryNameKey(name);
  if (!key) return null;
  return (
    categories.find((c) => c.id !== ignoreId && categoryNameKey(c.name) === key) ?? null
  );
}

export interface DuplicateCategoryGroup<T extends CategoryNameLike> {
  key: string;
  categories: T[];
}

/** Agrupa categorias equivalentes (somente grupos com 2+ membros). */
export function groupDuplicateCategories<T extends CategoryNameLike>(
  categories: readonly T[],
): DuplicateCategoryGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const c of categories) {
    const key = categoryNameKey(c.name);
    if (!key) continue;
    const arr = map.get(key);
    if (arr) arr.push(c);
    else map.set(key, [c]);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, categories: list }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
