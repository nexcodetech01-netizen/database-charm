/**
 * CashFlowService (Sprint 006)
 *
 * Consolida posição de caixa e projeção de fluxo. Somente leitura —
 * nenhum saldo é alterado aqui; toda mutação passa pelas RPCs oficiais.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type {
  CashFlowProjection,
  CashFlowProjectionDay,
  CashPositionSnapshot,
} from "../types";
import { CashFlowRepository } from "../repository/cashflow.repository";

export class CashFlowService extends BaseService {
  private readonly repo: CashFlowRepository;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.repo = new CashFlowRepository(ctx);
  }

  async position(): Promise<CashPositionSnapshot> {
    return this.repo.cashPosition();
  }

  async forecast(horizonDays = 30): Promise<CashFlowProjection> {
    const h = Math.max(1, Math.min(180, Math.round(horizonDays)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + h * 86400_000).toISOString().slice(0, 10);

    const [position, pending] = await Promise.all([
      this.repo.cashPosition(),
      this.repo.pendingBetween(start, end),
    ]);

    const byDay = new Map<string, { inflow: number; outflow: number }>();
    for (let i = 0; i <= h; i++) {
      const d = new Date(today.getTime() + i * 86400_000).toISOString().slice(0, 10);
      byDay.set(d, { inflow: 0, outflow: 0 });
    }
    for (const r of pending) {
      if (!r.due_date) continue;
      const slot = byDay.get(r.due_date);
      if (!slot) continue;
      const v = Number(r.amount ?? 0);
      if (r.type === "income") slot.inflow += v;
      else if (r.type === "expense") slot.outflow += v;
    }

    let totalInflow = 0;
    let totalOutflow = 0;
    let running = position.totalBalance;
    const days: CashFlowProjectionDay[] = [];
    for (const [date, agg] of byDay) {
      const net = agg.inflow - agg.outflow;
      totalInflow += agg.inflow;
      totalOutflow += agg.outflow;
      running += net;
      days.push({ date, inflow: agg.inflow, outflow: agg.outflow, net, runningBalance: running });
    }

    return {
      startingBalance: position.totalBalance,
      horizonDays: h,
      totalInflow,
      totalOutflow,
      endingBalance: running,
      days,
    };
  }
}
