export async function fetchHasSecret(supabase, companyId, kind, environment, ownerId = null) {
    const { data, error } = await supabase.rpc("fiscal_has_secret", {
        _company_id: companyId,
        _kind: kind,
        _owner_id: ownerId,
        ...(environment ? { _environment: environment } : {}),
    });
    if (error)
        return false;
    return Boolean(data);
}
export async function fetchProviderConfig(supabase, companyId) {
    const PROVIDER_COLS = "provider_id, environment, api_url, notes, webhook_url," +
        " last_health_check_at, last_health_status, last_health_message, updated_at," +
        " provisioned_at, provisioned_environment, provisioned_certificate_id, provisioned_note";
    const { data, error } = await supabase
        .from("fiscal_provider_config")
        .select(PROVIDER_COLS)
        .eq("company_id", companyId)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
export async function fetchProviderEnvironments(supabase, companyId) {
    const PROVIDER_ENV_COLS = "environment, api_url, provisioned_at, provisioned_environment," +
        " provisioned_certificate_id, provisioned_note," +
        " last_health_check_at, last_health_status, last_health_message";
    const { data } = await supabase
        .from("fiscal_provider_environments")
        .select(PROVIDER_ENV_COLS)
        .eq("company_id", companyId);
    const rows = (data ?? []);
    const emptyEnv = (env) => ({
        environment: env,
        apiUrl: null,
        hasApiKey: false,
        hasAdminKey: false,
        provisionedAt: null,
        provisionedEnvironment: null,
        provisionedCertificateId: null,
        provisionedNote: null,
        lastHealthCheckAt: null,
        lastHealthStatus: null,
        lastHealthMessage: null,
    });
    const out = {
        production: emptyEnv("production"),
        homologation: emptyEnv("homologation"),
    };
    for (const env of ["production", "homologation"]) {
        const row = rows.find((r) => r.environment === env) ?? null;
        out[env] = {
            environment: env,
            apiUrl: row?.api_url ?? null,
            hasApiKey: await fetchHasSecret(supabase, companyId, "provider_api_key", env),
            hasAdminKey: await fetchHasSecret(supabase, companyId, "provider_admin_key", env),
            provisionedAt: row?.provisioned_at ?? null,
            provisionedEnvironment: row?.provisioned_environment ?? null,
            provisionedCertificateId: row?.provisioned_certificate_id ?? null,
            provisionedNote: row?.provisioned_note ?? null,
            lastHealthCheckAt: row?.last_health_check_at ?? null,
            lastHealthStatus: row?.last_health_status ?? null,
            lastHealthMessage: row?.last_health_message ?? null,
        };
    }
    return out;
}
