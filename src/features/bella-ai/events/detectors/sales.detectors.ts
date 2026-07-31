import { deriveEventKey } from "../BellaEventRegistry";
import {
  emptyResult,
  type BellaEventDetector,
  type DetectorResult,
} from "./DetectorTypes";

// ==================== Meta atingida ====================

export interface SalesGoalInput {
  currentTotal: number;
  goal: number;
}

export const salesGoalReachedDetector: BellaEventDetector<SalesGoalInput> = {
  id: "sales.goal_reached",
  module: "sales",
  detect(input, ctx): DetectorResult {
    if (input.goal <= 0) return emptyResult();
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

// ==================== Queda de vendas ====================

export interface SalesTrendInput {
  currentPeriodTotal: number;
  previousPeriodTotal: number;
  /** Percentual mínimo de queda para disparar. Default: 20%. */
  declineThresholdPct?: number;
}

export const salesDeclineDetector: BellaEventDetector<SalesTrendInput> = {
  id: "sales.decline",
  module: "sales",
  detect(input, ctx): DetectorResult {
    const threshold = (input.declineThresholdPct ?? 20) / 100;
    if (input.previousPeriodTotal <= 0) return emptyResult();
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

// ==================== Ticket médio caiu ====================

export interface AverageTicketInput {
  currentAverageTicket: number;
  previousAverageTicket: number;
  /** Percentual mínimo de queda para disparar. Default: 15%. */
  dropThresholdPct?: number;
}

export const averageTicketDropDetector: BellaEventDetector<AverageTicketInput> = {
  id: "sales.average_ticket.drop",
  module: "sales",
  detect(input, ctx): DetectorResult {
    const threshold = (input.dropThresholdPct ?? 15) / 100;
    if (input.previousAverageTicket <= 0) return emptyResult();
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
