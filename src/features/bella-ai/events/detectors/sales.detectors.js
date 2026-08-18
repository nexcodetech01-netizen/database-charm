import { deriveEventKey } from "../BellaEventRegistry";
import { emptyResult, } from "./DetectorTypes";
export const salesGoalReachedDetector = {
    id: "sales.goal_reached",
    module: "sales",
    detect(input, ctx) {
        if (input.goal <= 0)
            return emptyResult();
        if (input.currentTotal >= input.goal) {
            return {
                emit: [
                    {
                        type: "sales.goal_reached",
                        tenantId: ctx.tenantId,
                        payload: { current: input.currentTotal, goal: input.goal },
                        source: "detector:sales.goal",
                    },
                ],
                resolve: [],
            };
        }
        return {
            emit: [],
            resolve: [deriveEventKey({ tenantId: ctx.tenantId, type: "sales.goal_reached", payload: {} })],
        };
    },
};
export const salesDeclineDetector = {
    id: "sales.decline",
    module: "sales",
    detect(input, ctx) {
        const threshold = (input.declineThresholdPct ?? 20) / 100;
        if (input.previousPeriodTotal <= 0)
            return emptyResult();
        const diff = (input.currentPeriodTotal - input.previousPeriodTotal) / input.previousPeriodTotal;
        if (diff <= -threshold) {
            return {
                emit: [
                    {
                        type: "sales.decline",
                        tenantId: ctx.tenantId,
                        payload: {
                            current: input.currentPeriodTotal,
                            previous: input.previousPeriodTotal,
                            deltaPct: Math.round(diff * 100),
                        },
                        source: "detector:sales.decline",
                    },
                ],
                resolve: [],
            };
        }
        return {
            emit: [],
            resolve: [deriveEventKey({ tenantId: ctx.tenantId, type: "sales.decline", payload: {} })],
        };
    },
};
export const averageTicketDropDetector = {
    id: "sales.average_ticket.drop",
    module: "sales",
    detect(input, ctx) {
        const threshold = (input.dropThresholdPct ?? 15) / 100;
        if (input.previousAverageTicket <= 0)
            return emptyResult();
        const diff = (input.currentAverageTicket - input.previousAverageTicket) / input.previousAverageTicket;
        if (diff <= -threshold) {
            return {
                emit: [
                    {
                        type: "sales.average_ticket.drop",
                        tenantId: ctx.tenantId,
                        payload: {
                            current: input.currentAverageTicket,
                            previous: input.previousAverageTicket,
                            deltaPct: Math.round(diff * 100),
                        },
                        source: "detector:sales.ticket",
                    },
                ],
                resolve: [],
            };
        }
        return {
            emit: [],
            resolve: [deriveEventKey({ tenantId: ctx.tenantId, type: "sales.average_ticket.drop", payload: {} })],
        };
    },
};
