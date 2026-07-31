import { supabase } from "@/integrations/supabase/client";

/**
 * Campaign Audience — READ-ONLY application layer.
 * Builds smart customer lists for marketing campaigns (Phase 1: no dispatch).
 *
 * Consumes Customers + Sales via Supabase and reuses the same aggregation
 * rules from Customer 360 (spending, last purchase, favorite category,
 * preferred payment method) to avoid duplicated business logic.
 *
 * NOTE: All aggregation lives here. UI must render only what this returns.
 */

export type SegmentPreset =
  | "all"
  | "vip"
  | "new"
  | "inactive_30"
  | "inactive_60"
  | "inactive_90"
  | "birthday_month";

export interface CampaignAudienceCriteria {
  preset: SegmentPreset;
  /** free text on customer name */
  name?: string;
  city?: string;
  state?: string;
  /** favorite category (top category by spend) */
  categoryId?: string;
  /** preferred payment method (mode of paid sales) */
  paymentMethod?: string;
  /** min total spent (BRL) */
  minTotalSpent?: number | null;
  /** min number of paid purchases */
  minPurchaseCount?: number | null;
  /** period restricts sales considered for aggregates */
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface CampaignAudienceCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  birth_date: string | null;
  totalSpent: number;
  purchaseCount: number;
  averageTicket: number;
  lastPurchaseAt: string | null;
  daysSinceLast: number | null;
  preferredPaymentMethod: string | null;
  favoriteCategoryId: string | null;
  favoriteCategoryName: string | null;
}

export interface CampaignAudiencePreview {
  count: number;
  totalPurchased: number;
  averageTicket: number;
  lastPurchaseAt: string | null;
}

export interface CampaignAudienceResult {
  customers: CampaignAudienceCustomer[];
  preview: CampaignAudiencePreview;
}

const VIP_THRESHOLD_BRL = 5000;
const NEW_WINDOW_DAYS = 30;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

interface CustomerAgg {
  totalSpent: number;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  paymentCounts: Map<string, number>;
  categorySpend: Map<string, { name: string; total: number }>;
}

