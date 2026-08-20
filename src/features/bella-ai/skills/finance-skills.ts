/**
 * Skills do módulo Financeiro / Caixa.
 *
 * Reutilizam exclusivamente:
 *   - financeService (financial_transactions)
 *   - cashService    (cash_movements)
 *
 * Nada aqui duplica regras de negócio: apenas mapeia o payload da
 * Bella para o input esperado pelo Service.
 */

import { financeService } from "@/features/finance/services/finance.service";
import { cashService } from "@/features/cash/services/cash.service";
import type { BellaSkill } from "./types";
import { skillResult } from "./types";

/* ---------------- helpers de payload ---------------- */

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function asIsoDate(value: unknown): string | null {
  const s = asString(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* ---------------- Finance: despesa ---------------- */

export const registerExpenseSkill: BellaSkill = {
  id: "finance.register_expense",
  name: "Registrar despesa",
  module: "finance",
  description: "Cria um lançamento de despesa em Contas a Pagar.",
  requiresConfirmation: true,
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) => {
    const missing = [];
    if (!asString(payload.description))
      missing.push({ field: "description", label: "Descrição", type: "text" as const, required: true as const });
    if (!asAmount(payload.amount))
      missing.push({ field: "amount", label: "Valor (R$)", type: "money" as const, required: true as const });
    return missing;
  },
  confirmationSummary: (payload) => {
    const desc = asString((payload as Record<string, unknown>).description) ?? "despesa";
    const amt = asAmount((payload as Record<string, unknown>).amount) ?? 0;
    return `Confirma a despesa "${desc}" no valor de R$ ${amt.toFixed(2)}?`;
  },
  async execute(payload, ctx) {
    const description = asString(payload.description);
    const amount = asAmount(payload.amount);
    const dueDate = asIsoDate(payload.dueDate ?? payload.transactionDate);

    const missing = [];
    if (!description) missing.push({ field: "description", label: "Descrição", type: "text" as const, required: true as const });
    if (!amount) missing.push({ field: "amount", label: "Valor (R$)", type: "money" as const, required: true as const });
    if (missing.length) return skillResult.missing("Informe os dados da despesa.", missing);

    const tx = await financeService.createTransaction({
      company_id: ctx.companyId,
      type: "expense",
      description: description!,
      amount: amount!,
      due_date: dueDate,
      transaction_date: dueDate ?? new Date().toISOString().slice(0, 10),
      status: "pending",
      source: "manual",
      created_by: ctx.userId ?? null,
      category_id: asString(payload.categoryId),
      account_id: asString(payload.accountId),
    });

    return skillResult.success(
      `Despesa "${description}" registrada.`,
      tx,
      [{ id: "open_finance", title: "Abrir Financeiro", actionLabel: "Ver" }],
    );
  },
};

/* ---------------- Finance: receita ---------------- */

export const registerIncomeSkill: BellaSkill = {
  id: "finance.register_income",
  name: "Registrar receita",
  module: "finance",
  description: "Cria um lançamento de receita em Contas a Receber.",
  requiresConfirmation: true,
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) => {
    const missing = [];
    if (!asString(payload.description))
      missing.push({ field: "description", label: "Descrição", type: "text" as const, required: true as const });
    if (!asAmount(payload.amount))
      missing.push({ field: "amount", label: "Valor (R$)", type: "money" as const, required: true as const });
    return missing;
  },
  confirmationSummary: (payload) => {
    const desc = asString((payload as Record<string, unknown>).description) ?? "receita";
    const amt = asAmount((payload as Record<string, unknown>).amount) ?? 0;
    return `Confirma a receita "${desc}" no valor de R$ ${amt.toFixed(2)}?`;
  },
  async execute(payload, ctx) {
    const description = asString(payload.description);
    const amount = asAmount(payload.amount);
    const dueDate = asIsoDate(payload.dueDate ?? payload.transactionDate);

    const missing = [];
    if (!description) missing.push({ field: "description", label: "Descrição", type: "text" as const, required: true as const });
    if (!amount) missing.push({ field: "amount", label: "Valor (R$)", type: "money" as const, required: true as const });
    if (missing.length) return skillResult.missing("Informe os dados da receita.", missing);

    const tx = await financeService.createTransaction({
      company_id: ctx.companyId,
      type: "income",
      description: description!,
      amount: amount!,
      due_date: dueDate,
      transaction_date: dueDate ?? new Date().toISOString().slice(0, 10),
      status: "pending",
      source: "manual",
      created_by: ctx.userId ?? null,
      category_id: asString(payload.categoryId),
      account_id: asString(payload.accountId),
    });

    return skillResult.success(
      `Receita "${description}" registrada.`,
      tx,
      [{ id: "open_finance", title: "Abrir Financeiro", actionLabel: "Ver" }],
    );
  },
};

/* ---------------- Caixa: suprimento / sangria ---------------- */

