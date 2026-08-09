import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Repository para leitura de vendas na visão fiscal.
 * Apenas SELECT/INSERT/UPDATE/DELETE/RPC + mapeamento DTO.
 */
export type FiscalSaleRow = {
  id: string;
  number: string | null;
  sale_date: string | null;
  paid_at: string | null;
  status: string;
  grand_total: number | null;
  customers: { name: string | null; document: string | null } | null;
  sale_items: Array<{
    description: string | null;
    products: {
      name: string | null;
      sku: string | null;
      barcode: string | null;
      ncm: string | null;
    } | null;
  }> | null;
};

export type SaleSummaryRow = {
  id: string;
  number: number | null;
  grand_total: number | null;
  customer_id: string | null;
  status: string;
};

export type SaleItemRow = {
  id: string;
  product_id: string | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
};

const LIST_COLS =
  "id, number, sale_date, paid_at, status, grand_total," +
  " customers(name, document)," +
  " sale_items(description, products(name, sku, barcode, ncm))";

export class SalesRepository {
  constructor(private supabase: SupabaseClient) {}

  /** Verifica se a venda pertence à empresa. */
  async exists(companyId: string, saleId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("sales")
      .select("id")
      .eq("company_id", companyId)
      .eq("id", saleId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  /** Lista vendas para o seletor fiscal. */
  async listForFiscal(
    companyId: string,
    options: { limit: number; excludeDraft: boolean; onlyPaid: boolean },
  ): Promise<FiscalSaleRow[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = this.supabase.from("sales").select(LIST_COLS).eq("company_id", companyId);
    if (options.excludeDraft) {
      q = q.neq("status", "draft");
      if (options.onlyPaid) q = q.eq("status", "paid");
    }
    q = q
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(options.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as FiscalSaleRow[];
  }

  /** Cabeçalho da venda usado na simulação. */
  async findSummary(companyId: string, saleId: string): Promise<SaleSummaryRow | null> {
    const { data, error } = await this.supabase
      .from("sales")
      .select("id, number, grand_total, customer_id, status")
      .eq("company_id", companyId)
      .eq("id", saleId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as SaleSummaryRow | null;
  }

  /** Número + cliente da venda (contexto do documento). */
  async findHeader(
    companyId: string,
    saleId: string,
  ): Promise<{ number: number | null; customer_id: string | null } | null> {
    const { data, error } = await this.supabase
      .from("sales")
      .select("number, customer_id")
      .eq("company_id", companyId)
      .eq("id", saleId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as {
      number: number | null;
      customer_id: string | null;
    } | null;
  }

  async listItems(saleId: string): Promise<SaleItemRow[]> {
    const { data, error } = await this.supabase
      .from("sale_items")
      .select("id, product_id, description, quantity, unit_price, total")
      .eq("sale_id", saleId);
    if (error) throw error;
    return (data ?? []) as unknown as SaleItemRow[];
  }

  async countItems(saleId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("sale_items")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", saleId);
    if (error) throw error;
    return count ?? 0;
  }
}
