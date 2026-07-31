// BUG-PDV-018 — Detecção de "venda em andamento".
//
// A única fonte de verdade para o modal de recuperação é o rascunho local
// (localStorage) gravado por `useDraft`. Este módulo isola o predicado que
// decide se um rascunho carregado representa, de fato, uma venda em
// andamento — de modo que rascunhos removidos (`discard`) ou órfãos vazios
// (autosave que rodou sobre um formulário zerado, race pós-descartar)
// sejam ignorados na próxima "Nova venda" da mesma sessão.

import { draftStorage, DRAFT_KEYS } from "@/lib/draft-storage";

export interface SaleDraftForm {
  customer_id?: string;
  notes?: string;
  discount?: string | number;
  shipping?: string | number;
  payment_method?: string;
  number?: string;
  status?: string;
}

export interface SaleDraftPayload {
  form?: SaleDraftForm;
  items?: unknown[];
}

/** `true` quando o rascunho não contém progresso relevante do operador. */
export function isSaleDraftEmpty(
  draft: SaleDraftPayload | null | undefined,
): boolean {
  if (!draft) return true;
  const items = Array.isArray(draft.items) ? draft.items : [];
  const form = draft.form ?? {};
  return (
    items.length === 0 &&
    !form.customer_id &&
    !(form.notes ?? "").trim() &&
    Number(form.discount ?? 0) === 0 &&
    Number(form.shipping ?? 0) === 0 &&
    (!form.payment_method || form.payment_method === "pix_manual")
  );
}

export interface LoadedSaleDraft {
  data: SaleDraftPayload;
  updatedAt: number;
}

export interface PersistedSaleDraftState {
  sale_id: string;
  status: string;
  completed_at: string | null;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export type FindPersistedSale = (
  saleNumber: string,
) => Promise<PersistedSaleDraftState | null>;

function logDraftCandidate(
  origin: "localStorage" | "banco",
  values: {
    sale_id: string | null;
    status: string | null;
    draft: boolean;
    completed_at: string | null;
    payment_status: string | null;
    created_at: string | number | null;
    updated_at: string | number | null;
  },
) {
  // Log estruturado solicitado para diagnosticar a origem sem expor o payload
  // completo do carrinho ou dados pessoais do cliente.
  console.info("[sale-draft] candidato a Venda em andamento", {
    ...values,
    origem: origin,
  });
}

/**
 * Retorna o rascunho apenas quando ele representa uma venda em andamento.
 *
 * - Sem chave no storage → `null` (rascunho já descartado / expirado).
 * - Rascunho carregado, porém vazio → `null` e limpa a chave órfã, evitando
 *   que o modal "Venda em andamento" reapareça na próxima nova venda.
 */
export function loadInProgressSaleDraft(
  companyId: string,
): LoadedSaleDraft | null {
  const key = DRAFT_KEYS.sale(companyId);
  const found = draftStorage.load<SaleDraftPayload>(key);
  if (!found) return null;
  if (isSaleDraftEmpty(found.data)) {
    draftStorage.remove(key);
    return null;
  }
  return found;
}

/**
 * Resolve a origem real antes de abrir o modal.
 *
 * O modal recupera somente trabalho local ainda não persistido. Se o mesmo
 * número já existe em `sales`, o registro do banco é a fonte de verdade e a
 * cópia local é obsoleta — independentemente de estar pago, cancelado,
 * pendente ou em rascunho.
 */
export async function resolveInProgressSaleDraft(
  companyId: string,
  findPersistedSale: FindPersistedSale,
): Promise<LoadedSaleDraft | null> {
  const found = loadInProgressSaleDraft(companyId);
  if (!found) return null;

  const saleNumber = found.data.form?.number?.trim() ?? "";
  logDraftCandidate("localStorage", {
    sale_id: null,
    status: found.data.form?.status ?? "draft",
    draft: true,
    completed_at: null,
    payment_status: null,
    created_at: null,
    updated_at: found.updatedAt,
  });

  if (!saleNumber) return found;

  const persisted = await findPersistedSale(saleNumber);
  if (!persisted) return found;

  logDraftCandidate("banco", {
    ...persisted,
    draft: persisted.status === "draft",
  });

  // Uma venda persistida deve ser retomada pelo próprio registro em `sales`,
  // nunca por uma fotografia antiga do formulário no localStorage.
  draftStorage.remove(DRAFT_KEYS.sale(companyId));
  console.info("[sale-draft] cópia local ignorada", {
    sale_id: persisted.sale_id,
    status: persisted.status,
    draft: persisted.status === "draft",
    completed_at: persisted.completed_at,
    payment_status: persisted.payment_status,
    created_at: persisted.created_at,
    updated_at: persisted.updated_at,
    origem: "localStorage",
    motivo: "venda_já_persistida_no_banco",
  });
  return null;
}
