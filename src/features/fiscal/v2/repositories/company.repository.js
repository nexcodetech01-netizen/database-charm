const COMPANY_COLS = "id, name, trade_name, cnpj, ie, im, phone, email, address, address_number," +
    " complement, neighborhood, city, state, zip_code";
function mapProfile(companyId, row) {
    const c = row ?? {};
    return {
        id: companyId,
        legalName: c.name ?? null,
        tradeName: c.trade_name ?? null,
        cnpj: c.cnpj ?? null,
        ie: c.ie ?? null,
        im: c.im ?? null,
        phone: c.phone ?? null,
        email: c.email ?? null,
        address: c.address ?? null,
        addressNumber: c.address_number ?? null,
        complement: c.complement ?? null,
        neighborhood: c.neighborhood ?? null,
        city: c.city ?? null,
        state: c.state ?? null,
        zipcode: c.zip_code ?? null,
    };
}
/**
 * Repository para persistência de dados da empresa (perfil fiscal).
 */
export class CompanyRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getProfile(companyId) {
        const { data, error } = await this.supabase
            .from("companies")
            .select(COMPANY_COLS)
            .eq("id", companyId)
            .maybeSingle();
        if (error)
            throw error;
        return mapProfile(companyId, (data ?? null));
    }
    /** Atualiza o cadastro e devolve o perfil relido (read-back). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async updateProfile(companyId, payload) {
        const { error } = await this.supabase
            .from("companies")
            .update(payload)
            .eq("id", companyId);
        if (error)
            throw error;
        return this.getProfile(companyId);
    }
    async hasPermission(userId, companyId, code) {
        const { data, error } = await this.supabase.rpc("has_permission", {
            _user_id: userId,
            _company_id: companyId,
            _permission_code: code,
        });
        if (error)
            throw error;
        return Boolean(data);
    }
}
