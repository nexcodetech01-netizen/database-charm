import { supabase } from "@/integrations/supabase/client";
import { daysBetween, labelDay, rangeToTimestamp } from "@/features/reports/utils/date-range";
import type { DateRange } from "@/features/reports/types";
import {
  computeNetAmount,
  paymentMethodsService,
} from "@/features/payment-methods";

const num = (v: unknown) => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  payment_link: "Link de Pagamento",
  card: "Cartão",
  bella_pay: "Bella Pay",
  transfer: "Transferência",
  boleto: "Boleto",
};

export interface ExecKpis {
  revenueToday: number;
  revenueMonth: number;
  revenueRange: number;
  /** Receita líquida no período (bruto − taxas de recebimento). */
  netRevenueRange: number;
  /** Receita líquida no mês. */
  netRevenueMonth: number;
  /** Total de taxas retidas pelas adquirentes/PIX no período. */
  paymentFees: number;
  avgTicket: number;
  /** Lucro líquido = receita líquida − COGS. */
  grossProfit: number;
  /** Margem líquida = grossProfit / netRevenueRange. */
  margin: number; // 0..1
  newCustomers: number;
  salesCount: number;
  productsSold: number;
  lowStockCount: number;
  receivable: number;
  payable: number;
  currentBalance: number;
}

export interface ExecCharts {
  salesDaily: { date: string; label: string; value: number }[];
  incomeVsExpense: { date: string; label: string; income: number; expense: number }[];
  paymentMethods: { name: string; value: number }[];
  topProducts: { name: string; value: number }[];
}

export interface ExecRankings {
  topProducts: {
    id: string;
    name: string;
    sku: string | null;
    quantity: number;
    revenue: number;
  }[];
  topCustomers: {
    id: string;
    name: string;
    purchases: number;
    revenue: number;
  }[];
  topSellers: {
    id: string;
    name: string;
    sales: number;
    revenue: number;
  }[];
}

export interface ExecAlerts {
  criticalStock: number;
  overdueAccounts: number;
  pendingPix: number;
  overdueCharges: number;
  openCashSessions: number;
}

