/**
 * Repository para persistência de configuração de provedor, ambientes,
 * segredos e status de saúde. Sem regras fiscais.
 */
export class StatusRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.supabase.from("fiscal_provider_config");
    }
    async getProviderConfig(companyId) {
        const { data, error } = await this.table()
            .select("provider_id, api_url, environment, last_health_status")
            .eq("company_id", companyId)
            .maybeSingle();
        if (error)
            throw error;
        return data ?? null;
    }
    /** Linha completa da configuração, com a lista de colunas do chamador. */
    async getProviderRow(companyId, columns) {
        const { data, error } = await this.table()
            .select(columns)
            .eq("company_id", companyId)
            .maybeSingle();
        if (error)
            throw error;
        return data ?? null;
    }
    /** Ambiente ativo configurado (sem default aplicado). */
    async getActiveEnvironment(companyId) {
        const { data, error } = await this.table()
            .select("environment")
            .eq("company_id", companyId)
            .maybeSingle();
        if (error)
            throw error;
        return (data?.environment ?? null);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async updateProviderConfig(companyId, payload, columns) {
        const { data, error } = await this.table()
            .update(payload)
            .eq("company_id", companyId)
            .select(columns)
            .maybeSingle();
        if (error)
            throw error;
        return data ?? null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async insertProviderConfig(payload, columns) {
        const { data, error } = await this.table().insert(payload).select(columns).single();
        if (error)
            throw error;
        return data;
    }
    async getProviderEnvironments(companyId) {
        const { data, error } = await this.supabase
            .from("fiscal_provider_environments")
            .select("*")
            .eq("company_id", companyId);
        if (error)
            throw error;
        return data ?? [];
    }
    async hasSecret(companyId, kind, environment, ownerId = null) {
        const { data, error } = await this.supabase.rpc("fiscal_has_secret", {
            _company_id: companyId,
            _kind: kind,
            _owner_id: ownerId,
            ...(environment ? { _environment: environment } : {}),
        });
        if (error)
            return false;
        return Boolean(data);
    }
    /** Persiste um segredo já cifrado pelo chamador. */
    async setSecret(params) {
        const { error } = await this.supabase.rpc("fiscal_set_secret", {
            _company_id: params.companyId,
            _kind: params.kind,
            _owner_id: (params.ownerId ?? null),
            _ciphertext: params.ciphertext,
            ...(params.environment ? { _environment: params.environment } : {}),
        });
        if (error)
            throw error;
    }
    async recordProviderHealth(companyId, status, message) {
        await this.supabase.rpc("fiscal_record_provider_health", {
            _company_id: companyId,
            _status: status,
            _message: message,
        });
    }
}
