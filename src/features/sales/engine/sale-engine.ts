/**
 * SaleEngine — motor único de venda do NexOS.
 *
 * Concentra, em funções puras, a sequência de decisão que antes vivia
 * dentro de `sale-form.tsx`:
 *
 *   identidade → cliente → itens → estoque → desconto → status → payload
 *
 * Regras de negócio NÃO mudaram: cada função é a transcrição literal do
 * bloco correspondente do formulário. O que muda é o lugar — agora o
 * PDV, o marketplace, a Bella IA e uma API futura consomem exatamente as
 * mesmas decisões, sem duplicar regra.
 */
import { computeTotals } from "../lib/totals";
import {
  computeStockInsufficiencies,
  type StockInsufficiency,
} from "../lib/stock";
import {
  evaluateDiscount,
  type DiscountEvaluation,
  type DiscountPolicy,
} from "../lib/discounts";
import { isReceivablePaymentMethod, requiresCheckout } from "../lib/payments";
import type { SaleItemDraft } from "../types";
import type {
  SaleCheck,
  SaleDraftState,
  SalePersistenceContext,
  SalePersistencePayload,
  SaleTotals,
} from "./types";

/* ------------------------------------------------------------------ */
/* Totais                                                              */
/* ------------------------------------------------------------------ */

export function computeSaleTotals(state: SaleDraftState): SaleTotals {
  return computeTotals(state.items, {
    discount: state.discount || 0,
    shipping: state.shipping || 0,
  });
}

/* ------------------------------------------------------------------ */
/* Validações                                                          */
/* ------------------------------------------------------------------ */

/** Número da venda é obrigatório (schema Zod original: min 1, max 60). */
export function validateSaleIdentity(state: SaleDraftState): SaleCheck {
  const number = (state.number ?? "").trim();
  if (!number || number.length > 60) {
    return {
      ok: false,
      code: "number_required",
      field: "number",
      message: "Número é obrigatório",
    };
  }
  return { ok: true };
}

/** Cliente é obrigatório para qualquer persistência (rascunho inclusive). */
export function validateSaleCustomer(state: SaleDraftState): SaleCheck {
  if (!state.customerId) {
    return {
      ok: false,
      code: "customer_required",
      field: "customer_id",
      message: "É obrigatório selecionar um cliente para salvar a venda",
    };
  }
  return { ok: true };
}

/** Itens só são exigidos na finalização. */
export function validateSaleItems(items: SaleItemDraft[]): SaleCheck {
  if (items.length === 0) {
    return { ok: false, code: "no_items", message: "Adicione ao menos um item" };
  }
  const invalid = items.find(
    (it) => !it.description.trim() || it.quantity <= 0,
  );
  if (invalid) {
    return {
      ok: false,
      code: "invalid_item",
      message: "Todo item precisa ter descrição e quantidade > 0.",
    };
  }
  return { ok: true };
}

/**
 * Estoque — aceita o mapa de estoque fresco lido do banco (revalidação
 * contra consumo concorrente). Sem mapa, usa `stock_available` local.
 */
export function evaluateSaleStock(
  items: SaleItemDraft[],
  freshStock?: Map<string, number | null>,
): StockInsufficiency<SaleItemDraft>[] {
  return computeStockInsufficiencies(items, freshStock);
}

/** Desconto — delega à política vigente (PDV-015). */
export function evaluateSaleDiscount(input: {
  state: SaleDraftState;
  policy: DiscountPolicy;
  overrideApproved: boolean;
  totals?: SaleTotals;
}): DiscountEvaluation {
  const totals = input.totals ?? computeSaleTotals(input.state);
  return evaluateDiscount({
    subtotal: totals.items_total,
    discountValue: input.state.discount || 0,
    paymentMethod: input.state.paymentMethod,
    policy: input.policy,
    overrideApproved: input.overrideApproved,
  });
}

/* ------------------------------------------------------------------ */
/* Persistência                                                        */
/* ------------------------------------------------------------------ */

/**
 * Status a gravar.
 *
 * • "A Receber" grava como `draft` primeiro — o trigger
 *   `apply_receivable_sale` depende dos itens já persistidos; a promoção
 *   para `pending` acontece logo após o INSERT dos itens.
 * • Edição de venda já paga preserva `paid`.
 * • Demais finalizações gravam `pending` (checkout resolve o `paid`).
 * • Sem finalizar, mantém o status corrente do formulário.
 */
export function resolveSaleStatus(
  state: SaleDraftState,
  ctx: Pick<SalePersistenceContext, "finalize" | "isEdit" | "persistedStatus">,
  inputPaidAmount?: number,
): string {
  if (!ctx.finalize) return state.status;

  // Se o valor pago for informado explicitamente (ex: Checkout PDV), aplicamos a regra estrita.
  if (inputPaidAmount !== undefined) {
    const totals = computeSaleTotals(state);
    const total = totals.grand_total;
    if (inputPaidAmount >= total) return "paid";
    if (inputPaidAmount > 0) return "partially_paid";
    return "pending";
  }
  
  // Vendas "A Receber" (sem checkout) gravam como draft para promoção posterior
  if (isReceivablePaymentMethod(state.paymentMethod)) return "draft";
  
  // Vendas em Crediário (com checkout/entrada)
  if (state.paymentMethod === "credit") {
    // Por padrão, a persistência inicial de um crediário sem checkout é pendente.
    return "pending";
  }

  if (ctx.isEdit && ctx.persistedStatus === "paid") return "paid";
  return "pending";
}

/** `true` quando a venda precisa ser promovida a `pending` após o INSERT. */
export function needsReceivablePromotion(
  state: SaleDraftState,
  finalize: boolean,
): boolean {
  return finalize && isReceivablePaymentMethod(state.paymentMethod);
}

/** Payload de persistência — TZ-002: `sale_date` nunca vem da UI. */
export function buildSalePayload(
  state: SaleDraftState,
  ctx: SalePersistenceContext,
  inputPaidAmount?: number,
): SalePersistencePayload {
  return {
    company_id: ctx.companyId,
    number: state.number.trim(),
    customer_id: state.customerId,
    sale_date: "",
    payment_method: state.paymentMethod || null,
    status: resolveSaleStatus(state, ctx, inputPaidAmount),
    discount: state.discount || 0,
    shipping: state.shipping || 0,
    notes: state.notes.trim() || null,
    cash_session_id: ctx.cashSessionId,
  };
}

/* ------------------------------------------------------------------ */
/* Facade                                                              */
/* ------------------------------------------------------------------ */

export const SaleEngine = {
  computeTotals: computeSaleTotals,
  validateIdentity: validateSaleIdentity,
  validateCustomer: validateSaleCustomer,
  validateItems: validateSaleItems,
  evaluateStock: evaluateSaleStock,
  evaluateDiscount: evaluateSaleDiscount,
  resolveStatus: resolveSaleStatus,
  needsReceivablePromotion,
  buildPayload: (state: SaleDraftState, ctx: SalePersistenceContext, paid?: number) => buildSalePayload(state, ctx, paid),
  requiresCheckout,
  isReceivable: isReceivablePaymentMethod,
} as const;
