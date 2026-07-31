import { deriveEventKey } from "../BellaEventRegistry";
import {
  emptyResult,
  type BellaEventDetector,
  type DetectorContext,
  type DetectorResult,
} from "./DetectorTypes";

// ==================== Caixa negativo ====================

export interface CashflowInput {
  /** Saldo consolidado do dia (entradas - saídas). */
  balance: number;
}

export const cashflowNegativeDetector: BellaEventDetector<CashflowInput> = {
  id: "finance.cashflow.negative",
  module: "finance",
  detect(input, ctx): DetectorResult {
    if (input.balance < 0) {
      return {
        emit: [
          {
            type: "finance.cashflow.negative",
            tenantId: ctx.tenantId,
            payload: { balance: input.balance, at: ctx.now.toISOString() },
            source: "detector:finance.cashflow",
          },
        ],
        resolve: [],
      };
    }
    return {
      emit: [],
      resolve: [deriveEventKey({ tenantId: ctx.tenantId, type: "finance.cashflow.negative", payload: {} })],
    };
  },
};

// ==================== Contas vencidas ====================

export interface OverdueInvoice {
  invoiceId: string;
  customerId?: string;
  amount: number;
  dueDate: Date;
}

export const overdueInvoiceDetector: BellaEventDetector<OverdueInvoice[]> = {
  id: "finance.invoice.overdue",
  module: "finance",
  detect(invoices, ctx): DetectorResult {
    return {
      emit: invoices.map((i) => ({
        type: "finance.invoice.overdue" as const,
        tenantId: ctx.tenantId,
        payload: {
          entityId: i.invoiceId,
          customerId: i.customerId,
          amount: i.amount,
          dueDate: i.dueDate.toISOString(),
        },
        source: "detector:finance.invoice",
      })),
      resolve: [],
    };
  },
};

// ==================== Receita vs média ====================

export interface RevenueWindowInput {
  currentRevenue: number;
  averageRevenue: number;
  /** Percentual acima/abaixo para disparar. Default: 15%. */
  thresholdPct?: number;
}

function revenueBanded(input: RevenueWindowInput, ctx: DetectorContext, kind: "above" | "below"): DetectorResult {
  const threshold = (input.thresholdPct ?? 15) / 100;
  if (input.averageRevenue <= 0) return emptyResult();
  const diff = (input.currentRevenue - input.averageRevenue) / input.averageRevenue;
  const above = "finance.revenue.above_average" as const;
  const below = "finance.revenue.below_average" as const;
  const activeType = kind === "above" ? above : below;
  const oppositeType = kind === "above" ? below : above;
  const triggered = kind === "above" ? diff >= threshold : diff <= -threshold;

  if (triggered) {
    return {
      emit: [
        {
          type: activeType,
          tenantId: ctx.tenantId,
          payload: {
            current: input.currentRevenue,
            average: input.averageRevenue,
            deltaPct: Math.round(diff * 100),
          },
          source: `detector:${activeType}`,
        },
      ],
      resolve: [deriveEventKey({ tenantId: ctx.tenantId, type: oppositeType, payload: {} })],
    };
  }
  return {
    emit: [],
    resolve: [deriveEventKey({ tenantId: ctx.tenantId, type: activeType, payload: {} })],
  };
}

export const revenueAboveAverageDetector: BellaEventDetector<RevenueWindowInput> = {
  id: "finance.revenue.above_average",
  module: "finance",
  detect: (input, ctx) => revenueBanded(input, ctx, "above"),
};

export const revenueBelowAverageDetector: BellaEventDetector<RevenueWindowInput> = {
  id: "finance.revenue.below_average",
  module: "finance",
  detect: (input, ctx) => revenueBanded(input, ctx, "below"),
};

// ==================== Despesa elevada ====================

export interface ExpenseInput {
  currentExpense: number;
  averageExpense: number;
  /** Percentual acima da média para disparar. Default: 25%. */
  thresholdPct?: number;
}

export const expenseElevatedDetector: BellaEventDetector<ExpenseInput> = {
  id: "finance.expense.elevated",
  module: "finance",
  detect(input, ctx): DetectorResult {
    const threshold = (input.thresholdPct ?? 25) / 100;
    if (input.averageExpense <= 0) return emptyResult();
    const diff = (input.currentExpense - input.averageExpense) / input.averageExpense;
    if (diff >= threshold) {
      return {
        emit: [
          {
            type: "finance.expense.elevated",
            tenantId: ctx.tenantId,
            payload: {
              current: input.currentExpense,
              average: input.averageExpense,
              deltaPct: Math.round(diff * 100),
            },
            source: "detector:finance.expense",
          },
        ],
        resolve: [],
      };
    }
    return {
      emit: [],
      resolve: [deriveEventKey({ tenantId: ctx.tenantId, type: "finance.expense.elevated", payload: {} })],
    };
  },
};
