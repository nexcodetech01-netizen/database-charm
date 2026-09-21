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
 * operação) já é calculado pelo advisor (`buildFinancialAdvice`), que por
 * sua vez lê o teto seguro único do banco (`compute_prolabore_safe_amount`)
 * — esta ação não recalcula nada.
 *
 * CORRIGIDO (2026-09-21, auditoria de pró-labore — achados #1 e #6):
 *  - #1: antes, pedir um valor acima do teto seguro só gerava um aviso —
 *    a retirada era registrada do mesmo jeito. Agora, exceder o teto exige
 *    confirmação explícita (`confirmExceeds: true`) + um motivo por
 *    escrito (`exceedReason`, mínimo 5 caracteres); sem isso a função
 *    devolve `ok:false` e NADA é registrado.
 *  - #6: a data da retirada usava `new Date().toISOString()` (UTC) — uma
 *    retirada feita à noite (horário de Brasília) podia cair no dia
 *    seguinte, e perto da virada do mês isso distorcia o fechamento. Agora
 *    usa `companyDayKey`, a mesma fonte única de data local já usada pelo
 *    resto do Financeiro.
 */
import { financeService } from "@/features/finance/services/finance.service";
import { buildAccountingSummary } from "../providers/summary";
import { buildFinancialAdvice } from "../advisor/engine";
import type { ProviderDeps } from "../providers";
import type { FinancePaymentMethod } from "@/features/finance/types";
import { companyDayKey } from "@/lib/time";

export interface EmitProlaboreInput {
  companyId: string;
  accountId: string;
  /** Se omitido, usa o valor seguro recomendado pelo advisor. */
  amount?: number;
  paymentMethod?: FinancePaymentMethod;
  notes?: string | null;
  createdBy?: string | null;
  /** Confirmação explícita para retirar acima do teto seguro apurado. */
  confirmExceeds?: boolean;
  /** Motivo (mínimo 5 caracteres) — obrigatório quando `confirmExceeds`. */
  exceedReason?: string | null;
}

export interface EmitProlaboreResult {
  ok: boolean;
  message: string;
  amount: number;
  safeAmount: number;
  exceededSafeAmount: boolean;
  /** `true` quando o pedido foi recusado só por faltar confirmação/motivo. */
  requiresConfirmation?: boolean;
  transactionId?: string;
}

const MIN_EXCEED_REASON_LENGTH = 5;

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
  const exceedReason = (input.exceedReason ?? "").trim();

  if (exceededSafeAmount && (!input.confirmExceeds || exceedReason.length < MIN_EXCEED_REASON_LENGTH)) {
    return {
      ok: false,
      message: `Esse valor passa ${formatBRL(amount - safeAmount)} do teto seguro (${formatBRL(safeAmount)}). Confirme explicitamente e informe o motivo pra registrar mesmo assim.`,
      amount,
      safeAmount,
      exceededSafeAmount: true,
      requiresConfirmation: true,
    };
  }

  const today = companyDayKey(new Date());
  const baseNotes = input.notes?.trim() || "Registrado via Bella Contadora.";
  const notes = exceededSafeAmount
    ? `${baseNotes} · ACIMA DO TETO SEGURO (${formatBRL(safeAmount)} apurado) · Motivo: ${exceedReason}`
    : baseNotes;

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
      notes,
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
