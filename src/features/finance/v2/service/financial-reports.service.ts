/**
 * FinancialReportsService (Sprint 006)
 *
 * KPIs consolidados e recomendação prudencial de pró-labore.
 * Somente leitura.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type {
  FinanceSummary,
  ProLaboreRecommendation,
} from "../types";
import { AccountsReceivableRepository } from "../repository/receivables.repository";
import { AccountsPayableRepository } from "../repository/payables.repository";
import { CashFlowRepository } from "../repository/cashflow.repository";
import { CashFlowService } from "./cashflow.service";
import { financeQueryService } from "@/features/finance/services/finance-query.service";

export class FinancialReportsService extends BaseService {
  private readonly ar: AccountsReceivableRepository;
  private readonly ap: AccountsPayableRepository;
  private readonly cash: CashFlowRepository;
  private readonly cashSvc: CashFlowService;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.ar = new AccountsReceivableRepository(ctx);
    this.ap = new AccountsPayableRepository(ctx);
    this.cash = new CashFlowRepository(ctx);
    this.cashSvc = new CashFlowService(ctx);
  }

  async summary(): Promise<FinanceSummary> {
    const [position, ar, ap] = await Promise.all([
      this.cash.cashPosition(),
      this.ar.sumOpen(),
      this.ap.sumOpen(),
    ]);

    const now = new Date();
    const startDay = new Date(now);
    startDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(startDay.getTime() + 86400_000);
    const receiptsToday = await this.ar.receiptsSince(
      startDay.toISOString(),
      nextDay.toISOString(),
    );

    const forecast = await this.cashSvc.forecast(30);
    return {
      currentBalance: position.totalBalance,
      totalReceivable: ar.total,
      totalPayable: ap.total,
      receivableOverdue: ar.overdue,
      payableOverdue: ap.overdue,
      receiptsToday,
      projected30d: forecast.endingBalance,
    };
  }

  /**
   * Recomendação prudencial de pró-labore.
   *
   * CORRIGIDO (2026-09-21, auditoria de pró-labore — achado #3): a versão
   * anterior comparava com as despesas JÁ PAGAS no mês corrente — no início
   * do mês (dia 1 a 5), quase nada tinha sido pago ainda, então a reserva
   * calculada ficava perto de zero e o sistema liberava quase todo o caixa
   * como "seguro". O teto seguro agora vem sempre de
   * `compute_prolabore_safe_amount` (mesma fonte usada pelo Advisor e pelo
   * botão de retirada) — caixa menos contas a pagar previstas pros
   * próximos 30 dias menos custo de reposição do estoque vendido nos
   * últimos 30 dias. `reserveMonths` deixou de ser usado no cálculo do
   * teto (mantido só na assinatura por compatibilidade).
   */
  async proLabore(_reserveMonths = 3): Promise<ProLaboreRecommendation> {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const [paidRows, safe] = await Promise.all([
      this.cash.paidBetween(firstDay, nextMonth),
      financeQueryService.proLaboreSafeAmount(this.companyId, this.supabase),
    ]);

    let monthIncome = 0;
    let monthExpense = 0;
    for (const r of paidRows) {
      const v = Number(r.amount ?? 0);
      if (r.type === "income") monthIncome += v;
      else if (r.type === "expense") monthExpense += v;
    }
    const net = monthIncome - monthExpense;
    const reserveTarget = safe.payables30d + safe.restockReserve30d;
    const suggestedMax = safe.safeAmount;
    const safeFlag = suggestedMax > 0;
    const reason = safeFlag
      ? `Sugestão baseada no caixa disponível (R$ ${safe.cashBalance.toFixed(2)}), descontando contas a pagar dos próximos 30 dias (R$ ${safe.payables30d.toFixed(2)}) e o custo de reposição do estoque vendido (R$ ${safe.restockReserve30d.toFixed(2)}).`
      : "Sem margem segura: caixa insuficiente após separar contas a pagar previstas e o custo de reposição de estoque.";

    return {
      monthIncome,
      monthExpense,
      netMonth: net,
      currentBalance: safe.cashBalance,
      reserveTarget,
      suggestedMax,
      safe: safeFlag,
      reason,
    };
  }
}
