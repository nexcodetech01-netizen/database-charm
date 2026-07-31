/**
 * Bella Contadora — adaptadores das portas para os serviços reais do NexOS.
 *
 * Cada método é um *delegate* fino. É proibido adicionar cálculo de negócio
 * aqui: se o número não existe em um serviço, ele não existe para a Bella.
 */
import { accountingService, lastNMonths } from "@/features/accounting";
import { financeQueryService } from "@/features/finance";
import { salesService } from "@/features/sales/services/sales.service";
import { reportsService } from "@/features/reports/services/reports.service";
import { inventoryService } from "@/features/inventory";
import { taxService, toCompetence } from "@/features/tax";
import { cashService } from "@/features/cash";
import type { AccountingPeriod } from "../types";
import type {
  AccountingAiServices,
  AccountingPort,
  CashPort,
  FinancePort,
  FiscalPort,
  InventoryPort,
  SalesPort,
} from "./ports";

const toRange = (period: AccountingPeriod) =>
  ({ from: period.start, to: period.end, preset: "custom" }) as const;

export const accountingAdapter: AccountingPort = {
  dre: (companyId, period) => accountingService.dre(companyId, period.start, period.end),
  balanceSheet: (companyId, asOf) => accountingService.balanceSheet(companyId, asOf),
  kpis: (companyId, period) => accountingService.kpis(companyId, period.start, period.end),
  monthlyEvolution: (companyId, months) =>
    accountingService.monthlyEvolution(companyId, lastNMonths(months)),
};

export const financeAdapter: FinancePort = {
  snapshot: (companyId) => financeQueryService.snapshot(companyId),
};

export const salesAdapter: SalesPort = {
  async metrics(companyId, period) {
    const m = await salesService.metrics(companyId, {
      from: period.start,
      to: period.end,
    });
    return {
      monthTotal: m.monthTotal,
      monthCount: m.monthCount,
      averageTicket: m.averageTicket,
      paidTotal: m.paidTotal,
      dayTotal: m.dayTotal,
      dayCount: m.dayCount,
    };
  },
  products: (companyId, period) => reportsService.products(companyId, toRange(period)),
  customers: (companyId, period) => reportsService.customers(companyId, toRange(period)),
};

export const inventoryAdapter: InventoryPort = {
  metrics: (companyId) => inventoryService.metrics(companyId),
};

export const fiscalAdapter: FiscalPort = {
  monthlyRevenue: (companyId, competence) =>
    taxService.monthlyRevenue(companyId, competence || toCompetence()),
  apportionments: (companyId, limit) => taxService.listApportionments(companyId, limit),
};

export const cashAdapter: CashPort = {
  async listSessions(companyId, limit) {
    const sessions = await cashService.listSessions(companyId, limit ?? 10);
    return (sessions ?? []).map((s) => ({ status: String(s.status ?? "") }));
  },
};

/** Bundle padrão de produção. Testes injetam fakes com o mesmo shape. */
export const accountingAiServices: AccountingAiServices = {
  accounting: accountingAdapter,
  finance: financeAdapter,
  sales: salesAdapter,
  inventory: inventoryAdapter,
  fiscal: fiscalAdapter,
  cash: cashAdapter,
};
