import { supabase } from "@/integrations/supabase/client";
import {
  daysBetween,
  labelDay,
  rangeToTimestamp,
} from "@/features/reports/utils/date-range";
import type { DateRange } from "@/features/reports/types";
import {
  paymentMethodsService,
  sumNetRevenue,
} from "@/features/payment-methods";
import type {
  AbcClass,
  BiAbcItem,
  BiCommercial,
  BiCharts,
  BiDailyPoint,
  BiExecutivePanel,
  BiFilters,
  BiFinance,
  BiInventory,
  BiKpis,
  BiRankedCategory,
  BiRankedProduct,
  BiSuppliers,
} from "../types";

const num = (v: unknown) =>
  typeof v === "number" ? v : v == null ? 0 : Number(v) || 0;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeDays(range: DateRange): number {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);
  return Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1,
  );
}

async function fetchPaidSalesInRange(
  companyId: string,
  range: DateRange,
) {
  const { data, error } = await supabase
    .from("sales")
    .select("id, grand_total, customer_id, sale_date, status, payment_method, installments")
    .eq("company_id", companyId)
    .eq("status", "paid")
    .gte("sale_date", range.from)
    .lte("sale_date", range.to);
  if (error) throw error;
  return data ?? [];
}

async function fetchPaidSaleItems(
  companyId: string,
  range: DateRange,
) {
  const { data, error } = await supabase
    .from("sale_items")
    .select(
      "id, product_id, quantity, unit_price, total, sale:sales!inner(company_id, sale_date, status)",
    )
    .eq("sale.company_id", companyId)
    .eq("sale.status", "paid")
    .gte("sale.sale_date", range.from)
    .lte("sale.sale_date", range.to);
  if (error) throw error;
  return data ?? [];
}

