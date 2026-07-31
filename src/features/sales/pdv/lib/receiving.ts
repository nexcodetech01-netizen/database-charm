/**
 * PDV — Recebimento da venda (Sprint 2.5).
 *
 * Camada pura de orquestração. Nenhuma regra financeira nova: o título é
 * garantido pela RPC existente (`ensure_sale_receivable`, via
 * `salesService.openReceivableForSale`) e a baixa é feita exclusivamente
 * pelo motor único (`settle_financial_transaction`, via
 * `financeService.settleTransaction`), que também registra a movimentação
 * de caixa e o saldo da conta.
 */
import type { FinancePaymentMethod } from "@/features/finance/types";

/** Formas de recebimento aceitas no balcão (subconjunto do módulo Financeiro). */
export const PDV_PAYMENT_METHODS: {
  value: FinancePaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "credit_card", label: "Cartão de crédito" },
];

export type PdvReceivable = { id: string; amount?: number | null };

export type PdvReceiveDeps = {
  /** `salesService.openReceivableForSale` — idempotente. */
  openReceivable: (saleId: string) => Promise<PdvReceivable | null>;
  /** `financeService.settleTransaction` — motor único de liquidação. */
  settle: (
    transactionId: string,
    input: {
      paymentMethod: FinancePaymentMethod;
      accountId: string;
      paidAt: string;
      settledAmount?: number | null;
    },
  ) => Promise<unknown>;
  /** `salesService.setStatus(saleId, "paid")`. */
  markPaid: (saleId: string) => Promise<unknown>;
};

export type PdvReceiveResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "method_required"
        | "account_required"
        | "no_receivable"
        | "settle_failed"
        | "status_failed";
      message: string;
      /** `true` quando a baixa foi concluída mas o status da venda falhou. */
      settled?: boolean;
    };

function messageOf(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/** Data (YYYY-MM-DD) usada como referência da baixa. */
export function pdvSettlementDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function receivePdvSale(
  input: {
    saleId: string;
    paymentMethod: FinancePaymentMethod | "";
    accountId: string;
    paidAt?: string;
  },
  deps: PdvReceiveDeps,
): Promise<PdvReceiveResult> {
  if (!input.paymentMethod) {
    return {
      ok: false,
      code: "method_required",
      message: "Selecione a forma de recebimento.",
    };
  }
  if (!input.accountId) {
    return {
      ok: false,
      code: "account_required",
      message: "Selecione a conta de destino.",
    };
  }

  let receivable: PdvReceivable | null;
  try {
    receivable = await deps.openReceivable(input.saleId);
  } catch (err) {
    return {
      ok: false,
      code: "no_receivable",
      message: messageOf(err, "Não foi possível abrir o título da venda."),
    };
  }
  if (!receivable) {
    return {
      ok: false,
      code: "no_receivable",
      message:
        "Não há lançamento financeiro em aberto para esta venda. Verifique o módulo Financeiro.",
    };
  }

  try {
    await deps.settle(receivable.id, {
      paymentMethod: input.paymentMethod,
      accountId: input.accountId,
      paidAt: input.paidAt ?? pdvSettlementDate(),
    });
  } catch (err) {
    return {
      ok: false,
      code: "settle_failed",
      message: messageOf(err, "Não foi possível registrar o recebimento."),
    };
  }

  try {
    await deps.markPaid(input.saleId);
  } catch (err) {
    return {
      ok: false,
      code: "status_failed",
      settled: true,
      message: messageOf(
        err,
        "Recebimento registrado, mas o status da venda não foi atualizado.",
      ),
    };
  }

  return { ok: true };
}
