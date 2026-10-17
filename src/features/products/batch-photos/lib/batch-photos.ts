/**
 * Fotos em lote — regras puras (sem banco, sem navegador).
 *
 * Fluxo: a pessoa seleciona as fotos já prontas (ex.: dobrada, frente,
 * costas de cada camiseta, nessa ordem). Agrupamos de N em N e sugerimos o
 * produto de cada grupo: os produtos ainda sem foto, na ordem em que foram
 * cadastrados.
 */

export interface PhotoLike {
  name: string;
  lastModified: number;
}

/**
 * Ordem das fotos: pela data do arquivo e, no empate, pelo nome com números
 * em ordem natural ("foto 2" antes de "foto 10"). O navegador não garante a
 * ordem em que os arquivos foram selecionados.
 */
export function sortPhotos<T extends PhotoLike>(files: T[]): T[] {
  const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  return [...files].sort(
    (a, b) => a.lastModified - b.lastModified || collator.compare(a.name, b.name),
  );
}

/** Divide em grupos de `perItem` (o último pode ficar incompleto). */
export function chunkPhotos<T>(items: T[], perItem: number): T[][] {
  const n = Math.max(1, Math.floor(perItem));
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += n) groups.push(items.slice(i, i + n));
  return groups;
}

/** Move um item de posição (para corrigir a ordem antes de salvar). */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export interface CandidateProduct {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Sugestão inicial: grupo 1 → 1º produto sem foto (mais antigo), grupo 2 →
 * 2º, e assim por diante. Sobra de grupos fica sem produto (null).
 */
export function suggestAssignments(
  groupCount: number,
  candidates: CandidateProduct[],
): (string | null)[] {
  const ordered = [...candidates].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name),
  );
  return Array.from({ length: groupCount }, (_, i) => ordered[i]?.id ?? null);
}

/** Mesmo produto em dois grupos é quase sempre engano: aponta quais. */
export function duplicatedAssignments(assignments: (string | null)[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of assignments) {
    if (!id) continue;
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return dup;
}
