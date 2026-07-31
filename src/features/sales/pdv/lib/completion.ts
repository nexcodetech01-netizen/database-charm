/**
 * PDV — Conclusão da venda e recibo (Sprint 2.6).
 *
 * Camada pura: nenhum serviço, nenhuma regra de negócio nova, nenhum layout.
 * O recibo em si é o `SaleReceipt`/`ReceiptDialog` já existentes do módulo de
 * Vendas — aqui só controlamos o estado da sessão do balcão.
 */
import type { FinancePaymentMethod } from "@/features/finance/types";
import type { PdvFiscalOutcome } from "./fiscal";

export type PdvPendingSale = {
  id: string;
  number: string;
  total: number;
};

export type PdvCompletedSale = PdvPendingSale & {
  paymentMethod: FinancePaymentMethod;
  /** ISO da confirmação do recebimento. */
  receivedAt: string;
};

export type PdvSessionState = {
  /** Venda criada aguardando recebimento. */
  pendingSale: PdvPendingSale | null;
  /** Venda recebida, aguardando recibo / nova venda. */
  completed: PdvCompletedSale | null;
  /** Diálogo de recibo aberto. */
  receiptOpen: boolean;
  /** CheckoutDialog (motor de pagamentos existente) aberto — Sprint 2.6. */
  checkoutOpen: boolean;
  /** Resultado da emissão da NFC-e (Sprint 2.10). `null` enquanto não avaliado. */
  fiscal: PdvFiscalOutcome | null;
  /** Emissão fiscal em andamento. */
  fiscalPending: boolean;
};

export const PDV_SESSION_INITIAL: PdvSessionState = {
  pendingSale: null,
  completed: null,
  receiptOpen: false,
  checkoutOpen: false,
  fiscal: null,
  fiscalPending: false,
};

export type PdvSessionAction =
  | { type: "SALE_CREATED"; sale: PdvPendingSale }
  | {
      type: "SALE_RECEIVED";
      paymentMethod: FinancePaymentMethod;
      receivedAt?: string;
    }
  | { type: "CLOSE_CHECKOUT" }
  | { type: "FISCAL_START" }
  | { type: "FISCAL_RESULT"; outcome: PdvFiscalOutcome }
  | { type: "OPEN_RECEIPT" }
  | { type: "CLOSE_RECEIPT" }
  | { type: "NEW_SALE" };

export function pdvSessionReducer(
  state: PdvSessionState,
  action: PdvSessionAction,
): PdvSessionState {
  switch (action.type) {
    case "SALE_CREATED":
      return {
        ...PDV_SESSION_INITIAL,
        pendingSale: action.sale,
        checkoutOpen: true,
      };
    case "SALE_RECEIVED": {
      if (!state.pendingSale) return state;
      return {
        ...state,
        pendingSale: null,
        receiptOpen: false,
        completed: {
          ...state.pendingSale,
          paymentMethod: action.paymentMethod,
          receivedAt: action.receivedAt ?? new Date().toISOString(),
        },
      };
    }
    case "CLOSE_CHECKOUT":
      // Sem pagamento confirmado: volta ao carrinho (o CheckoutDialog já
      // devolve a venda para "draft" no banco). Com pagamento: só fecha.
      return { ...state, checkoutOpen: false, pendingSale: null };
    case "FISCAL_START":
      return { ...state, fiscalPending: true, fiscal: null };
    case "FISCAL_RESULT":
      return { ...state, fiscalPending: false, fiscal: action.outcome };
    case "OPEN_RECEIPT":
      return state.completed ? { ...state, receiptOpen: true } : state;
    case "CLOSE_RECEIPT":
      return { ...state, receiptOpen: false };
    case "NEW_SALE":
      return PDV_SESSION_INITIAL;
    default:
      return state;
  }
}

/** Dispara a impressão usando a infraestrutura existente do navegador. */
export function printPdvReceipt(printer: () => void = () => window.print()) {
  printer();
}

/**
 * "Nova Venda": limpa a venda concluída e o carrinho, permanecendo no PDV
 * com o caixa aberto (a sessão de caixa nunca é tocada aqui).
 */
export function startNewPdvSale(
  state: PdvSessionState,
  deps: { resetCart: () => void },
): PdvSessionState {
  deps.resetCart();
  return pdvSessionReducer(state, { type: "NEW_SALE" });
}
