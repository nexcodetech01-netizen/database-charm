/**
 * Repository para leitura de clientes (visão fiscal).
 */
export class CustomersRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    /** Dados completos do destinatário usados na simulação de emissão. */
    async findFiscalInfo(companyId, customerId) {
        const { data, error } = await this.supabase
            .from("customers")
            .select("name, document, email, address, address_number, neighborhood, city, state, zip")
            .eq("company_id", companyId)
            .eq("id", customerId)
            .maybeSingle();
        if (error)
            throw error;
        return (data ?? null);
    }
    /** Nome + documento (contexto do documento fiscal). */
    async findBasic(companyId, customerId) {
        const { data, error } = await this.supabase
            .from("customers")
            .select("name, document")
            .eq("company_id", companyId)
            .eq("id", customerId)
            .maybeSingle();
        if (error)
            throw error;
        return (data ?? null);
    }
}
