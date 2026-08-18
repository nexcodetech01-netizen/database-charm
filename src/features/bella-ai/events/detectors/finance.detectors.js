import { deriveEventKey } from "../BellaEventRegistry";
import { emptyResult, } from "./DetectorTypes";
export const cashflowNegativeDetector = {
    id: "finance.cashflow.negative",
    module: "finance",
    detect(input, ctx) {
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
export const overdueInvoiceDetector = {
    id: "finance.invoice.overdue",
    module: "finance",
    detect(invoices, ctx) {
        return {
            emit: invoices.map((i) => ({
                type: "finance.invoice.overdue",
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
function revenueBanded(input, ctx, kind) {
    const threshold = (input.thresholdPct ?? 15) / 100;
    if (input.averageRevenue <= 0)
        return emptyResult();
    const diff = (input.currentRevenue - input.averageRevenue) / input.averageRevenue;
    const above = "finance.revenue.above_average";
    const below = "finance.revenue.below_average";
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
export const revenueAboveAverageDetector = {
    id: "finance.revenue.above_average",
    module: "finance",
    detect: (input, ctx) => revenueBanded(input, ctx, "above"),
};
export const revenueBelowAverageDetector = {
    id: "finance.revenue.below_average",
    module: "finance",
    detect: (input, ctx) => revenueBanded(input, ctx, "below"),
};
export const expenseElevatedDetector = {
    id: "finance.expense.elevated",
    module: "finance",
    detect(input, ctx) {
        const threshold = (input.thresholdPct ?? 25) / 100;
        if (input.averageExpense <= 0)
            return emptyResult();
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