export interface ExecutiveDashboardData {
  kpis: ExecKpis;
  charts: ExecCharts;
  rankings: ExecRankings;
  alerts: ExecAlerts;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStartISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export const executiveDashboardService = {
  async build(companyId: string, range: DateRange): Promise<ExecutiveDashboardData> {
    // P2.4 — hoje/início do mês calculados no fuso da empresa (servidor).
    const [{ data: todayRpc }, { data: monthRpc }] = await Promise.all([
      supabase.rpc("company_today", { _company_id: companyId }),
      supabase.rpc("company_month_start", { _company_id: companyId }),
    ]);
    const today =
      (typeof todayRpc === "string" && todayRpc) || todayISO();
    const monthStart =
      (typeof monthRpc === "string" && monthRpc) || monthStartISO();
    const { fromTs, toTs } = rangeToTimestamp(range);

    const [
      salesInRange,
      itemsInRange,
      monthSales,
      productsAll,
      newCustomersRes,
      finRows,
      accountsRes,
      overdueAccountsRes,
      pendingPixRes,
      overdueChargesRes,
      openCashRes,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id, grand_total, status, sale_date, payment_method, installments, customer_id, created_by")
        .eq("company_id", companyId)
        .eq("status", "paid")
        .gte("sale_date", range.from)
        .lte("sale_date", range.to),
      supabase
        .from("sale_items")
        .select(
          "product_id, quantity, unit_price, total, sale:sales!inner(company_id, sale_date, status)",
        )
        .eq("sale.company_id", companyId)
        .eq("sale.status", "paid")
        .gte("sale.sale_date", range.from)
        .lte("sale.sale_date", range.to),
      supabase
        .from("sales")
        .select("grand_total, sale_date, payment_method, installments")
        .eq("company_id", companyId)
        .eq("status", "paid")
        .gte("sale_date", monthStart)
        .lte("sale_date", today),
      supabase
        .from("products")
        .select("id, name, sku, stock, min_stock, cost, status")
        .eq("company_id", companyId),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", fromTs)
        .lte("created_at", toTs),
      supabase
        .from("financial_transactions")
        .select("type, amount, status, transaction_date")
        .eq("company_id", companyId)
        .gte("transaction_date", range.from)
        .lte("transaction_date", range.to),
      supabase
        .from("financial_accounts")
        .select("current_balance, status")
        .eq("company_id", companyId),
      supabase
        .from("financial_transactions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "overdue"),
      supabase
        .from("bella_pay_charges")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("billing_type", "PIX")
        .eq("status", "PENDING"),
      supabase
        .from("bella_pay_charges")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "OVERDUE"),
      supabase
        .from("cash_sessions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "open"),
    ]);

    if (salesInRange.error) throw salesInRange.error;
    if (itemsInRange.error) throw itemsInRange.error;
    if (monthSales.error) throw monthSales.error;
    if (productsAll.error) throw productsAll.error;
    if (newCustomersRes.error) throw newCustomersRes.error;
    if (finRows.error) throw finRows.error;
    if (accountsRes.error) throw accountsRes.error;

    const sales = salesInRange.data ?? [];
    const items = itemsInRange.data ?? [];
    const products = productsAll.data ?? [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    const lowStockCount = products.filter(
      (p) => p.status !== "inactive" && num(p.min_stock) > 0 && num(p.stock) <= num(p.min_stock),
    ).length;

    // KPIs
    const fees = await paymentMethodsService.list(companyId).catch(() => []);
    const feeFor = (s: {
      grand_total?: number | string | null;
      payment_method?: string | null;
      installments?: number | null;
    }) =>
      computeNetAmount({
        gross: num(s.grand_total),
        paymentMethod: s.payment_method ?? null,
        installments: s.installments ?? null,
        fees,
      });

    let revenueRange = 0;
    let netRevenueRange = 0;
    let paymentFees = 0;
    for (const s of sales) {
      const b = feeFor(s);
      revenueRange += num(s.grand_total);
      netRevenueRange += b.net;
      paymentFees += b.feeAmount;
    }

    let revenueMonth = 0;
    let netRevenueMonth = 0;
    let revenueToday = 0;
    for (const r of monthSales.data ?? []) {
      const g = num(r.grand_total);
      const b = feeFor(r);
      revenueMonth += g;
      netRevenueMonth += b.net;
      if (String(r.sale_date) === today) revenueToday += g;
    }

    let cogs = 0;
    let productsSold = 0;
    for (const it of items) {
      const qty = num(it.quantity);
      productsSold += qty;
      if (it.product_id) {
        cogs += qty * num(productMap.get(it.product_id)?.cost ?? 0);
      }
    }
    // Lucro/margem passam a considerar a receita líquida (após taxas).
    const grossProfit = netRevenueRange - cogs;
    const margin = netRevenueRange > 0 ? grossProfit / netRevenueRange : 0;

    let receivable = 0;
    let payable = 0;
    const days = daysBetween(range.from, range.to);
    const dailyFin = new Map(days.map((d) => [d, { income: 0, expense: 0 }]));
    for (const r of finRows.data ?? []) {
      const amt = num(r.amount);
      if (r.status === "paid") {
        const key = String(r.transaction_date);
        const b = dailyFin.get(key);
        if (b) {
          if (r.type === "income") b.income += amt;
          if (r.type === "expense") b.expense += amt;
        }
      } else if (r.status === "pending" || r.status === "overdue") {
        if (r.type === "income") receivable += amt;
        if (r.type === "expense") payable += amt;
      }
    }
    const currentBalance = (accountsRes.data ?? [])
      .filter((a) => a.status !== "inactive")
      .reduce((s, a) => s + num(a.current_balance), 0);

    const kpis: ExecKpis = {
      revenueToday,
      revenueMonth,
      revenueRange,
      netRevenueRange,
      netRevenueMonth,
      paymentFees,
      avgTicket: sales.length > 0 ? revenueRange / sales.length : 0,
      grossProfit,
      margin,
      newCustomers: newCustomersRes.count ?? 0,
      salesCount: sales.length,
      productsSold,
      lowStockCount,
      receivable,
      payable,
      currentBalance,
    };

    // Charts
    const dailySalesMap = new Map(days.map((d) => [d, 0]));
    for (const s of sales) {
      const k = String(s.sale_date);
      if (dailySalesMap.has(k))
        dailySalesMap.set(k, (dailySalesMap.get(k) ?? 0) + num(s.grand_total));
    }
    const salesDaily = days.map((d) => ({
      date: d,
      label: labelDay(d),
      value: dailySalesMap.get(d) ?? 0,
    }));

    const incomeVsExpense = days.map((d) => {
      const b = dailyFin.get(d)!;
      return { date: d, label: labelDay(d), income: b.income, expense: b.expense };
    });

    const pmMap = new Map<string, number>();
    for (const s of sales) {
      const k = s.payment_method ?? "—";
      pmMap.set(k, (pmMap.get(k) ?? 0) + num(s.grand_total));
    }
    const paymentMethods = Array.from(pmMap, ([name, value]) => ({
      name: PAYMENT_METHOD_LABELS[name] ?? name,
      value,
    })).sort((a, b) => b.value - a.value);

    // Product rankings
    const perProduct = new Map<string, { quantity: number; revenue: number }>();
    for (const it of items) {
      if (!it.product_id) continue;
      const b = perProduct.get(it.product_id) ?? { quantity: 0, revenue: 0 };
      b.quantity += num(it.quantity);
      b.revenue += num(it.total);
      perProduct.set(it.product_id, b);
    }
    const topProductsList = Array.from(perProduct, ([id, v]) => {
      const p = productMap.get(id);
      return {
        id,
        name: p?.name ?? "—",
        sku: p?.sku ?? null,
        quantity: v.quantity,
        revenue: v.revenue,
      };
    })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topProducts = topProductsList.map((p) => ({ name: p.name, value: p.quantity }));

    // Customer rankings
    const perCustomer = new Map<string, { purchases: number; revenue: number }>();
    for (const s of sales) {
      if (!s.customer_id) continue;
      const b = perCustomer.get(s.customer_id) ?? { purchases: 0, revenue: 0 };
      b.purchases += 1;
      b.revenue += num(s.grand_total);
      perCustomer.set(s.customer_id, b);
    }
    const topCustomerIds = Array.from(perCustomer, ([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    let customerNames = new Map<string, string>();
    if (topCustomerIds.length) {
      const { data: cs } = await supabase
        .from("customers")
        .select("id, name")
        .in(
          "id",
          topCustomerIds.map((c) => c.id),
        );
      customerNames = new Map((cs ?? []).map((c) => [c.id, c.name]));
    }
    const topCustomers = topCustomerIds.map((c) => ({
      id: c.id,
      name: customerNames.get(c.id) ?? "—",
      purchases: c.purchases,
      revenue: c.revenue,
    }));

    // Seller rankings (via created_by on sales)
    const perSeller = new Map<string, { sales: number; revenue: number }>();
    for (const s of sales) {
      if (!s.created_by) continue;
      const b = perSeller.get(s.created_by) ?? { sales: 0, revenue: 0 };
      b.sales += 1;
      b.revenue += num(s.grand_total);
      perSeller.set(s.created_by, b);
    }
    const topSellerIds = Array.from(perSeller, ([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    let sellerNames = new Map<string, string>();
    if (topSellerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          topSellerIds.map((s) => s.id),
        );
      sellerNames = new Map(
        (profs ?? []).map((p) => [p.id, (p.full_name as string | null) ?? "—"]),
      );
    }
    const topSellers = topSellerIds.map((s) => ({
      id: s.id,
      name: sellerNames.get(s.id) ?? "Operador",
      sales: s.sales,
      revenue: s.revenue,
    }));

    const alerts: ExecAlerts = {
      criticalStock: lowStockCount,
      overdueAccounts: overdueAccountsRes.count ?? 0,
      pendingPix: pendingPixRes.count ?? 0,
      overdueCharges: overdueChargesRes.count ?? 0,
      openCashSessions: openCashRes.count ?? 0,
    };

    return {
      kpis,
      charts: { salesDaily, incomeVsExpense, paymentMethods, topProducts },
      rankings: { topProducts: topProductsList, topCustomers, topSellers },
      alerts,
    };
  },
};
