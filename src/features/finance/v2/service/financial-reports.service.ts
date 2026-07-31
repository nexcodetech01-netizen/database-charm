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
   * Recomendação prudencial de pró-labore. Nunca sugere valor > (saldo + net)
   * e sempre reserva `reserveMonths * despesa_media_mensal` como colchão.
   */
  async proLabore(reserveMonths = 3): Promise<ProLaboreRecommendation> {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const [position, paidRows] = await Promise.all([
      this.cash.cashPosition(),
      this.cash.paidBetween(firstDay, nextMonth),
    ]);

    let monthIncome = 0;
    let monthExpense = 0;
    for (const r of paidRows) {
      const v = Number(r.amount ?? 0);
      if (r.type === "income") monthIncome += v;
      else if (r.type === "expense") monthExpense += v;
    }
    const net = monthIncome - monthExpense;
    const reserveTarget = Math.max(0, monthExpense * reserveMonths);
    const buffer = Math.max(0, position.totalBalance - reserveTarget);
    const suggestedMax = Math.max(0, Math.min(net, buffer));
    const safe = suggestedMax > 0;
    const reason = safe
      ? `Sugestão baseada em receita líquida do mês (R$ ${net.toFixed(2)}) e reserva de ${reserveMonths} mês(es).`
      : "Sem margem prudencial: saldo insuficiente após reserva ou mês negativo.";

    return {
      monthIncome,
      monthExpense,
      netMonth: net,
      currentBalance: position.totalBalance,
      reserveTarget,
      suggestedMax,
      safe,
      reason,
    };
  }
}
