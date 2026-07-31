/**
 * Rankings executivos (produtos, clientes, fornecedores).
 *
 * Ordenações puras sobre os dados já agregados pela RPC. Nenhuma regra
 * financeira é recalculada aqui.
 */

import type {
  ExecutiveCustomerRow,
  ExecutiveProductRow,
  ExecutiveSupplierRow,
} from "../types";

const top = <T>(rows: T[], compare: (a: T, b: T) => number, limit: number): T[] =>
  [...rows].sort(compare).slice(0, limit);

export interface ProductRankings {
  topProfit: ExecutiveProductRow[];
  topRevenue: ExecutiveProductRow[];
  topMargin: ExecutiveProductRow[];
  lowestMargin: ExecutiveProductRow[];
  topTurnover: ExecutiveProductRow[];
  lowestTurnover: ExecutiveProductRow[];
  staleStock: ExecutiveProductRow[];
  negative: ExecutiveProductRow[];
}

export function rankProducts(rows: ExecutiveProductRow[], limit = 10): ProductRankings {
  const sold = rows.filter((p) => p.quantitySold > 0);
  return {
    topProfit: top(sold, (a, b) => b.profit - a.profit, limit),
    topRevenue: top(sold, (a, b) => b.revenue - a.revenue, limit),
    topMargin: top(sold, (a, b) => b.margin - a.margin, limit),
    lowestMargin: top(sold, (a, b) => a.margin - b.margin, limit),
    topTurnover: top(sold, (a, b) => b.turnover - a.turnover, limit),
    lowestTurnover: top(
      rows.filter((p) => p.stock > 0),
      (a, b) => a.turnover - b.turnover,
      limit,
    ),
    staleStock: top(
      rows.filter((p) => p.stock > 0 && p.quantitySold === 0),
      (a, b) => b.stock - a.stock,
      limit,
    ),
    negative: top(
      rows.filter((p) => p.revenue > 0 && p.profit < 0),
      (a, b) => a.profit - b.profit,
      limit,
    ),
  };
}

export interface CustomerRankings {
  topRevenue: ExecutiveCustomerRow[];
  topProfitable: ExecutiveCustomerRow[];
  topOverdue: ExecutiveCustomerRow[];
  topRecurring: ExecutiveCustomerRow[];
  topTicket: ExecutiveCustomerRow[];
}

export function rankCustomers(rows: ExecutiveCustomerRow[], marginRatio = 0, limit = 10): CustomerRankings {
  const active = rows.filter((c) => c.salesCount > 0);
  return {
    topRevenue: top(active, (a, b) => b.revenue - a.revenue, limit),
    // "Mais lucrativo" usa a margem consolidada da empresa aplicada à
    // receita do cliente — não recalcula custo por venda.
    topProfitable: top(active, (a, b) => b.revenue * marginRatio - a.revenue * marginRatio, limit),
    topOverdue: top(rows.filter((c) => c.overdueAmount > 0), (a, b) => b.overdueAmount - a.overdueAmount, limit),
    topRecurring: top(active, (a, b) => b.salesCount - a.salesCount, limit),
    topTicket: top(active, (a, b) => b.averageTicket - a.averageTicket, limit),
  };
}

export interface SupplierRankings {
  topVolume: ExecutiveSupplierRow[];
  topCost: ExecutiveSupplierRow[];
  topAverageIncrease: ExecutiveSupplierRow[];
  longestLeadTime: ExecutiveSupplierRow[];
  bestSavings: ExecutiveSupplierRow[];
}

export function rankSuppliers(rows: ExecutiveSupplierRow[], limit = 10): SupplierRankings {
  const active = rows.filter((s) => s.purchasesCount > 0);
  const avg = active.length
    ? active.reduce((a, s) => a + s.averageAmount, 0) / active.length
    : 0;
  return {
    topVolume: top(active, (a, b) => b.purchasesCount - a.purchasesCount, limit),
    topCost: top(active, (a, b) => b.totalAmount - a.totalAmount, limit),
    topAverageIncrease: top(
      active.filter((s) => s.averageAmount > avg),
      (a, b) => b.averageAmount - a.averageAmount,
      limit,
    ),
    longestLeadTime: top(rows, (a, b) => b.deliveryDays - a.deliveryDays, limit),
    bestSavings: top(
      active.filter((s) => s.averageAmount < avg),
      (a, b) => a.averageAmount - b.averageAmount,
      limit,
    ),
  };
}
