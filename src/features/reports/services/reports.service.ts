import { supabase } from "@/integrations/supabase/client";
import { applyDataScope } from "@/features/sales/lib/test-data-scope";
import type {
  CustomersReport,
  DateRange,
  ExecutiveMetrics,
  FinanceReport,
  InventoryReport,
  ProductsReport,
  PurchasesReport,
  SalesReport,
} from "../types";
import { daysBetween, labelDay, rangeToTimestamp } from "../utils/date-range";
import { paymentMethodsService, sumNetRevenue } from "@/features/payment-methods";
import { fetchAllRows, fetchInChunks } from "@/lib/supabase-fetch-all";

// AUDITORIA 2026-10-22 — o PostgREST devolve no máximo 1.000 linhas por
// consulta e corta o resto sem avisar. Todas as consultas cujo resultado é
// SOMADO aqui passam por `fetchAllRows` (paginação completa), e as buscas
// `.in("id", [...])` por `fetchInChunks` (lotes, para não estourar a URL).

const num = (v: unknown) => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

async function fetchSalesInRange(companyId: string, range: DateRange) {
  return fetchAllRows(
    applyDataScope(
      supabase
        .from("sales")
        .select("id, number, sale_date, status, payment_method, installments, grand_total, customer_id, paid_at")
        .eq("company_id", companyId)
        .gte("sale_date", range.from)
        .lte("sale_date", range.to),
    ).order("sale_date", { ascending: false }),
  );
}

async function fetchPaidSaleItems(companyId: string, range: DateRange) {
  // sale_items joined via sales (paid, in range)
  return fetchAllRows(
    supabase
      .from("sale_items")
      .select("id, product_id, quantity, unit_price, total, sale:sales!inner(company_id, sale_date, status)")
      .eq("sale.company_id", companyId)
      .eq("sale.status", "paid")
      .gte("sale.sale_date", range.from)
      .lte("sale.sale_date", range.to),
  );
}

