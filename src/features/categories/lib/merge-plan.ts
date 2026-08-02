import { groupDuplicateCategories } from "./category-name-key";

/**
 * Plano de unificação de um grupo de categorias equivalentes.
 * PURO — nenhuma escrita. A UI mostra a prévia e só executa após confirmação.
 */
export interface MergeCandidate {
  id: string;
  name: string;
  product_count: number;
  min_margin_pct?: number | null;
  target_margin_pct?: number | null;
  max_margin_pct?: number | null;
  status?: string;
}

export interface MergePlan {
  targetId: string | null;
  target: MergeCandidate | null;
  sources: MergeCandidate[];
  productsToMove: number;
  policyConflict: boolean;
}

const policySignature = (c: MergeCandidate) =>
  `${c.min_margin_pct ?? "-"}/${c.target_margin_pct ?? "-"}/${c.max_margin_pct ?? "-"}`;

/**
 * Sugere o destino (mais produtos → nome mais completo) e lista as origens.
 * Nunca escolhe automaticamente em caso de conflito de política: apenas
 * sinaliza `policyConflict` para a UI exigir confirmação.
 */
export function resolveMergePlan(
  candidates: readonly MergeCandidate[],
  chosenTargetId?: string | null,
): MergePlan {
  const ordered = [...candidates].sort(
    (a, b) => b.product_count - a.product_count || b.name.length - a.name.length,
  );
  const target =
    (chosenTargetId ? ordered.find((c) => c.id === chosenTargetId) : undefined) ??
    ordered[0] ??
    null;
  const sources = target ? ordered.filter((c) => c.id !== target.id) : [];
  const signatures = new Set(candidates.map(policySignature));

  return {
    targetId: target?.id ?? null,
    target,
    sources,
    productsToMove: sources.reduce((acc, s) => acc + s.product_count, 0),
    policyConflict: signatures.size > 1,
  };
}

/** Constrói os planos para todos os grupos duplicados de uma lista. */
export function buildMergePlans(candidates: readonly MergeCandidate[]): MergePlan[] {
  return groupDuplicateCategories(candidates).map((g) => resolveMergePlan(g.categories));
}
