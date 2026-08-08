/**
 * SaleEngine — contratos do núcleo de vendas.
 *
 * Camada 100% pura: sem React, sem Supabase, sem toast, sem navegação.
 * Qualquer consumidor (formulário de venda, PDV, marketplace, Bella IA,
 * API futura) monta um `SaleDraftState`, pergunta ao engine e recebe uma
 * decisão explícita. A tradução da decisão em UI (toast, dialog, foco de
 * campo) é responsabilidade exclusiva da interface.
 */
import type { SaleItemDraft } from "../types";

/** Estado mínimo de uma venda em edição, independente de UI. */
export interface SaleDraftState {
  number: string;
  customerId: string;
  paymentMethod: string;
  /** Status corrente do formulário (usado quando não é finalização). */
  status: string;
  discount: number;
  shipping: number;
  notes: string;
  items: SaleItemDraft[];
}

/** Totais calculados da venda. */
export interface SaleTotals {
  items_total: number;
  grand_total: number;
}

/** Resultado genérico de uma etapa de validação do engine. */
export type SaleCheck =
  | { ok: true }
  | {
      ok: false;
      /** Código estável — a UI escolhe a mensagem/afordância. */
      code:
        | "number_required"
        | "customer_required"
        | "no_items"
        | "invalid_item";
      /** Campo relacionado, quando aplicável. */
      field?: string;
      /** Mensagem padrão sugerida (a UI pode sobrescrever). */
      message: string;
    };

/** Contexto necessário para resolver status/payload de persistência. */
export interface SalePersistenceContext {
  companyId: string;
  finalize: boolean;
  isEdit: boolean;
  /** Status atual da venda persistida (somente em edição). */
  persistedStatus?: string | null;
  /** Sessão de caixa vinculada — resolvida fora do engine. */
  cashSessionId: string | null;
}

/** Payload pronto para `salesService.create/update`. */
export interface SalePersistencePayload {
  company_id: string;
  number: string;
  customer_id: string | null;
  /** TZ-002 — sempre vazio: o banco resolve via `company_today()`. */
  sale_date: string;
  payment_method: string | null;
  status: string;
  discount: number;
  shipping: number;
  notes: string | null;
  cash_session_id: string | null;
}
