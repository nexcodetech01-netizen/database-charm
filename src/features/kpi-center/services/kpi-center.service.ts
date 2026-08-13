/**
 * KPI Center Service — agrega indicadores operacionais a partir das
 * fontes existentes (Products, Inventory, Sales, Customers, Finance,
 * Purchases, Pricing decisions).
 *
 * Regras:
 *  - Todo cálculo vive AQUI, nunca na UI.
 *  - Não altera domínio: apenas leitura + classificação.
 *  - Retorna lista normalizada `Indicator[]`.
 */

import { supabase } from "@/integrations/supabase/client";
import { companyDayStartUtc } from "@/lib/time/company-day";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Indicator,
  IndicatorPriority,
  KpiCenterFilters,
  KpiCenterResult,
} from "../types";

const num = (v: unknown) => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

const MIN_MARGIN_TARGET = 0.2; // 20% margem alvo padrão do sistema.

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function shiftISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const PRIORITY_ORDER: Record<IndicatorPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const kpiCenterService = {
  async build(filters: KpiCenterFilters): Promise<KpiCenterResult> {
    const { companyId, categoryId, supplierId } = filters;

    const [
      productsRes,
      productPoliciesRes,
      categoryPoliciesRes,
      recentPricingRes,
      recentItemsRes,
      customersRes,
      financeRes,
      purchasesRes,
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, sku, price, cost, stock, min_stock, status, category_id, supplier_id, updated_at",
        )
        .eq("company_id", companyId),
      supabase
        .from("product_pricing_policies")
        .select("product_id")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      supabase
        .from("category_pricing_policies")
        .select("category_id")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      supabase
        .from("pricing_decisions")
        .select("id, created_at, context, result")
        .eq("company_id", companyId)
        // FIX (auditoria 2026-08-13): "Z" tratava a data como UTC, não
        // como fuso do Brasil — decisões de preço da noite ficavam fora
        // da janela de 30 dias até o dia seguinte. Ver reports/utils/date-range.ts.
        .gte("created_at", new Date(companyDayStartUtc(shiftISO(-30))).toISOString())
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("sale_items")
        .select("product_id, sale:sales!inner(company_id, sale_date, status)")
        .eq("sale.company_id", companyId)
        .eq("sale.status", "paid")
        .gte("sale.sale_date", shiftISO(-90)),
      supabase
        .from("customers")
        .select("id, name, segment, tags, last_interaction_at, status")
        .eq("company_id", companyId)
        .eq("status", "active"),
      supabase
        .from("financial_transactions")
        .select(
          "id, description, type, amount, due_date, status, transaction_date, source, reference_id",
        )
        .eq("company_id", companyId)
        .in("status", ["pending", "overdue"]),
      supabase
        .from("purchases")
        .select("id, number, supplier_id, purchase_date, grand_total, status")
        .eq("company_id", companyId)
        .in("status", ["draft", "pending", "confirmed"]),
    ]);

    if (productsRes.error) throw productsRes.error;
    if (productPoliciesRes.error) throw productPoliciesRes.error;
    if (categoryPoliciesRes.error) throw categoryPoliciesRes.error;
    if (recentPricingRes.error) throw recentPricingRes.error;
    if (recentItemsRes.error) throw recentItemsRes.error;
    if (customersRes.error) throw customersRes.error;
    if (financeRes.error) throw financeRes.error;
    if (purchasesRes.error) throw purchasesRes.error;

    const products = (productsRes.data ?? []).filter(
      (p) =>
        p.status !== "inactive" &&
        (!categoryId || p.category_id === categoryId) &&
        (!supplierId || p.supplier_id === supplierId),
    );
    const productMap = new Map(products.map((p) => [p.id, p]));

    const policiedProductIds = new Set(
      (productPoliciesRes.data ?? []).map((r) => r.product_id),
    );
    const policiedCategoryIds = new Set(
      (categoryPoliciesRes.data ?? []).map((r) => r.category_id).filter(Boolean),
    );

    // Latest sale date per product (last 90 days).
    const lastSaleByProduct = new Map<string, string>();
    for (const row of recentItemsRes.data ?? []) {
      const pid = (row as { product_id: string | null }).product_id;
      if (!pid) continue;
      const sale = (row as { sale?: { sale_date?: string } | null }).sale;
      const date = sale?.sale_date ? String(sale.sale_date) : null;
      if (!date) continue;
      const prev = lastSaleByProduct.get(pid);
      if (!prev || date > prev) lastSaleByProduct.set(pid, date);
    }

    // Latest pricing decision per product with suggestion divergence.
    const latestDecisionByProduct = new Map<
      string,
      { suggested: number; createdAt: string }
    >();
    for (const dec of recentPricingRes.data ?? []) {
      const ctx = (dec.context ?? {}) as {
        product?: { id?: string | null } | null;
      };
      const res = (dec.result ?? {}) as {
        finalPrice?: number | null;
        price?: number | null;
      };
      const pid = ctx.product?.id ?? null;
      const suggested = num(res.finalPrice ?? res.price);
      if (!pid || !suggested) continue;
      if (!latestDecisionByProduct.has(pid)) {
        latestDecisionByProduct.set(pid, {
          suggested,
          createdAt: dec.created_at,
        });
      }
    }

    const indicators: Indicator[] = [];
    const today = todayISO();
    const d30 = shiftISO(-30);
    const d60 = shiftISO(-60);
    const d90 = shiftISO(-90);

    /* ------------------------- Pricing signals ------------------------- */
    for (const p of products) {
      const price = num(p.price);
      const cost = num(p.cost);
      const margin = price > 0 ? (price - cost) / price : 0;

      // Margem abaixo da meta
      if (price > 0 && cost > 0 && margin < MIN_MARGIN_TARGET) {
        indicators.push({
          id: `margin:${p.id}`,
          kind: "margin_below_target",
          title: `Margem baixa — ${p.name}`,
          description: `Margem atual ${(margin * 100).toFixed(1)}% abaixo da meta de ${(MIN_MARGIN_TARGET * 100).toFixed(0)}%.`,
          priority: margin <= 0 ? "critical" : "high",
          origin: "pricing",
          impact: `${formatCurrency(price - cost)} por unidade`,
          date: p.updated_at,
          action: {
            label: "Abrir simulador",
            target: "simulator",
            entityId: p.id,
          },
          categoryId: p.category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });
      }

      // Produto sem política
      const hasPolicy =
        policiedProductIds.has(p.id) ||
        (p.category_id ? policiedCategoryIds.has(p.category_id) : false);
      if (!hasPolicy) {
        indicators.push({
          id: `nopolicy:${p.id}`,
          kind: "product_without_policy",
          title: `Sem política — ${p.name}`,
          description: "Produto não possui política de precificação vinculada.",
          priority: "medium",
          origin: "pricing",
          impact: "Preço não auditável",
          date: p.updated_at,
          action: {
            label: "Definir política",
            target: "product",
            entityId: p.id,
          },
          categoryId: p.category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });
      }

      // Sugestão pendente
      const dec = latestDecisionByProduct.get(p.id);
      if (dec && Math.abs(dec.suggested - price) / Math.max(price, 1) > 0.01) {
        const delta = dec.suggested - price;
        indicators.push({
          id: `suggestion:${p.id}`,
          kind: "pricing_suggestion_pending",
          title: `Sugestão pendente — ${p.name}`,
          description: `Preço atual ${formatCurrency(price)} · sugerido ${formatCurrency(dec.suggested)}.`,
          priority: delta > 0 ? "high" : "medium",
          origin: "pricing",
          impact: `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}`,
          date: dec.createdAt,
          action: {
            label: "Revisar preço",
            target: "review",
            entityId: p.id,
          },
          categoryId: p.category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });
      }
    }

    /* --------------------------- Inventory ----------------------------- */
    for (const p of products) {
      const stock = num(p.stock);
      const minStock = num(p.min_stock);
      if (minStock > 0 && stock <= minStock) {
        indicators.push({
          id: `stock:${p.id}`,
          kind: "critical_stock",
          title: `Estoque crítico — ${p.name}`,
          description: `Estoque ${stock} un · mínimo ${minStock} un.`,
          priority: stock <= 0 ? "critical" : "high",
          origin: "inventory",
          impact: `${stock} un disponíveis`,
          date: p.updated_at,
          action: {
            label: "Ver produto",
            target: "product_stock",
            entityId: p.id,
          },
          categoryId: p.category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });
      }

      const lastSale = lastSaleByProduct.get(p.id) ?? null;
      const stagnantSince = lastSale ?? p.updated_at?.slice(0, 10) ?? today;
      if (!lastSale || lastSale < d90) {
        indicators.push({
          id: `nosale90:${p.id}`,
          kind: "no_sales_90d",
          title: `Sem venda há 90 dias — ${p.name}`,
          description: lastSale
            ? `Última venda em ${formatDate(lastSale)}.`
            : "Nenhuma venda registrada nos últimos 90 dias.",
          priority: "medium",
          origin: "sales",
          impact: `${num(p.stock)} un paradas`,
          date: stagnantSince,
          action: { label: "Ver produto", target: "product", entityId: p.id },
          categoryId: p.category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });
      } else if (lastSale < d60) {
        indicators.push({
          id: `nosale60:${p.id}`,
          kind: "no_sales_60d",
          title: `Sem venda há 60 dias — ${p.name}`,
          description: `Última venda em ${formatDate(lastSale)}.`,
          priority: "low",
          origin: "sales",
          impact: `${num(p.stock)} un paradas`,
          date: lastSale,
          action: { label: "Ver produto", target: "product", entityId: p.id },
          categoryId: p.category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });
      } else if (lastSale < d30) {
        indicators.push({
          id: `nosale30:${p.id}`,
          kind: "no_sales_30d",
          title: `Sem venda há 30 dias — ${p.name}`,
          description: `Última venda em ${formatDate(lastSale)}.`,
          priority: "low",
          origin: "sales",
          impact: `${num(p.stock)} un paradas`,
          date: lastSale,
          action: { label: "Ver produto", target: "product", entityId: p.id },
          categoryId: p.category_id ?? null,
          supplierId: p.supplier_id ?? null,
        });
      }
    }

    /* --------------------------- Customers ----------------------------- */
    for (const c of customersRes.data ?? []) {
      const isVip =
        c.segment?.toLowerCase() === "vip" ||
        (c.tags ?? []).some((t) => t?.toLowerCase() === "vip");
      if (!isVip) continue;
      const last = c.last_interaction_at ? c.last_interaction_at.slice(0, 10) : null;
      if (!last || last < d30) {
        indicators.push({
          id: `vip:${c.id}`,
          kind: "vip_inactive",
          title: `Cliente VIP inativo — ${c.name}`,
          description: last
            ? `Sem interação desde ${formatDate(last)}.`
            : "Sem interações registradas.",
          priority: last && last >= d60 ? "medium" : "high",
          origin: "customers",
          impact: "Risco de churn",
          date: last ?? c.name,
          action: { label: "Abrir cliente", target: "customer", entityId: c.id },
        });
      }
    }

    /* ---------------------------- Finance ------------------------------ */
    for (const t of financeRes.data ?? []) {
      const due = t.due_date ? t.due_date.slice(0, 10) : null;
      if (!due) continue;
      const isReceivable = t.type === "income";
      if (due < today || t.status === "overdue") {
        indicators.push({
          id: `overdue:${t.id}`,
          kind: "invoice_overdue",
          title: `${isReceivable ? "Recebimento" : "Conta"} vencida — ${t.description}`,
          description: `Vencimento em ${formatDate(due)}.`,
          priority: "critical",
          origin: "finance",
          impact: formatCurrency(num(t.amount)),
          date: due,
          action: { label: "Abrir financeiro", target: "finance", entityId: t.id },
        });
      } else if (due === today) {
        indicators.push({
          id: `duetoday:${t.id}`,
          kind: "invoice_due_today",
          title: `${isReceivable ? "Recebimento" : "Conta"} vence hoje — ${t.description}`,
          description: "Vencimento programado para hoje.",
          priority: "high",
          origin: "finance",
          impact: formatCurrency(num(t.amount)),
          date: due,
          action: { label: "Abrir financeiro", target: "finance", entityId: t.id },
        });
      } else if (isReceivable) {
        indicators.push({
          id: `receivable:${t.id}`,
          kind: "receivable_pending",
          title: `Recebimento pendente — ${t.description}`,
          description: `Vencimento em ${formatDate(due)}.`,
          priority: "low",
          origin: "finance",
          impact: formatCurrency(num(t.amount)),
          date: due,
          action: { label: "Abrir financeiro", target: "finance", entityId: t.id },
        });
      }
    }

    /* ---------------------------- Purchases ---------------------------- */
    for (const pu of purchasesRes.data ?? []) {
      if (supplierId && pu.supplier_id !== supplierId) continue;
      indicators.push({
        id: `purchase:${pu.id}`,
        kind: "purchase_pending",
        title: `Compra pendente — Nº ${pu.number ?? pu.id.slice(0, 8)}`,
        description: `Status ${pu.status}. Data ${formatDate(pu.purchase_date)}.`,
        priority: pu.status === "confirmed" ? "high" : "medium",
        origin: "purchases",
        impact: formatCurrency(num(pu.grand_total)),
        date: pu.purchase_date,
        action: { label: "Abrir compra", target: "purchase", entityId: pu.id },
        supplierId: pu.supplier_id ?? null,
      });
    }

    /* -------------------- Filters + ordering + resume ------------------ */
    let filtered = indicators;
    if (filters.priority) filtered = filtered.filter((i) => i.priority === filters.priority);
    if (filters.origin) filtered = filtered.filter((i) => i.origin === filters.origin);

    filtered.sort((a, b) => {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      return (b.date ?? "").localeCompare(a.date ?? "");
    });

    // Attach product-derived category for products not carrying it (VIP/finance)
    for (const ind of filtered) {
      if (!ind.categoryId && ind.action.entityId) {
        const p = productMap.get(ind.action.entityId);
        if (p) {
          ind.categoryId = p.category_id ?? null;
          ind.supplierId = p.supplier_id ?? null;
        }
      }
    }

    const summary = {
      total: filtered.length,
      critical: filtered.filter((i) => i.priority === "critical").length,
      attention: filtered.filter(
        (i) => i.priority === "high" || i.priority === "medium",
      ).length,
      opportunities: filtered.filter((i) => i.priority === "low").length,
    };

    return { indicators: filtered, summary };
  },
};
