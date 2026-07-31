import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "../types";

/**
 * Customer 360 — READ-ONLY aggregation service.
 * All calculations are centralized here (application layer). UI must not
 * recompute totals, averages or alerts from raw rows.
 */

export interface Customer360Alert {
  code:
    | "new"
    | "vip"
    | "inactive_30"
    | "inactive_60"
    | "inactive_90"
    | "birthday_month";
  label: string;
  tone: "info" | "success" | "warning" | "danger";
}

export interface Customer360TopProduct {
  product_id: string | null;
  description: string;
  quantity: number;
  total: number;
}

export interface Customer360TopCategory {
  category_id: string | null;
  name: string;
  total: number;
}

export type Customer360TimelineKind = "sale" | "payment" | "return";

export interface Customer360TimelineItem {
  id: string;
  kind: Customer360TimelineKind;
  occurred_at: string;
  title: string;
  description: string | null;
  amount: number | null;
  status: string | null;
  sale_id: string | null;
  sale_number: string | null;
}

export interface Customer360Summary {
  customer: Customer;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  purchaseCount: number;
  paidCount: number;
  totalSpent: number;
  averageTicket: number;
  daysSinceLast: number | null;
  preferredPaymentMethod: string | null;
  topProducts: Customer360TopProduct[];
  topCategories: Customer360TopCategory[];
  alerts: Customer360Alert[];
  timeline: Customer360TimelineItem[];
}

const VIP_THRESHOLD_BRL = 5000;
const NEW_WINDOW_DAYS = 30;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function computeAlerts(params: {
  customer: Customer;
  totalSpent: number;
  lastPurchaseAt: string | null;
  now: Date;
}): Customer360Alert[] {
  const { customer, totalSpent, lastPurchaseAt, now } = params;
  const alerts: Customer360Alert[] = [];

  const createdAt = new Date(customer.created_at);
  if (daysBetween(now, createdAt) <= NEW_WINDOW_DAYS) {
    alerts.push({ code: "new", label: "Cliente novo", tone: "info" });
  }

  if (totalSpent >= VIP_THRESHOLD_BRL || customer.segment === "vip") {
    alerts.push({ code: "vip", label: "Cliente VIP", tone: "success" });
  }

  if (lastPurchaseAt) {
    const days = daysBetween(now, new Date(lastPurchaseAt));
    if (days >= 90) {
      alerts.push({ code: "inactive_90", label: "Sem comprar há 90+ dias", tone: "danger" });
    } else if (days >= 60) {
      alerts.push({ code: "inactive_60", label: "Sem comprar há 60+ dias", tone: "warning" });
    } else if (days >= 30) {
      alerts.push({ code: "inactive_30", label: "Sem comprar há 30+ dias", tone: "warning" });
    }
  }

  if (customer.birth_date) {
    const d = new Date(customer.birth_date);
    if (d.getUTCMonth() === now.getMonth()) {
      alerts.push({ code: "birthday_month", label: "Aniversariante do mês", tone: "info" });
    }
  }

  return alerts;
}

