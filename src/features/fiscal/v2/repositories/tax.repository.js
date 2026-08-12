/**
 * Repository para persistência de configurações tributárias e fiscais.
 */
export class TaxRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getSettings(companyId) {
        const { data, error } = await this.supabase
            .from("fiscal_settings")
            .select("*")
            .eq("company_id", companyId)
            .maybeSingle();
        if (error)
            throw error;
        return data;
    }
    async updateSettings(companyId, payload) {
        const { data, error } = await this.supabase
            .from("fiscal_settings")
            .upsert({ ...payload, company_id: companyId }, { onConflict: "company_id" })
            .select("*")
            .single();
        if (error)
            throw error;
        return data;
    }
    /** Flag "emitir somente após pagamento". */
    async getIssueOnlyAfterPayment(companyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await this.supabase.from("fiscal_settings")
            .select("issue_only_after_payment")
            .eq("company_id", companyId)
            .maybeSingle();
        return Boolean(data?.issue_only_after_payment);
    }
    /** CFOP e natureza da operação padrão (contexto do documento). */
    async getDefaultCfopAndNature(companyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await this.supabase.from("fiscal_settings")
            .select("default_cfop, operation_nature")
            .eq("company_id", companyId)
            .maybeSingle();
        return (data ?? null);
    }
}