function requireCashMovementFields(payload: Record<string, unknown>) {
  const sessionId = asString(payload.sessionId);
  const amount = asAmount(payload.amount);
  const reason = asString(payload.reason);
  const missing = [];
  if (!sessionId)
    missing.push({
      field: "sessionId",
      label: "Sessão de caixa",
      type: "uuid" as const,
      required: true as const,
      hint: "Abra o caixa antes de registrar movimentos.",
    });
  if (!amount) missing.push({ field: "amount", label: "Valor (R$)", type: "money" as const, required: true as const });
  if (!reason) missing.push({ field: "reason", label: "Motivo", type: "text" as const, required: true as const });
  return { sessionId, amount, reason, missing };
}

export const registerCashSupplySkill: BellaSkill = {
  id: "cash.register_supply",
  name: "Registrar suprimento",
  module: "finance",
  description: "Entrada de dinheiro no caixa (suprimento).",
  canExecute: (ctx) => Boolean(ctx.companyId),
  async execute(payload, ctx) {
    const { sessionId, amount, reason, missing } = requireCashMovementFields(payload);
    if (missing.length) return skillResult.missing("Informe os dados do suprimento.", missing);

    const movement = await cashService.registerMovement({
      sessionId: sessionId!,
      companyId: ctx.companyId,
      createdBy: ctx.userId ?? null,
      type: "cash_in",
      amount: amount!,
      reason: reason!,
      note: asString(payload.note),
    });

    return skillResult.success(`Suprimento de caixa registrado.`, movement);
  },
};

export const registerCashWithdrawalSkill: BellaSkill = {
  id: "cash.register_withdrawal",
  name: "Registrar sangria",
  module: "finance",
  description: "Saída de dinheiro do caixa (sangria).",
  canExecute: (ctx) => Boolean(ctx.companyId),
  async execute(payload, ctx) {
    const { sessionId, amount, reason, missing } = requireCashMovementFields(payload);
    if (missing.length) return skillResult.missing("Informe os dados da sangria.", missing);

    const movement = await cashService.registerMovement({
      sessionId: sessionId!,
      companyId: ctx.companyId,
      createdBy: ctx.userId ?? null,
      type: "cash_out",
      amount: amount!,
      reason: reason!,
      note: asString(payload.note),
    });

    return skillResult.success(`Sangria de caixa registrada.`, movement);
  },
};

import { financeQueryService } from "@/features/finance/services/finance-query.service";

export const getCashBalanceSkill: BellaSkill = {
  id: "finance.get_cash_balance",
  name: "Consultar saldo",
  module: "finance",
  description: "Consulta o saldo financeiro atual da empresa.",
  canExecute: (ctx) => Boolean(ctx.companyId),
  async execute(_payload, ctx) {
    const snap = await financeQueryService.snapshot(ctx.companyId);
    const brl = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    return skillResult.success(
      [
        `💰 Caixa`,
        `• Saldo: ${brl(snap.overview.currentBalance)}`,
        `• A receber: ${brl(snap.overview.receivable)}`,
        `• A pagar: ${brl(snap.overview.payable)}`,
      ].join("\n"),
      snap,
      [{ id: "open_finance", title: "Abrir Financeiro", actionLabel: "Ver" }],
    );
  },
};

export const getReceivablesSkill: BellaSkill = {
  id: "finance.get_receivables",
  name: "Contas a receber",
  module: "finance",
  description: "Consulta os lançamentos pendentes de entrada.",
  canExecute: (ctx) => Boolean(ctx.companyId),
  async execute(_payload, ctx) {
    const snap = await financeQueryService.snapshot(ctx.companyId);
    const brl = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    return skillResult.success(
      [
        `📈 Contas a Receber`,
        `• Total pendente: ${brl(snap.overview.receivable)}`,
        snap.overdueAmount > 0 ? `• ⚠️ Vencidos: ${brl(snap.overdueAmount)} (${snap.overdueCount} título(s))` : "• ✅ Tudo em dia!",
        `• Previsto 30d: ${brl(snap.forecast30d.incoming)}`,
      ].join("\n"),
      snap,
      [{ id: "open_finance_receivables", title: "Ver Recebíveis", actionLabel: "Ver" }],
    );
  },
};

export const getPayablesSkill: BellaSkill = {
  id: "finance.get_payables",
  name: "Contas a pagar",
  module: "finance",
  description: "Consulta os lançamentos pendentes de saída.",
  canExecute: (ctx) => Boolean(ctx.companyId),
  async execute(_payload, ctx) {
    const snap = await financeQueryService.snapshot(ctx.companyId);
    const brl = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    return skillResult.success(
      [
        `📉 Contas a Pagar`,
        `• Total pendente: ${brl(snap.overview.payable)}`,
        `• Previsto 30d: ${brl(snap.forecast30d.outgoing)}`,
      ].join("\n"),
      snap,
      [{ id: "open_finance_payables", title: "Ver a Pagar", actionLabel: "Ver" }],
    );
  },
};

export const financeSkills: BellaSkill[] = [
  registerExpenseSkill,
  registerIncomeSkill,
  registerCashSupplySkill,
  registerCashWithdrawalSkill,
  getCashBalanceSkill,
  getReceivablesSkill,
  getPayablesSkill,
];
