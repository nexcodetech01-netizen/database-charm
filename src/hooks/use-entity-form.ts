import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * FIX (2026-08-12): a re-sincronização por `updated_at` sozinha causava
 * outro bug — se QUALQUER coisa em segundo plano atualizasse a entidade
 * (upload de imagem, geração de SKU, sugestão de tags etc.) enquanto o
 * usuário editava, o formulário era silenciosamente sobrescrito com os
 * dados antigos do servidor, perdendo a seleção que o usuário tinha acabado
 * de fazer (ex.: categoria/unidade "não fixavam" no cadastro de produto).
 * Agora só resincroniza por `updated_at` se o usuário ainda não tiver
 * começado a editar nesta sessão do formulário; troca de entidade (`id`)
 * sempre resincroniza normalmente.
 *
 * FIX (2026-08-12, parte 2): a primeira versão deste fix retornava um
 * `setForm` recriado a cada render (uma arrow function nova toda vez).
 * O `setState` nativo do React é sempre estável entre renders — vários
 * componentes consumidores (ex. ProductForm) dependem dessa estabilidade
 * em arrays de dependência de outros efeitos/callbacks. Quebrar isso fez
 * esses efeitos reexecutarem a cada render, causando loop infinito de
 * atualização ("Maximum update depth exceeded") em telas de edição.
 * `setForm` agora é memoizado com `useCallback` e mantém identidade
 * estável entre renders, como o `setState` original.
 */
export function useEntityForm<
  E extends { id: string; updated_at?: string | null } | null | undefined,
  S,
>(entity: E, toState: (entity: E) => S) {
  const [form, setFormState] = useState<S>(() => toState(entity));
  const dirtyRef = useRef(false);
  const idRef = useRef(entity?.id ?? null);
  const hasSyncedRef = useRef(false);

  const id = entity?.id ?? null;
  const updatedAt =
    entity && "updated_at" in entity ? (entity.updated_at ?? null) : null;

  useEffect(() => {
    const idChanged = idRef.current !== id;
    idRef.current = id;
    if (idChanged) {
      // Trocou de entidade (ex.: navegou para outro produto) — sempre
      // resincroniza e reseta o estado de "edição em andamento".
      dirtyRef.current = false;
      setFormState(toState(entity));
    } else if (!dirtyRef.current && hasSyncedRef.current) {
      // Mesma entidade, só updated_at mudou (refetch em background) — só
      // resincroniza se o usuário ainda não tiver mexido no formulário.
      // `hasSyncedRef` evita um setState redundante logo no primeiro
      // efeito após o mount, quando o useState já inicializou com o
      // valor certo (idChanged é false no primeiro run também).
      setFormState(toState(entity));
    }
    hasSyncedRef.current = true;
    // toState é intencionalmente omitido para evitar reset em cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, updatedAt]);

  const setForm = useCallback<typeof setFormState>((value) => {
    dirtyRef.current = true;
    setFormState(value);
  }, []);

  return [form, setForm] as const;
}