export const campaignAudienceService = {
  async build(
    companyId: string,
    criteria: CampaignAudienceCriteria,
  ): Promise<CampaignAudienceResult> {
    // 1. Load customers (server-side filters that are cheap)
    let cq = supabase
      .from("customers")
      .select(
        "id,name,email,phone,whatsapp,city,state,segment,birth_date,created_at,status",
      )
      .eq("company_id", companyId)
      .neq("status", "archived");

    if (criteria.name?.trim()) cq = cq.ilike("name", `%${criteria.name.trim()}%`);
    if (criteria.city?.trim()) cq = cq.ilike("city", `%${criteria.city.trim()}%`);
    if (criteria.state) cq = cq.eq("state", criteria.state);

    const { data: customers, error: cErr } = await cq.order("name");
    if (cErr) throw cErr;
    const custList = customers ?? [];
    if (custList.length === 0) return emptyResult();

    // 2. Load paid sales scoped by period
    let sq = supabase
      .from("sales")
      .select("id,customer_id,grand_total,payment_method,sale_date,paid_at")
      .eq("company_id", companyId)
      .eq("status", "paid")
      .not("customer_id", "is", null);
    if (criteria.periodStart) sq = sq.gte("sale_date", criteria.periodStart);
    if (criteria.periodEnd) sq = sq.lte("sale_date", criteria.periodEnd);
    const { data: sales, error: sErr } = await sq;
    if (sErr) throw sErr;

    // 3. Load items for category aggregation (only if needed)
    const needCategories =
      !!criteria.categoryId || true; /* always compute so UI shows favorite */
    const saleIds = (sales ?? []).map((s) => s.id);
    let itemsRes: {
      sale_id: string;
      product_id: string | null;
      total: number;
    }[] = [];
    const categoryOfProduct = new Map<string, { id: string; name: string }>();

    if (needCategories && saleIds.length > 0) {
      const { data: items, error: iErr } = await supabase
        .from("sale_items")
        .select("sale_id,product_id,total")
        .in("sale_id", saleIds);
      if (iErr) throw iErr;
      itemsRes = (items ?? []) as typeof itemsRes;

      const productIds = Array.from(
        new Set(itemsRes.map((it) => it.product_id).filter((v): v is string => !!v)),
      );
      if (productIds.length > 0) {
        const { data: prods, error: pErr } = await supabase
          .from("products")
          .select("id,category_id,category:product_categories(id,name)")
          .in("id", productIds);
        if (pErr) throw pErr;
        (prods ?? []).forEach((p) => {
          const cat = (p as { category?: { id: string; name: string } | null }).category;
          const id = cat?.id ?? p.category_id ?? null;
          if (id) {
            categoryOfProduct.set(p.id, { id, name: cat?.name ?? "Sem categoria" });
          }
        });
      }
    }

    // 4. Aggregate per customer
    const saleToCustomer = new Map<string, string>();
    const agg = new Map<string, CustomerAgg>();
    const now = new Date();

    for (const s of sales ?? []) {
      const cid = s.customer_id;
      if (!cid) continue;
      saleToCustomer.set(s.id, cid);
      const a = agg.get(cid) ?? {
        totalSpent: 0,
        purchaseCount: 0,
        lastPurchaseAt: null,
        paymentCounts: new Map(),
        categorySpend: new Map(),
      };
      a.totalSpent += Number(s.grand_total ?? 0);
      a.purchaseCount += 1;
      const ref =
        s.paid_at ?? (s.sale_date ? `${s.sale_date}T00:00:00Z` : null);
      if (ref && (!a.lastPurchaseAt || ref > a.lastPurchaseAt)) a.lastPurchaseAt = ref;
      if (s.payment_method) {
        a.paymentCounts.set(
          s.payment_method,
          (a.paymentCounts.get(s.payment_method) ?? 0) + 1,
        );
      }
      agg.set(cid, a);
    }

    for (const it of itemsRes) {
      const cid = saleToCustomer.get(it.sale_id);
      if (!cid || !it.product_id) continue;
      const cat = categoryOfProduct.get(it.product_id);
      if (!cat) continue;
      const a = agg.get(cid);
      if (!a) continue;
      const prev = a.categorySpend.get(cat.id);
      a.categorySpend.set(cat.id, {
        name: cat.name,
        total: Number(prev?.total ?? 0) + Number(it.total ?? 0),
      });
    }

    // 5. Materialize per-customer view + apply preset & aggregate filters
    const enriched: CampaignAudienceCustomer[] = custList.map((c) => {
      const a = agg.get(c.id);
      const totalSpent = a?.totalSpent ?? 0;
      const purchaseCount = a?.purchaseCount ?? 0;
      const averageTicket = purchaseCount > 0 ? totalSpent / purchaseCount : 0;
      const lastPurchaseAt = a?.lastPurchaseAt ?? null;
      const daysSinceLast = lastPurchaseAt
        ? daysBetween(now, new Date(lastPurchaseAt))
        : null;

      let preferredPaymentMethod: string | null = null;
      let best = 0;
      if (a) {
        for (const [pm, count] of a.paymentCounts) {
          if (count > best) {
            best = count;
            preferredPaymentMethod = pm;
          }
        }
      }

      let favoriteCategoryId: string | null = null;
      let favoriteCategoryName: string | null = null;
      if (a) {
        let bestCat = 0;
        for (const [id, v] of a.categorySpend) {
          if (v.total > bestCat) {
            bestCat = v.total;
            favoriteCategoryId = id;
            favoriteCategoryName = v.name;
          }
        }
      }

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        whatsapp: c.whatsapp,
        city: c.city,
        state: c.state,
        segment: c.segment,
        birth_date: c.birth_date,
        totalSpent,
        purchaseCount,
        averageTicket,
        lastPurchaseAt,
        daysSinceLast,
        preferredPaymentMethod,
        favoriteCategoryId,
        favoriteCategoryName,
      };
    });

    const filtered = enriched.filter((row) => {
      // preset
      switch (criteria.preset) {
        case "vip":
          if (!(row.totalSpent >= VIP_THRESHOLD_BRL || row.segment === "vip"))
            return false;
          break;
        case "new": {
          const created = custList.find((c) => c.id === row.id)?.created_at;
          if (!created) return false;
          if (daysBetween(now, new Date(created)) > NEW_WINDOW_DAYS) return false;
          break;
        }
        case "inactive_30":
          if (row.daysSinceLast == null || row.daysSinceLast < 30) return false;
          break;
        case "inactive_60":
          if (row.daysSinceLast == null || row.daysSinceLast < 60) return false;
          break;
        case "inactive_90":
          if (row.daysSinceLast == null || row.daysSinceLast < 90) return false;
          break;
        case "birthday_month": {
          if (!row.birth_date) return false;
          const d = new Date(row.birth_date);
          if (d.getUTCMonth() !== now.getMonth()) return false;
          break;
        }
        case "all":
        default:
          break;
      }
      if (criteria.categoryId && row.favoriteCategoryId !== criteria.categoryId)
        return false;
      if (
        criteria.paymentMethod &&
        row.preferredPaymentMethod !== criteria.paymentMethod
      )
        return false;
      if (
        criteria.minTotalSpent != null &&
        row.totalSpent < criteria.minTotalSpent
      )
        return false;
      if (
        criteria.minPurchaseCount != null &&
        row.purchaseCount < criteria.minPurchaseCount
      )
        return false;
      return true;
    });

    // 6. Preview KPIs
    const totalPurchased = filtered.reduce((s, r) => s + r.totalSpent, 0);
    const totalPurchases = filtered.reduce((s, r) => s + r.purchaseCount, 0);
    const lastPurchaseAt = filtered.reduce<string | null>((acc, r) => {
      if (!r.lastPurchaseAt) return acc;
      return !acc || r.lastPurchaseAt > acc ? r.lastPurchaseAt : acc;
    }, null);

    return {
      customers: filtered.sort((a, b) => b.totalSpent - a.totalSpent),
      preview: {
        count: filtered.length,
        totalPurchased,
        averageTicket: totalPurchases > 0 ? totalPurchased / totalPurchases : 0,
        lastPurchaseAt,
      },
    };
  },
};

