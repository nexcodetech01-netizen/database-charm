/**
 * Repository para leitura de produtos (visão fiscal).
 */
export class ProductsRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    /** Nome + NCM dos produtos vinculados aos itens da venda. */
    async findNcmInfo(companyId, productIds) {
        if (productIds.length === 0)
            return [];
        const { data, error } = await this.supabase
            .from("products")
            .select("id, name, ncm")
            .eq("company_id", companyId)
            .in("id", productIds);
        if (error)
            throw error;
        return (data ?? []);
    }
    async findFiscalLookup(companyId, productIds) {
        if (productIds.length === 0)
            return [];
        const { data, error } = await this.supabase
            .from("products")
            .select("id, name, ncm, sku, unit")
            .eq("company_id", companyId)
            .in("id", productIds);
        if (error)
            throw error;
        return (data ?? []);
    }
}