export const reportsService = {
  async executive(companyId: string, range: DateRange): Promise<ExecutiveMetrics> {
    const [salesRows, items, productRows, customersAgg, financeRows] = await Promise.all([
      fetchAllRows(
        applyDataScope(
          supabase
            .from("sales")
            .select("id, grand_total, status")
            .eq("company_id", companyId)
            .eq("status", "paid")
            .gte("sale_date", range.from)
            .lte("sale_date", range.to),
        ),
      ),
      fetchPaidSaleItems(companyId, range),
      fetchAllRows(
        supabase
          .from("products")
          .select("id, stock, cost, price")
          .eq("company_id", companyId)
          .neq("status", "inactive"),
      ),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "active"),
      fetchAllRows(
        supabase
          .from("financial_transactions")
          .select("id, type, amount, status")
          .eq("company_id", companyId)
          .in("status", ["pending", "overdue"]),
      ),
    ]);
    if (customersAgg.error) throw customersAgg.error;

    const totalRevenue = salesRows.reduce((s, r) => s + num(r.grand_total), 0);

    let cogs = 0;
    const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean) as string[]));
    let costMap = new Map<string, number>();
    if (productIds.length) {
      const prods = await fetchInChunks(productIds, (chunk) =>
        supabase.from("products").select("id, cost").in("id", chunk),
      );
      costMap = new Map(prods.map((p) => [p.id, num(p.cost)]));
    }
    let productsSold = 0;
    for (const it of items) {
      productsSold += num(it.quantity);
      if (it.product_id) cogs += num(it.quantity) * (costMap.get(it.product_id) ?? 0);
    }

    const inventoryValue = productRows.reduce(
      (s, p) => s + num(p.stock) * num(p.cost),
      0,
    );

    let receivable = 0;
    let payable = 0;
    for (const t of financeRows) {
      if (t.type === "income") receivable += num(t.amount);
      else if (t.type === "expense") payable += num(t.amount);
    }

    return {
      totalRevenue,
      grossProfit: totalRevenue - cogs,
      totalSales: salesRows.length,
      productsSold,
      activeCustomers: customersAgg.count ?? 0,
      inventoryValue,
      receivable,
      payable,
    };
  },

  async sales(companyId: string, range: DateRange): Promise<SalesReport> {
    const sales = await fetchSalesInRange(companyId, range);
    const paid = sales.filter((s) => s.status === "paid");
    const revenue = paid.reduce((s, r) => s + num(r.grand_total), 0);
    const count = paid.length;

    const items = await fetchPaidSaleItems(companyId, range);
    const itemsSold = items.reduce((s, i) => s + num(i.quantity), 0);

    // daily series (paid revenue by sale_date)
    const days = daysBetween(range.from, range.to);
    const dayMap = new Map(days.map((d) => [d, 0]));
    for (const s of paid) {
      const key = String(s.sale_date);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + num(s.grand_total));
    }
    const daily = days.map((d) => ({ date: d, label: labelDay(d), value: dayMap.get(d) ?? 0 }));

    const pmMap = new Map<string, number>();
    for (const s of paid) {
      const k = s.payment_method ?? "—";
      pmMap.set(k, (pmMap.get(k) ?? 0) + num(s.grand_total));
    }
    const statusMap = new Map<string, number>();
    for (const s of sales) {
      const k = s.status ?? "—";
      statusMap.set(k, (statusMap.get(k) ?? 0) + 1);
    }

    // today/month revenue (independent of picked range) - compute lightweight
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const monthStart = `${yyyy}-${mm}-01`;
    const dayStr = `${yyyy}-${mm}-${dd}`;
    const monthData = await fetchAllRows(
      applyDataScope(
        supabase
          .from("sales")
          .select("id, sale_date, grand_total, payment_method, installments")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("sale_date", monthStart)
          .lte("sale_date", dayStr),
      ),
    );
    const revenueMonth = (monthData ?? []).reduce((s, r) => s + num(r.grand_total), 0);
    const revenueToday = (monthData ?? [])
      .filter((r) => String(r.sale_date) === dayStr)
      .reduce((s, r) => s + num(r.grand_total), 0);

    const fees = await paymentMethodsService.list(companyId).catch(() => []);
    const rangeNet = sumNetRevenue(paid, fees);
    const monthNet = sumNetRevenue(monthData ?? [], fees);

    // top sales (by total) — limit 10
    type TopSale = {
      id: string;
      number: string | null;
      date: string;
      customer: string | null;
      total: number;
      status: string;
    };
    const topSales: TopSale[] = [...paid]
      .sort((a, b) => num(b.grand_total) - num(a.grand_total))
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        number: s.number,
        date: String(s.sale_date),
        customer: null,
        total: num(s.grand_total),
        status: s.status ?? "",
      }));

    // Só os clientes do top 10 (antes buscava todos os clientes do período).
    const csIds = Array.from(
      new Set(
        topSales
          .map((t) => paid.find((s) => s.id === t.id)?.customer_id)
          .filter(Boolean) as string[],
      ),
    );
    if (csIds.length) {
      const cs = await fetchInChunks(csIds, (chunk) =>
        supabase.from("customers").select("id, name").in("id", chunk),
      );
      const cm = new Map(cs.map((c) => [c.id, c.name]));
      for (const t of topSales) {
        const src = paid.find((s) => s.id === t.id);
        t.customer = src?.customer_id ? (cm.get(src.customer_id) ?? null) : null;
      }
    }


    return {
      metrics: {
        revenue,
        netRevenue: rangeNet.net,
        paymentFees: rangeNet.fee,
        count,
        avgTicket: count > 0 ? revenue / count : 0,
        itemsSold,
        revenueToday,
        revenueMonth,
        netRevenueMonth: monthNet.net,
      },
      daily,
      byPaymentMethod: Array.from(pmMap, ([name, value]) => ({ name, value })),
      byStatus: Array.from(statusMap, ([name, value]) => ({ name, value })),
      topSales,
    };
  },

  async finance(companyId: string, range: DateRange): Promise<FinanceReport> {
    const rows = await fetchAllRows(
      supabase
        .from("financial_transactions")
        .select("id, type, amount, transaction_date, status, category_id")
        .eq("company_id", companyId)
        .gte("transaction_date", range.from)
        .lte("transaction_date", range.to),
    );

    let income = 0;
    let expense = 0;
    let receivable = 0;
    let payable = 0;
    for (const r of rows) {
      const amt = num(r.amount);
      if (r.status === "paid") {
        if (r.type === "income") income += amt;
        if (r.type === "expense") expense += amt;
      }
      if (r.status === "pending" || r.status === "overdue") {
        if (r.type === "income") receivable += amt;
        if (r.type === "expense") payable += amt;
      }
    }

    const days = daysBetween(range.from, range.to);
    const dailyMap = new Map(days.map((d) => [d, { income: 0, expense: 0 }]));
    for (const r of rows) {
      if (r.status !== "paid") continue;
      const k = String(r.transaction_date);
      const bucket = dailyMap.get(k);
      if (!bucket) continue;
      if (r.type === "income") bucket.income += num(r.amount);
      if (r.type === "expense") bucket.expense += num(r.amount);
    }
    let runningBalance = 0;
    const daily = days.map((d) => {
      const b = dailyMap.get(d)!;
      runningBalance += b.income - b.expense;
      return { date: d, label: labelDay(d), income: b.income, expense: b.expense, balance: runningBalance };
    });

    // by category
    const catIds = Array.from(new Set(rows.map((r) => r.category_id).filter(Boolean) as string[]));
    let catNames = new Map<string, string>();
    if (catIds.length) {
      const cats = await fetchInChunks(catIds, (chunk) =>
        supabase.from("financial_categories").select("id, name").in("id", chunk),
      );
      catNames = new Map(cats.map((c) => [c.id, c.name]));
    }
    const catMap = new Map<string, { income: number; expense: number }>();
    for (const r of rows) {
      if (r.status !== "paid") continue;
      const name = r.category_id ? (catNames.get(r.category_id) ?? "Sem categoria") : "Sem categoria";
      const b = catMap.get(name) ?? { income: 0, expense: 0 };
      if (r.type === "income") b.income += num(r.amount);
      if (r.type === "expense") b.expense += num(r.amount);
      catMap.set(name, b);
    }

    return {
      metrics: { income, expense, balance: income - expense, receivable, payable },
      daily,
      byCategory: Array.from(catMap, ([name, v]) => ({ name, ...v })).sort(
        (a, b) => b.income + b.expense - (a.income + a.expense),
      ),
    };
  },

  async inventory(companyId: string, range: DateRange): Promise<InventoryReport> {
    const list = await fetchAllRows(
      supabase
        .from("products")
        .select("id, name, sku, stock, min_stock, cost")
        .eq("company_id", companyId),
    );

    const inventoryValue = list.reduce((s, p) => s + num(p.stock) * num(p.cost), 0);
    const totalUnits = list.reduce((s, p) => s + num(p.stock), 0);
    const lowStock = list
      .filter((p) => num(p.min_stock) > 0 && num(p.stock) > 0 && num(p.stock) <= num(p.min_stock))
      .slice(0, 100)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: num(p.stock), min_stock: num(p.min_stock) }));
    const outOfStockCount = list.filter((p) => num(p.stock) <= 0).length;

    // movements in range
    const { fromTs, toTs } = rangeToTimestamp(range);
    const moves = await fetchAllRows(
      supabase
        .from("inventory_movements")
        .select("id, product_id, type, quantity, movement_date")
        .eq("company_id", companyId)
        .gte("movement_date", fromTs)
        .lte("movement_date", toTs),
    );

    const movByProduct = new Map<string, { movements: number; outUnits: number }>();
    let totalOut = 0;
    for (const m of moves) {
      if (!m.product_id) continue;
      const b = movByProduct.get(m.product_id) ?? { movements: 0, outUnits: 0 };
      b.movements += 1;
      if (m.type === "out") {
        b.outUnits += Math.abs(num(m.quantity));
        totalOut += Math.abs(num(m.quantity));
      }
      movByProduct.set(m.product_id, b);
    }

    const nameMap = new Map(list.map((p) => [p.id, p.name]));
    const topMoved = Array.from(movByProduct, ([id, v]) => ({
      id,
      name: nameMap.get(id) ?? "—",
      movements: v.movements,
      units: v.outUnits,
    }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 10);

    const movedIds = new Set(movByProduct.keys());
    const stagnant = list
      .filter((p) => !movedIds.has(p.id) && num(p.stock) > 0)
      .slice(0, 20)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: num(p.stock), last_move: null }));

    const turnover = totalUnits > 0 ? totalOut / totalUnits : 0;

    return {
      metrics: {
        inventoryValue,
        totalUnits,
        lowStockCount: lowStock.length,
        outOfStockCount,
        turnover,
      },
      lowStock,
      topMoved,
      stagnant,
    };
  },

  async purchases(companyId: string, range: DateRange): Promise<PurchasesReport> {
    const rows = await fetchAllRows(
      supabase
        .from("purchases")
        .select("id, supplier_id, purchase_date, status, grand_total")
        .eq("company_id", companyId)
        .gte("purchase_date", range.from)
        .lte("purchase_date", range.to),
    );

    const total = rows.reduce((s, r) => s + num(r.grand_total), 0);
    const received = rows.filter((r) => r.status === "received").length;
    const pending = rows.filter((r) => r.status === "pending" || r.status === "draft").length;

    const days = daysBetween(range.from, range.to);
    const dayMap = new Map(days.map((d) => [d, 0]));
    for (const r of rows) {
      const k = String(r.purchase_date);
      if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + num(r.grand_total));
    }
    const daily = days.map((d) => ({ date: d, label: labelDay(d), value: dayMap.get(d) ?? 0 }));

    const statusMap = new Map<string, number>();
    for (const r of rows) statusMap.set(r.status ?? "—", (statusMap.get(r.status ?? "—") ?? 0) + 1);

    const supIds = Array.from(new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[]));
    const supNames = new Map<string, string>();
    if (supIds.length) {
      const sup = await fetchInChunks(supIds, (chunk) =>
        supabase.from("product_suppliers").select("id, name").in("id", chunk),
      );
      for (const s of sup) supNames.set(s.id, s.name);
    }
    const supAgg = new Map<string, { total: number; count: number }>();
    for (const r of rows) {
      const k = r.supplier_id ?? "";
      const b = supAgg.get(k) ?? { total: 0, count: 0 };
      b.total += num(r.grand_total);
      b.count += 1;
      supAgg.set(k, b);
    }
    const topSuppliers = Array.from(supAgg, ([id, v]) => ({
      id: id || null,
      name: id ? (supNames.get(id) ?? "—") : "Sem fornecedor",
      total: v.total,
      count: v.count,
    }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      metrics: { total, count: rows.length, received, pending },
      daily,
      byStatus: Array.from(statusMap, ([name, value]) => ({ name, value })),
      topSuppliers,
    };
  },

  async products(companyId: string, range: DateRange): Promise<ProductsReport> {
    const items = await fetchPaidSaleItems(companyId, range);
    const agg = new Map<string, { quantity: number; revenue: number }>();
    for (const i of items) {
      if (!i.product_id) continue;
      const b = agg.get(i.product_id) ?? { quantity: 0, revenue: 0 };
      b.quantity += num(i.quantity);
      b.revenue += num(i.total);
      agg.set(i.product_id, b);
    }

    const ids = Array.from(agg.keys());
    const nameMap = new Map<string, { name: string; sku: string | null }>();
    if (ids.length) {
      const prods = await fetchInChunks(ids, (chunk) =>
        supabase.from("products").select("id, name, sku").in("id", chunk),
      );
      for (const p of prods) nameMap.set(p.id, { name: p.name, sku: p.sku });
    }
    const rows = Array.from(agg, ([id, v]) => ({
      id,
      name: nameMap.get(id)?.name ?? "—",
      sku: nameMap.get(id)?.sku ?? null,
      quantity: v.quantity,
      revenue: v.revenue,
    }));
    const bestSellers = [...rows].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    const worstSellers = [...rows].sort((a, b) => a.quantity - b.quantity).slice(0, 10);

    // no movement (never sold in range) — active products not in agg
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, sku, stock")
      .eq("company_id", companyId)
      .neq("status", "inactive")
      .limit(500);
    const soldIds = new Set(ids);
    const noMovement = (allProducts ?? [])
      .filter((p) => !soldIds.has(p.id))
      .slice(0, 20)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: num(p.stock) }));

    return { bestSellers, worstSellers, noMovement };
  },

  async customers(companyId: string, range: DateRange): Promise<CustomersReport> {
    const { fromTs, toTs } = rangeToTimestamp(range);

    const [totalRes, activeRes, newRows, salesRows] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "active"),
      fetchAllRows(
        supabase
          .from("customers")
          .select("id, name, created_at")
          .eq("company_id", companyId)
          .gte("created_at", fromTs)
          .lte("created_at", toTs),
      ),
      fetchAllRows(
        applyDataScope(
          supabase
            .from("sales")
            .select("id, customer_id, grand_total, status")
            .eq("company_id", companyId)
            .eq("status", "paid")
            .gte("sale_date", range.from)
            .lte("sale_date", range.to),
        ),
      ),
    ]);
    if (totalRes.error) throw totalRes.error;
    if (activeRes.error) throw activeRes.error;

    // recurring: customers with >1 paid sale (all time)
    const allSales = await fetchAllRows(
      applyDataScope(
        supabase
          .from("sales")
          .select("id, customer_id")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .not("customer_id", "is", null),
      ),
    );
    const countByCustomer = new Map<string, number>();
    for (const s of allSales) {
      if (!s.customer_id) continue;
      countByCustomer.set(s.customer_id, (countByCustomer.get(s.customer_id) ?? 0) + 1);
    }
    const recurring = Array.from(countByCustomer.values()).filter((c) => c > 1).length;

    // inactive: no interaction in 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const { count: inactive } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .or(`last_interaction_at.is.null,last_interaction_at.lt.${cutoff.toISOString()}`);

    // daily new customers
    const days = daysBetween(range.from, range.to);
    const dayMap = new Map(days.map((d) => [d, 0]));
    for (const c of newRows) {
      const k = String(c.created_at).slice(0, 10);
      if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
    }
    const daily = days.map((d) => ({ date: d, label: labelDay(d), value: dayMap.get(d) ?? 0 }));

    // top customers by revenue in range
    const revByCust = new Map<string, { revenue: number; purchases: number }>();
    for (const s of salesRows) {
      if (!s.customer_id) continue;
      const b = revByCust.get(s.customer_id) ?? { revenue: 0, purchases: 0 };
      b.revenue += num(s.grand_total);
      b.purchases += 1;
      revByCust.set(s.customer_id, b);
    }
    // Só busca nomes do top 10 (antes buscava todos os clientes do período).
    const topIds = Array.from(revByCust, ([id, v]) => ({ id, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((x) => x.id);
    const nameMap = new Map<string, string>();
    if (topIds.length) {
      const cs = await fetchInChunks(topIds, (chunk) =>
        supabase.from("customers").select("id, name").in("id", chunk),
      );
      for (const c of cs) nameMap.set(c.id, c.name);
    }
    const topCustomers = Array.from(revByCust, ([id, v]) => ({
      id,
      name: nameMap.get(id) ?? "—",
      purchases: v.purchases,
      revenue: v.revenue,
    }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      metrics: {
        total: totalRes.count ?? 0,
        active: activeRes.count ?? 0,
        newInRange: newRows.length,
        recurring,
        inactive: inactive ?? 0,
      },
      daily,
      topCustomers,
    };
  },
};