/** Products index (for filtering, cost/margin & category resolution). */
async function fetchProductsIndex(companyId: string) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, sku, stock, min_stock, cost, price, status, category_id, supplier_id, created_at",
    )
    .eq("company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

async function fetchCategoriesIndex(companyId: string) {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

async function fetchSuppliersIndex(companyId: string) {
  const { data, error } = await supabase
    .from("product_suppliers")
    .select("id, name")
    .eq("company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Section builders                                                    */
/* ------------------------------------------------------------------ */

function buildDailySeries(
  from: string,
  to: string,
  rows: { date: string; value: number }[],
): BiDailyPoint[] {
  const days = daysBetween(from, to);
  const map = new Map(days.map((d) => [d, 0]));
  for (const r of rows) {
    if (map.has(r.date)) map.set(r.date, (map.get(r.date) ?? 0) + r.value);
  }
  return days.map((d) => ({
    date: d,
    label: labelDay(d),
    value: map.get(d) ?? 0,
  }));
}


function buildAbc(
  entries: { id: string; name: string; revenue: number }[],
): BiAbcItem[] {
  const total = entries.reduce((s, e) => s + e.revenue, 0);
  if (total <= 0) return [];
  const sorted = [...entries].sort((a, b) => b.revenue - a.revenue);
  let cum = 0;
  return sorted.map((e) => {
    const share = e.revenue / total;
    cum += share;
    let cls: AbcClass = "C";
    if (cum <= 0.8) cls = "A";
    else if (cum <= 0.95) cls = "B";
    return {
      id: e.id,
      name: e.name,
      revenue: e.revenue,
      share,
      cumulativeShare: cum,
      class: cls,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export const executivePanelService = {
  async build(filters: BiFilters): Promise<BiExecutivePanel> {
    const { companyId, range, categoryId, supplierId } = filters;

    const [
      products,
      categories,
      suppliers,
      paidSales,
      allItems,
      newCustomersRes,
      activeCustomersRes,
    ] = await Promise.all([
      fetchProductsIndex(companyId),
      fetchCategoriesIndex(companyId),
      fetchSuppliersIndex(companyId),
      fetchPaidSalesInRange(companyId, range),
      fetchPaidSaleItems(companyId, range),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", `${range.from}T00:00:00.000Z`)
        .lte("created_at", `${range.to}T23:59:59.999Z`),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "active"),
    ]);

    if (newCustomersRes.error) throw newCustomersRes.error;
    if (activeCustomersRes.error) throw activeCustomersRes.error;

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Filter products by category / supplier for scope of product-derived metrics
    const productInScope = (productId: string | null | undefined): boolean => {
      if (!productId) return !categoryId && !supplierId;
      const p = productMap.get(productId);
      if (!p) return false;
      if (categoryId && p.category_id !== categoryId) return false;
      if (supplierId && p.supplier_id !== supplierId) return false;
      return true;
    };

    // Items scoped
    const scopedItems = allItems.filter((i) => productInScope(i.product_id));

    // Sales scoped (a sale is scoped if any of its items are scoped, but for
    // revenue KPIs we count full grand_total of paid sales in range — that is
    // the executive figure. When category/supplier filters are applied, we
    // switch to summing scoped items' totals to reflect the filtered view.)
    const isFiltered = Boolean(categoryId || supplierId);

    const revenue = isFiltered
      ? scopedItems.reduce((s, i) => s + num(i.total), 0)
      : paidSales.reduce((s, r) => s + num(r.grand_total), 0);

    // Receita líquida sempre calculada sobre a venda inteira (taxa é da venda).
    // Quando filtrado por categoria/fornecedor a taxa não se prorratea entre
    // linhas — usamos o mesmo revenue bruto do escopo e reportamos taxa 0.
    const fees = await paymentMethodsService
      .list(companyId)
      .catch(() => []);
    const totals = isFiltered
      ? { gross: revenue, fee: 0, net: revenue }
      : sumNetRevenue(paidSales, fees);
    const netRevenue = totals.net;
    const paymentFees = totals.fee;

    // COGS from scoped items
    let cogs = 0;
    let productsSold = 0;
    for (const it of scopedItems) {
      const p = it.product_id ? productMap.get(it.product_id) : null;
      productsSold += num(it.quantity);
      cogs += num(it.quantity) * num(p?.cost ?? 0);
    }
    const grossProfit = netRevenue - cogs;
    const grossMargin = netRevenue > 0 ? grossProfit / netRevenue : 0;

    const scopedSalesCount = isFiltered
      ? new Set(
          scopedItems
            .map((i) => {
              const s = (i as { sale?: { sale_date?: string } | null }).sale;
              return s ? `${s.sale_date}` : null;
            })
            // sale id isn't projected on items query; approximate scoped count
            // by grouping items via product_id+sale_date. Fall back to paid
            // sale count when no filter is applied.
            .filter(Boolean),
        ).size
      : paidSales.length;
    const salesCount = isFiltered
      ? // items don't expose sale.id in the projection; derive properly:
        new Set(
          allItems
            .filter((i) => productInScope(i.product_id))
            .map(
              (i) => (i as unknown as { sale_id?: string; id: string }).id,
            ),
        ).size || scopedSalesCount
      : paidSales.length;

    const kpis: BiKpis = {
      revenue,
      netRevenue,
      paymentFees,
      grossProfit,
      grossMargin,
      avgTicket: salesCount > 0 ? revenue / salesCount : 0,
      salesCount,
      productsSold,
      activeCustomers: activeCustomersRes.count ?? 0,
      newCustomers: newCustomersRes.count ?? 0,
    };

    /* --------------------------- Commercial --------------------------- */
    const perProduct = new Map<
      string,
      { quantity: number; revenue: number; profit: number }
    >();
    for (const it of scopedItems) {
      const pid = it.product_id;
      if (!pid) continue;
      const p = productMap.get(pid);
      const qty = num(it.quantity);
      const rev = num(it.total);
      const prof = rev - qty * num(p?.cost ?? 0);
      const b = perProduct.get(pid) ?? { quantity: 0, revenue: 0, profit: 0 };
      b.quantity += qty;
      b.revenue += rev;
      b.profit += prof;
      perProduct.set(pid, b);
    }

    const rankedProducts: BiRankedProduct[] = Array.from(
      perProduct,
      ([id, v]) => {
        const p = productMap.get(id);
        return {
          id,
          name: p?.name ?? "—",
          sku: p?.sku ?? null,
          quantity: v.quantity,
          revenue: v.revenue,
          profit: v.profit,
          margin: v.revenue > 0 ? v.profit / v.revenue : 0,
        };
      },
    );

    const topSelling = [...rankedProducts]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    const topProfitable = [...rankedProducts]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Categories
    const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
    const perCategory = new Map<
      string,
      { quantity: number; revenue: number; profit: number }
    >();
    for (const rp of rankedProducts) {
      const p = productMap.get(rp.id);
      const cid = p?.category_id ?? "__none__";
      const b = perCategory.get(cid) ?? {
        quantity: 0,
        revenue: 0,
        profit: 0,
      };
      b.quantity += rp.quantity;
      b.revenue += rp.revenue;
      b.profit += rp.profit;
      perCategory.set(cid, b);
    }
    const rankedCategories: BiRankedCategory[] = Array.from(
      perCategory,
      ([id, v]) => ({
        id,
        name:
          id === "__none__"
            ? "Sem categoria"
            : (catNameMap.get(id) ?? "—"),
        quantity: v.quantity,
        revenue: v.revenue,
        profit: v.profit,
        margin: v.revenue > 0 ? v.profit / v.revenue : 0,
      }),
    );
    const topProfitableCategories = [...rankedCategories]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Stagnant products (no sales in last 30/60/90 days) — computed globally,
    // then narrowed by scope filters.
    const today = todayISO();
    const d30From = shiftDate(today, -30);
    const d60From = shiftDate(today, -60);
    const d90From = shiftDate(today, -90);

    const { data: recentItems, error: riErr } = await supabase
      .from("sale_items")
      .select(
        "product_id, sale:sales!inner(company_id, sale_date, status)",
      )
      .eq("sale.company_id", companyId)
      .eq("sale.status", "paid")
      .gte("sale.sale_date", d90From)
      .lte("sale.sale_date", today);
    if (riErr) throw riErr;

    const lastSaleByProduct = new Map<string, string>();
    for (const r of recentItems ?? []) {
      const pid = (r as { product_id: string | null }).product_id;
      if (!pid) continue;
      const s = (r as { sale?: { sale_date?: string } | null }).sale;
      const date = s?.sale_date ? String(s.sale_date) : null;
      if (!date) continue;
      const prev = lastSaleByProduct.get(pid);
      if (!prev || date > prev) lastSaleByProduct.set(pid, date);
    }

    const scopedProducts = products.filter(
      (p) =>
        p.status !== "inactive" &&
        (!categoryId || p.category_id === categoryId) &&
        (!supplierId || p.supplier_id === supplierId),
    );

    const stagnant = (cutoff: string) =>
      scopedProducts
        .filter((p) => {
          // Só considera "parado" se o produto existe desde antes do cutoff.
          const createdAt = (p as { created_at?: string | null }).created_at ?? null;
          if (!createdAt || String(createdAt).slice(0, 10) > cutoff) return false;
          const last = lastSaleByProduct.get(p.id) ?? null;
          return !last || last < cutoff;
        })
        .slice(0, 50)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: num(p.stock),
          lastSaleAt: lastSaleByProduct.get(p.id) ?? null,
        }));

    const commercial: BiCommercial = {
      topSelling,
      topProfitable,
      topProfitableCategories,
      noSales: {
        d30: stagnant(d30From),
        d60: stagnant(d60From),
        d90: stagnant(d90From),
      },
    };

    /* --------------------------- Inventory --------------------------- */
    const invValue = scopedProducts.reduce(
      (s, p) => s + num(p.stock) * num(p.cost),
      0,
    );
    const invUnits = scopedProducts.reduce((s, p) => s + num(p.stock), 0);
    const rd = rangeDays(range);
    const avgDailyOut = productsSold / rd;
    const coverageDays =
      avgDailyOut > 0 ? Math.round(invUnits / avgDailyOut) : null;

    const { fromTs, toTs } = rangeToTimestamp(range);
    const { data: moves, error: mErr } = await supabase
      .from("inventory_movements")
      .select("product_id, type, quantity, movement_date")
      .eq("company_id", companyId)
      .gte("movement_date", fromTs)
      .lte("movement_date", toTs);
    if (mErr) throw mErr;

    let outUnits = 0;
    for (const m of moves ?? []) {
      if (!m.product_id) continue;
      if (categoryId && productMap.get(m.product_id)?.category_id !== categoryId)
        continue;
      if (supplierId && productMap.get(m.product_id)?.supplier_id !== supplierId)
        continue;
      if (m.type === "out") outUnits += Math.abs(num(m.quantity));
    }
    const turnover = invUnits > 0 ? outUnits / invUnits : 0;

    const critical = scopedProducts
      .filter(
        (p) => num(p.min_stock) > 0 && num(p.stock) <= num(p.min_stock),
      )
      .slice(0, 50)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: num(p.stock),
        min_stock: num(p.min_stock),
      }));

    const inventory: BiInventory = {
      value: invValue,
      totalUnits: invUnits,
      coverageDays,
      turnover,
      critical,
    };

    /* --------------------------- Finance ---------------------------- */
    const { data: finRows, error: fErr } = await supabase
      .from("financial_transactions")
      .select("type, amount, transaction_date, status")
      .eq("company_id", companyId)
      .gte("transaction_date", range.from)
      .lte("transaction_date", range.to);
    if (fErr) throw fErr;

    let income = 0;
    let expense = 0;
    let receivable = 0;
    let payable = 0;
    const days = daysBetween(range.from, range.to);
    const dailyFinMap = new Map(
      days.map((d) => [d, { income: 0, expense: 0 }]),
    );
    for (const r of finRows ?? []) {
      const amt = num(r.amount);
      if (r.status === "paid") {
        if (r.type === "income") income += amt;
        if (r.type === "expense") expense += amt;
        const key = String(r.transaction_date);
        const b = dailyFinMap.get(key);
        if (b) {
          if (r.type === "income") b.income += amt;
          if (r.type === "expense") b.expense += amt;
        }
      } else if (r.status === "pending" || r.status === "overdue") {
        if (r.type === "income") receivable += amt;
        if (r.type === "expense") payable += amt;
      }
    }
    let running = 0;
    const dailyFlow = days.map((d) => {
      const b = dailyFinMap.get(d)!;
      running += b.income - b.expense;
      return {
        date: d,
        label: labelDay(d),
        income: b.income,
        expense: b.expense,
        balance: running,
      };
    });
    const finance: BiFinance = {
      income,
      expense,
      balance: income - expense,
      receivable,
      payable,
      dailyFlow,
    };

    /* -------------------------- Suppliers --------------------------- */
    // Fetch purchases in range (and previous period for cost increase)
    const previousFrom = shiftDate(range.from, -rd);
    const previousTo = shiftDate(range.to, -rd);

    const [purchasesRes, purchasesPrevRes] = await Promise.all([
      supabase
        .from("purchases")
        .select("id, supplier_id, purchase_date, grand_total, status")
        .eq("company_id", companyId)
        .gte("purchase_date", range.from)
        .lte("purchase_date", range.to),
      supabase
        .from("purchases")
        .select("id, supplier_id")
        .eq("company_id", companyId)
        .gte("purchase_date", previousFrom)
        .lte("purchase_date", previousTo),
    ]);
    if (purchasesRes.error) throw purchasesRes.error;
    if (purchasesPrevRes.error) throw purchasesPrevRes.error;

    const purchasesCur = (purchasesRes.data ?? []).filter(
      (p) => !supplierId || p.supplier_id === supplierId,
    );
    const purchasesPrev = (purchasesPrevRes.data ?? []).filter(
      (p) => !supplierId || p.supplier_id === supplierId,
    );

    const purchaseIdsCur = purchasesCur.map((p) => p.id);
    const purchaseIdsPrev = purchasesPrev.map((p) => p.id);

    const [itemsCurRes, itemsPrevRes] = await Promise.all([
      purchaseIdsCur.length
        ? supabase
            .from("purchase_items")
            .select("purchase_id, product_id, quantity, unit_price")
            .in("purchase_id", purchaseIdsCur)
        : Promise.resolve({ data: [], error: null } as {
            data: {
              purchase_id: string;
              product_id: string | null;
              quantity: number;
              unit_price: number;
            }[];
            error: null;
          }),
      purchaseIdsPrev.length
        ? supabase
            .from("purchase_items")
            .select("purchase_id, product_id, quantity, unit_price")
            .in("purchase_id", purchaseIdsPrev)
        : Promise.resolve({ data: [], error: null } as {
            data: {
              purchase_id: string;
              product_id: string | null;
              quantity: number;
              unit_price: number;
            }[];
            error: null;
          }),
    ]);
    if (itemsCurRes.error) throw itemsCurRes.error;
    if (itemsPrevRes.error) throw itemsPrevRes.error;

    const supIdByPurchase = new Map(
      [...purchasesCur, ...purchasesPrev].map((p) => [
        p.id,
        p.supplier_id ?? null,
      ]),
    );
    const supNameMap = new Map(suppliers.map((s) => [s.id, s.name]));

    const supAgg = new Map<
      string,
      {
        quantity: number;
        revenue: number;
        costSum: number;
        costQty: number;
      }
    >();
    for (const it of itemsCurRes.data ?? []) {
      const sid = supIdByPurchase.get(it.purchase_id) ?? null;
      if (!sid) continue;
      if (categoryId && productMap.get(it.product_id ?? "")?.category_id !== categoryId)
        continue;
      const b = supAgg.get(sid) ?? {
        quantity: 0,
        revenue: 0,
        costSum: 0,
        costQty: 0,
      };
      const q = num(it.quantity);
      const up = num(it.unit_price);
      b.quantity += q;
      b.revenue += q * up;
      b.costSum += q * up;
      b.costQty += q;
      supAgg.set(sid, b);
    }

    const supAggPrev = new Map<string, { costSum: number; costQty: number }>();
    for (const it of itemsPrevRes.data ?? []) {
      const sid = supIdByPurchase.get(it.purchase_id) ?? null;
      if (!sid) continue;
      if (categoryId && productMap.get(it.product_id ?? "")?.category_id !== categoryId)
        continue;
      const b = supAggPrev.get(sid) ?? { costSum: 0, costQty: 0 };
      const q = num(it.quantity);
      const up = num(it.unit_price);
      b.costSum += q * up;
      b.costQty += q;
      supAggPrev.set(sid, b);
    }

    const topByVolume = Array.from(supAgg, ([id, v]) => ({
      id,
      name: supNameMap.get(id) ?? "—",
      quantity: v.quantity,
    }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topByRevenue = Array.from(supAgg, ([id, v]) => ({
      id,
      name: supNameMap.get(id) ?? "—",
      total: v.revenue,
    }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const topByCostIncrease = Array.from(supAgg, ([id, v]) => {
      const prev = supAggPrev.get(id);
      const currentAvgCost = v.costQty > 0 ? v.costSum / v.costQty : 0;
      const previousAvgCost =
        prev && prev.costQty > 0 ? prev.costSum / prev.costQty : 0;
      const increasePct =
        previousAvgCost > 0
          ? (currentAvgCost - previousAvgCost) / previousAvgCost
          : 0;
      return {
        id,
        name: supNameMap.get(id) ?? "—",
        currentAvgCost,
        previousAvgCost,
        increasePct,
      };
    })
      .filter((s) => s.previousAvgCost > 0 && s.increasePct > 0)
      .sort((a, b) => b.increasePct - a.increasePct)
      .slice(0, 10);

    const suppliersOut: BiSuppliers = {
      topByVolume,
      topByRevenue,
      topByCostIncrease,
    };

    /* ---------------------------- Charts ---------------------------- */
    const buildRangeSeries = async (
      days: number,
      metric: "revenue" | "profit" | "count",
    ): Promise<BiDailyPoint[]> => {
      const from = shiftDate(today, -(days - 1));
      const { data, error } = await supabase
        .from("sales")
        .select("sale_date, grand_total")
        .eq("company_id", companyId)
        .eq("status", "paid")
        .gte("sale_date", from)
        .lte("sale_date", today);
      if (error) throw error;

      const map = new Map<string, { revenue: number; count: number }>();
      const list = daysBetween(from, today);
      for (const d of list) map.set(d, { revenue: 0, count: 0 });
      for (const r of data ?? []) {
        const key = String(r.sale_date);
        const b = map.get(key);
        if (!b) continue;
        b.revenue += num(r.grand_total);
        b.count += 1;
      }

      // Profit requires items -> cost lookup (single extra query for 30d)
      let profitByDate = new Map<string, number>();
      if (metric === "profit") {
        const { data: items, error: iErr } = await supabase
          .from("sale_items")
          .select(
            "product_id, quantity, total, sale:sales!inner(sale_date, company_id, status)",
          )
          .eq("sale.company_id", companyId)
          .eq("sale.status", "paid")
          .gte("sale.sale_date", from)
          .lte("sale.sale_date", today);
        if (iErr) throw iErr;
        for (const it of items ?? []) {
          const s = (it as { sale?: { sale_date?: string } | null }).sale;
          const key = s?.sale_date ? String(s.sale_date) : null;
          if (!key) continue;
          const p = it.product_id ? productMap.get(it.product_id) : null;
          const prof = num(it.total) - num(it.quantity) * num(p?.cost ?? 0);
          profitByDate.set(key, (profitByDate.get(key) ?? 0) + prof);
        }
      }

      return list.map((d) => {
        const b = map.get(d) ?? { revenue: 0, count: 0 };
        const value =
          metric === "revenue"
            ? b.revenue
            : metric === "count"
              ? b.count
              : (profitByDate.get(d) ?? 0);
        return { date: d, label: labelDay(d), value };
      });
    };

    const [revenue7d, revenue30d, revenue90d, profit30d, salesCount30d] =
      await Promise.all([
        buildRangeSeries(7, "revenue"),
        buildRangeSeries(30, "revenue"),
        buildRangeSeries(90, "revenue"),
        buildRangeSeries(30, "profit"),
        buildRangeSeries(30, "count"),
      ]);

    const charts: BiCharts = {
      revenue7d,
      revenue30d,
      revenue90d,
      profit30d,
      salesCount30d,
    };

    /* ------------------------------ ABC ------------------------------ */
    const abcProducts = buildAbc(
      rankedProducts.map((r) => ({
        id: r.id,
        name: r.name,
        revenue: r.revenue,
      })),
    );
    const abcCategories = buildAbc(
      rankedCategories.map((r) => ({
        id: r.id,
        name: r.name,
        revenue: r.revenue,
      })),
    );

    // Customers ABC — group scoped paid sales by customer
    const perCustomer = new Map<string, number>();
    // When filtered, use scoped items grouped by sale->customer
    if (isFiltered) {
      // fetch customer_id per sale that has any scoped item
      const paidSaleMap = new Map(
        paidSales.map((s) => [s.id, s.customer_id ?? null]),
      );
      // scopedItems doesn't expose sale.id; use paidSales.grand_total
      // proportionally is complex — approximate by summing per-customer scoped
      // item revenue using product_id -> sale relationship. To keep simple and
      // correct, fetch sale_id per scoped item:
      const { data: scopedWithSale, error: swErr } = await supabase
        .from("sale_items")
        .select(
          "total, sale:sales!inner(id, customer_id, company_id, sale_date, status)",
        )
        .eq("sale.company_id", companyId)
        .eq("sale.status", "paid")
        .gte("sale.sale_date", range.from)
        .lte("sale.sale_date", range.to)
        .in(
          "product_id",
          scopedProducts.map((p) => p.id),
        );
      if (swErr) throw swErr;
      for (const r of scopedWithSale ?? []) {
        const s = (
          r as {
            sale?: { customer_id?: string | null; id?: string } | null;
          }
        ).sale;
        const cid = s?.customer_id ?? null;
        if (!cid) continue;
        perCustomer.set(cid, (perCustomer.get(cid) ?? 0) + num(r.total));
      }
      void paidSaleMap;
    } else {
      for (const s of paidSales) {
        if (!s.customer_id) continue;
        perCustomer.set(
          s.customer_id,
          (perCustomer.get(s.customer_id) ?? 0) + num(s.grand_total),
        );
      }
    }

    const custIds = Array.from(perCustomer.keys());
    const custNameMap = new Map<string, string>();
    if (custIds.length) {
      const { data: cs } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", custIds);
      for (const c of cs ?? []) custNameMap.set(c.id, c.name);
    }
    const abcCustomers = buildAbc(
      Array.from(perCustomer, ([id, revenue]) => ({
        id,
        name: custNameMap.get(id) ?? "—",
        revenue,
      })),
    );

    return {
      kpis,
      commercial,
      inventory,
      finance,
      suppliers: suppliersOut,
      charts,
      abc: {
        products: abcProducts,
        categories: abcCategories,
        customers: abcCustomers,
      },
    };
  },
};

// Suppress unused import warning while keeping helper generic
void buildDailySeries;