function emptyResult(): CampaignAudienceResult {
  return {
    customers: [],
    preview: { count: 0, totalPurchased: 0, averageTicket: 0, lastPurchaseAt: null },
  };
}

export const SEGMENT_PRESET_OPTIONS: { value: SegmentPreset; label: string }[] = [
  { value: "all", label: "Todos os clientes" },
  { value: "vip", label: "VIP (gasto ≥ R$ 5.000)" },
  { value: "new", label: "Novos clientes (30 dias)" },
  { value: "inactive_30", label: "Sem comprar há 30+ dias" },
  { value: "inactive_60", label: "Sem comprar há 60+ dias" },
  { value: "inactive_90", label: "Sem comprar há 90+ dias" },
  { value: "birthday_month", label: "Aniversariantes do mês" },
];

/** CSV export (RFC 4180, ; delimiter — Excel BR friendly) */
export function audienceToCsv(rows: CampaignAudienceCustomer[]): string {
  const header = [
    "Nome",
    "Telefone",
    "WhatsApp",
    "E-mail",
    "Cidade",
    "UF",
    "Última compra",
    "Dias sem comprar",
    "Total gasto",
    "Compras",
    "Ticket médio",
    "Categoria favorita",
    "Pagamento preferido",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.name,
      r.phone ?? "",
      r.whatsapp ?? "",
      r.email ?? "",
      r.city ?? "",
      r.state ?? "",
      r.lastPurchaseAt ? new Date(r.lastPurchaseAt).toLocaleDateString("pt-BR") : "",
      r.daysSinceLast ?? "",
      r.totalSpent.toFixed(2).replace(".", ","),
      r.purchaseCount,
      r.averageTicket.toFixed(2).replace(".", ","),
      r.favoriteCategoryName ?? "",
      r.preferredPaymentMethod ?? "",
    ]
      .map(esc)
      .join(";"),
  );
  return [header.join(";"), ...lines].join("\r\n");
}
