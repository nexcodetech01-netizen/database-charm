export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_year"
  | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  preset: DateRangePreset;
}

export interface ExecutiveMetrics {
  totalRevenue: number;
  grossProfit: number;
  totalSales: number;
  productsSold: number;
  activeCustomers: number;
  inventoryValue: number;
  receivable: number;
  payable: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  label: string; // dd/MM
  value: number;
}

export interface SalesReport {
  metrics: {
    revenue: number;
    /** Receita líquida no período (bruto − taxas de recebimento). */
    netRevenue: number;
    /** Total retido pelas adquirentes/PIX no período. */
    paymentFees: number;
    count: number;
    avgTicket: number;
    itemsSold: number;
    revenueToday: number;
    revenueMonth: number;
    /** Receita líquida do mês corrente. */
    netRevenueMonth: number;
  };
  daily: DailyPoint[];
  byPaymentMethod: { name: string; value: number }[];
  byStatus: { name: string; value: number }[];
  topSales: {
    id: string;
    number: string | null;
    date: string;
    customer: string | null;
    total: number;
    status: string;
  }[];
}

export interface FinanceReport {
  metrics: {
    income: number;
    expense: number;
    balance: number;
    receivable: number;
    payable: number;
  };
  daily: { date: string; label: string; income: number; expense: number; balance: number }[];
  byCategory: { name: string; income: number; expense: number }[];
}

export interface InventoryReport {
  metrics: {
    inventoryValue: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    turnover: number;
  };
  lowStock: { id: string; name: string; sku: string | null; stock: number; min_stock: number }[];
  topMoved: { id: string; name: string; movements: number; units: number }[];
  stagnant: { id: string; name: string; sku: string | null; stock: number; last_move: string | null }[];
}

export interface PurchasesReport {
  metrics: {
    total: number;
    count: number;
    received: number;
    pending: number;
  };
  daily: DailyPoint[];
  byStatus: { name: string; value: number }[];
  topSuppliers: { id: string | null; name: string; total: number; count: number }[];
}

export interface ProductsReport {
  bestSellers: { id: string; name: string; sku: string | null; quantity: number; revenue: number }[];
  worstSellers: { id: string; name: string; sku: string | null; quantity: number; revenue: number }[];
  noMovement: { id: string; name: string; sku: string | null; stock: number }[];
}

export interface CustomersReport {
  metrics: {
    total: number;
    active: number;
    newInRange: number;
    recurring: number;
    inactive: number;
  };
  daily: DailyPoint[]; // new customers per day
  topCustomers: { id: string; name: string; purchases: number; revenue: number }[];
}
