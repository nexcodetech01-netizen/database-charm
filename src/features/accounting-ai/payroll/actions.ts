/**
 * Bella Contadora — Execução de retirada de pró-labore.
 *
 * Até aqui, a Bella Contadora só CONSULTAVA e SIMULAVA o valor seguro de
 * retirada (ver payroll/skills/payroll-skills.ts, ambos readOnly). Este
 * módulo adiciona a ação que faltava: registrar de fato a retirada como
 * uma saída financeira paga, reaproveitando o mesmo motor único de
 * liquidação (`createAndSettleTransaction` → `settle_financial_transaction`)
 * já usado por todo o resto do sistema — nunca insere uma transação como
 * "paga" diretamente.
 *
 * O valor de reserva mínima (quanto precisa ficar em caixa para compras/
 * operação) já é calculado pelo advisor (`buildFinancialAdvice`) — esta
 * ação não recalcula nada, só usa o `safeAmount` já apurado como valor
 * padrão sugerido, e deixa claro no aviso de retorno se o valor pedido
 * ultrapassa esse teto seguro.
 */
import { financeService } from "@/features/finance/services/finance.service";
import { buildAccountingSummary } from "../providers/summary";
import { buildFinancialAdvice } from "../advisor/engine";
import type { ProviderDeps } from "../providers";
import type { FinancePaymentMethod } from "@/features/finance/types";

export interface EmitProlaboreInput {
  companyId: string;
  accountId: string;
  /** Se omitido, usa o valor seguro recomendado pelo advisor. */
  amount?: number;
  paymentMethod?: FinancePaymentMethod;
  notes?: string | null;
  createdBy?: string | null;
}

export interface EmitProlaboreResult {
  ok: boolean;
  message: string;
  amount: number;
  safeAmount: number;
  exceededSafeAmount: boolean;
  transactionId?: string;
}

export async function emitProlaboreWithdrawal(
  input: EmitProlaboreInput,
  deps?: ProviderDeps,
): Promise<EmitProlaboreResult> {
  const summary = deps?.summary ?? (await buildAccountingSummary(input.companyId, deps));
  const advice = buildFinancialAdvice({ summary, requestedAmount: input.amount });

  if (!advice.available) {
    return {
      ok: false,
      message: "Não há dados financeiros suficientes no período para calcular uma retirada segura.",
      amount: 0,
      safeAmount: 0,
      exceededSafeAmount: false,
    };
  }

  const safeAmount = advice.withdrawal.safeAmount;
  const amount = input.amount ?? safeAmount;

  if (amount <= 0) {
    return {
      ok: false,
      message: "O valor da retirada precisa ser maior que zero.",
      amount,
      safeAmount,
      exceededSafeAmount: false,
    };
  }

  const exceededSafeAmount = amount > safeAmount;
  const today = new Date().toISOString().slice(0, 10);

  const created = await financeService.createAndSettleTransaction(
    {
      company_id: input.companyId,
      type: "expense",
      description: "Pró-labore",
      amount,
      transaction_date: today,
      due_date: today,
      account_id: input.accountId,
      source: "manual",
      notes: input.notes ?? "Registrado via Bella Contadora.",
      created_by: input.createdBy ?? null,
    },
    {
      paymentMethod: input.paymentMethod ?? "cash",
      accountId: input.accountId,
      paidAt: new Date().toISOString(),
    },
  );

  return {
    ok: true,
    message: exceededSafeAmount
      ? `Retirada de ${formatBRL(amount)} registrada. Atenção: isso passa ${formatBRL(amount - safeAmount)} do teto seguro (${formatBRL(safeAmount)}).`
      : `Retirada de ${formatBRL(amount)} registrada com segurança (teto seguro: ${formatBRL(safeAmount)}).`,
    amount,
    safeAmount,
    exceededSafeAmount,
    transactionId: (created as { id?: string })?.id,
  };
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
