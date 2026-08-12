const LIST_COLS = "id, number, sale_date, paid_at, status, grand_total," +
    " customers(name, document)," +
    " sale_items(description, products(name, sku, barcode, ncm))";
export class SalesRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    /** Verifica se a venda pertence à empresa. */
    async exists(companyId, saleId) {
        const { data, error } = await this.supabase
            .from("sales")
            .select("id")
            .eq("company_id", companyId)
            .eq("id", saleId)
            .maybeSingle();
        if (error)
            throw error;
        return Boolean(data);
    }
    /** Lista vendas para o seletor fiscal. */
    async listForFiscal(companyId, options) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = this.supabase.from("sales").select(LIST_COLS).eq("company_id", companyId);
        if (options.excludeDraft) {
            q = q.neq("status", "draft");
            if (options.onlyPaid)
                q = q.eq("status", "paid");
        }
        q = q
            .order("sale_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(options.limit);
        const { data, error } = await q;
        if (error)
            throw error;
        return (data ?? []);
    }
    /** Cabeçalho da venda usado na simulação. */
    async findSummary(companyId, saleId) {
        const { data, error } = await this.supabase
            .from("sales")
            .select("id, number, grand_total, customer_id, status")
            .eq("company_id", companyId)
            .eq("id", saleId)
            .maybeSingle();
        if (error)
            throw error;
        return (data ?? null);
    }
    /** Número + cliente da venda (contexto do documento). */
    async findHeader(companyId, saleId) {
        const { data, error } = await this.supabase
            .from("sales")
            .select("number, customer_id")
            .eq("company_id", companyId)
            .eq("id", saleId)
            .maybeSingle();
        if (error)
            throw error;
        return (data ?? null);
    }
    async listItems(saleId) {
        const { data, error } = await this.supabase
            .from("sale_items")
            .select("id, product_id, description, quantity, unit_price, total")
            .eq("sale_id", saleId);
        if (error)
            throw error;
        return (data ?? []);
    }
    async countItems(saleId) {
        const { count, error } = await this.supabase
            .from("sale_items")
            .select("id", { count: "exact", head: true })
            .eq("sale_id", saleId);
        if (error)
            throw error;
        return count ?? 0;
    }
    async findById(companyId, saleId) {
        const { data, error } = await this.supabase
            .from("sales")
            .select("id, grand_total, discount, shipping, customer_id, sale_date, payment_method")
            .eq("company_id", companyId)
            .eq("id", saleId)
            .maybeSingle();
        if (error)
            throw error;
        return data;
    }
}
