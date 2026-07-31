import type { DateRange } from "@/features/reports/types";

export type { DateRange };

export interface BiFilters {
  companyId: string;
  range: DateRange;
  categoryId?: string | null;
  supplierId?: string | null;
}

export interface BiKpis {
  /** Receita bruta (grand_total) — mantida para comparativos. */
  revenue: number;
  /** Receita líquida — bruto − taxas de recebimento. */
  netRevenue: number;
  /** Total retido pelas adquirentes/PIX no período. */
  paymentFees: number;
  /** Lucro líquido = netRevenue − COGS. */
  grossProfit: number;
  /** Margem líquida = grossProfit / netRevenue. */
  grossMargin: number; // 0..1
  avgTicket: number;
  salesCount: number;
  productsSold: number;
  activeCustomers: number;
  newCustomers: number;
}

export interface BiRankedProduct {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  revenue: number;
  profit: number;
  margin: number; // 0..1
}

export interface BiRankedCategory {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
  margin: number;
}

export interface BiStagnantProduct {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  lastSaleAt: string | null;
}

export interface BiCommercial {
  topSelling: BiRankedProduct[];
  topProfitable: BiRankedProduct[];
  topProfitableCategories: BiRankedCategory[];
  noSales: {
    d30: BiStagnantProduct[];
    d60: BiStagnantProduct[];
    d90: BiStagnantProduct[];
  };
}

export interface BiInventory {
  value: number;
  totalUnits: number;
  coverageDays: number | null; // null when no sales
  turnover: number; // outbound units / totalUnits
  critical: {
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    min_stock: number;
  }[];
}

export interface BiFinance {
  income: number;
  expense: number;
  balance: number;
  receivable: number;
  payable: number;
  dailyFlow: {
    date: string;
    label: string;
    income: number;
    expense: number;
    balance: number;
  }[];
}

export interface BiSuppliers {
  topByVolume: { id: string; name: string; quantity: number }[];
  topByRevenue: { id: string; name: string; total: number }[];
  topByCostIncrease: {
    id: string;
    name: string;
    previousAvgCost: number;
    currentAvgCost: number;
    increasePct: number; // 0..1
  }[];
}

export interface BiDailyPoint {
  date: string;
  label: string;
  value: number;
}

export interface BiCharts {
  revenue7d: BiDailyPoint[];
  revenue30d: BiDailyPoint[];
  revenue90d: BiDailyPoint[];
  profit30d: BiDailyPoint[];
  salesCount30d: BiDailyPoint[];
}

export type AbcClass = "A" | "B" | "C";

export interface BiAbcItem {
  id: string;
  name: string;
  revenue: number;
  share: number; // 0..1
  cumulativeShare: number; // 0..1
  class: AbcClass;
}

export interface BiAbc {
  products: BiAbcItem[];
  categories: BiAbcItem[];
  customers: BiAbcItem[];
}

export interface BiExecutivePanel {
  kpis: BiKpis;
  commercial: BiCommercial;
  inventory: BiInventory;
  finance: BiFinance;
  suppliers: BiSuppliers;
  charts: BiCharts;
  abc: BiAbc;
}
