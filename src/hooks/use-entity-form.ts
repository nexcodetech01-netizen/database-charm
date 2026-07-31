import { useEffect, useState } from "react";

/**
 * useEntityForm
 *
 * Hook compartilhado para formulários de edição de entidade.
 * Mantém um estado local de formulário derivado de `entity` e
 * re-sincroniza automaticamente sempre que a entidade mudar
 * (identificada por `id` + `updated_at`).
 *
 * Isto corrige um bug recorrente onde `useState(() => toState(entity))`
 * ficava preso ao valor inicial após refetch/navegação entre entidades.
 */
export function useEntityForm<
  E extends { id: string; updated_at?: string | null } | null | undefined,
  S,
>(entity: E, toState: (entity: E) => S) {
  const [form, setForm] = useState<S>(() => toState(entity));

  const id = entity?.id ?? null;
  const updatedAt =
    entity && "updated_at" in entity ? (entity.updated_at ?? null) : null;

  useEffect(() => {
    setForm(toState(entity));
    // Re-sincroniza quando a entidade muda (id) ou é atualizada (updated_at).
    // toState é intencionalmente omitido para evitar reset em cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, updatedAt]);

  return [form, setForm] as const;
}