export const customer360Service = {
  async get(customerId: string): Promise<Customer360Summary | null> {
    const { data: customer, error: cErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!customer) return null;

    // Sales (all statuses except cancelled contribute to history; totals count paid only)
    const { data: salesData, error: sErr } = await supabase
      .from("sales")
      .select("id,number,status,payment_method,grand_total,sale_date,paid_at,created_at")
      .eq("customer_id", customerId)
      .order("sale_date", { ascending: false });
    if (sErr) throw sErr;
    const sales = salesData ?? [];

    const paidSales = sales.filter((s) => s.status === "paid");
    const totalSpent = paidSales.reduce((sum, s) => sum + Number(s.grand_total ?? 0), 0);
    const purchaseCount = sales.filter((s) => s.status !== "cancelled").length;
    const paidCount = paidSales.length;
    const averageTicket = paidCount > 0 ? totalSpent / paidCount : 0;

    const activeSales = sales.filter((s) => s.status !== "cancelled");
    const lastPurchaseAt =
      activeSales.reduce<string | null>((acc, s) => {
        const ref = s.paid_at ?? (s.sale_date ? `${s.sale_date}T00:00:00Z` : s.created_at);
        return !acc || (ref && ref > acc) ? ref : acc;
      }, null) ?? null;
    const firstPurchaseAt =
      activeSales.reduce<string | null>((acc, s) => {
        const ref = s.paid_at ?? (s.sale_date ? `${s.sale_date}T00:00:00Z` : s.created_at);
        return !acc || (ref && ref < acc) ? ref : acc;
      }, null) ?? null;

    const now = new Date();
    const daysSinceLast = lastPurchaseAt
      ? daysBetween(now, new Date(lastPurchaseAt))
      : null;

    // Preferred payment method (mode among paid sales)
    const paymentCounts = new Map<string, number>();
    for (const s of paidSales) {
      const pm = s.payment_method ?? null;
      if (!pm) continue;
      paymentCounts.set(pm, (paymentCounts.get(pm) ?? 0) + 1);
    }
    let preferredPaymentMethod: string | null = null;
    let best = 0;
    for (const [pm, count] of paymentCounts) {
      if (count > best) {
        best = count;
        preferredPaymentMethod = pm;
      }
    }

    // Items (top products + top categories) — only from paid sales
    const paidIds = paidSales.map((s) => s.id);
    const productAgg = new Map<string, Customer360TopProduct>();
    const categoryAgg = new Map<string, Customer360TopCategory>();

    if (paidIds.length > 0) {
      const { data: items, error: iErr } = await supabase
        .from("sale_items")
        .select("product_id,description,quantity,total")
        .in("sale_id", paidIds);
      if (iErr) throw iErr;

      const productIds = Array.from(
        new Set((items ?? []).map((it) => it.product_id).filter((v): v is string => !!v)),
      );
      const productCategory = new Map<string, { name: string; category_id: string | null; category_name: string | null }>();
      if (productIds.length > 0) {
        const { data: products, error: pErr } = await supabase
          .from("products")
          .select("id,name,category_id,category:product_categories(id,name)")
          .in("id", productIds);
        if (pErr) throw pErr;
        (products ?? []).forEach((p) => {
          const cat = (p as { category?: { id: string; name: string } | null }).category ?? null;
          productCategory.set(p.id, {
            name: p.name,
            category_id: cat?.id ?? p.category_id ?? null,
            category_name: cat?.name ?? null,
          });
        });
      }

      for (const it of items ?? []) {
        const key = it.product_id ?? `desc:${it.description ?? ""}`;
        const prev = productAgg.get(key);
        const description =
          (it.product_id && productCategory.get(it.product_id)?.name) ||
          it.description ||
          "Item";
        productAgg.set(key, {
          product_id: it.product_id ?? null,
          description,
          quantity: Number(prev?.quantity ?? 0) + Number(it.quantity ?? 0),
          total: Number(prev?.total ?? 0) + Number(it.total ?? 0),
        });

        if (it.product_id) {
          const meta = productCategory.get(it.product_id);
          if (meta?.category_id) {
            const prevCat = categoryAgg.get(meta.category_id);
            categoryAgg.set(meta.category_id, {
              category_id: meta.category_id,
              name: meta.category_name ?? "Sem categoria",
              total: Number(prevCat?.total ?? 0) + Number(it.total ?? 0),
            });
          }
        }
      }
    }

    const topProducts = Array.from(productAgg.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const topCategories = Array.from(categoryAgg.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Timeline — sales + payments + returns
    const timeline: Customer360TimelineItem[] = [];

    for (const s of sales) {
      timeline.push({
        id: `sale:${s.id}`,
        kind: "sale",
        occurred_at: (s.sale_date ? `${s.sale_date}T00:00:00Z` : s.created_at) ?? s.created_at,
        title: `Venda ${s.number ?? ""}`.trim(),
        description: s.payment_method ?? null,
        amount: Number(s.grand_total ?? 0),
        status: s.status,
        sale_id: s.id,
        sale_number: s.number,
      });
    }

    const saleIds = sales.map((s) => s.id);
    if (saleIds.length > 0) {
      const { data: payments, error: fErr } = await supabase
        .from("financial_transactions")
        .select("id,amount,paid_at,transaction_date,status,description,reference_id,reference_number")
        .eq("source", "sale")
        .in("reference_id", saleIds);
      if (fErr) throw fErr;
      for (const p of payments ?? []) {
        timeline.push({
          id: `payment:${p.id}`,
          kind: "payment",
          occurred_at: p.paid_at ?? p.transaction_date ?? new Date().toISOString(),
          title: "Pagamento",
          description: p.description ?? null,
          amount: Number(p.amount ?? 0),
          status: p.status,
          sale_id: p.reference_id,
          sale_number: p.reference_number ?? null,
        });
      }

      const { data: returns, error: rErr } = await supabase
        .from("sale_returns")
        .select("id,sale_id,number,total_value,reason,status,refund_status,created_at")
        .in("sale_id", saleIds);
      if (rErr) throw rErr;
      const saleNumberById = new Map(sales.map((s) => [s.id, s.number]));
      for (const r of returns ?? []) {
        timeline.push({
          id: `return:${r.id}`,
          kind: "return",
          occurred_at: r.created_at,
          title: `Devolução ${r.number ?? ""}`.trim(),
          description: r.reason ?? null,
          amount: Number(r.total_value ?? 0),
          status: r.refund_status ?? r.status,
          sale_id: r.sale_id,
          sale_number: saleNumberById.get(r.sale_id) ?? null,
        });
      }
    }

    timeline.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));

    const alerts = computeAlerts({
      customer: customer as Customer,
      totalSpent,
      lastPurchaseAt,
      now,
    });

    return {
      customer: customer as Customer,
      firstPurchaseAt,
      lastPurchaseAt,
      purchaseCount,
      paidCount,
      totalSpent,
      averageTicket,
      daysSinceLast,
      preferredPaymentMethod,
      topProducts,
      topCategories,
      alerts,
      timeline: timeline.slice(0, 100),
    };
  },
};
