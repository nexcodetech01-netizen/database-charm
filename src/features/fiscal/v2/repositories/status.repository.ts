import type { SupabaseClient } from "@supabase/supabase-js";
import type { NfeEnvironment } from "../types";

/**
 * Repository para persistência de configuração de provedor, ambientes,
 * segredos e status de saúde. Sem regras fiscais.
 */
export class StatusRepository {
  constructor(private supabase: SupabaseClient) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private table(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.supabase.from("fiscal_provider_config" as never) as any;
  }

  async getProviderConfig(companyId: string): Promise<any | null> {
    const { data, error } = await this.table()
      .select("provider_id, api_url, environment, last_health_status")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  /** Linha completa da configuração, com a lista de colunas do chamador. */
  async getProviderRow(companyId: string, columns: string): Promise<any | null> {
    const { data, error } = await this.table()
      .select(columns)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  /** Ambiente ativo configurado (sem default aplicado). */
  async getActiveEnvironment(companyId: string): Promise<NfeEnvironment | null> {
    const { data, error } = await this.table()
      .select("environment")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return ((data as { environment?: NfeEnvironment } | null)?.environment ?? null) as
      | NfeEnvironment
      | null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateProviderConfig(companyId: string, payload: any, columns: string): Promise<any | null> {
    const { data, error } = await this.table()
      .update(payload)
      .eq("company_id", companyId)
      .select(columns)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async insertProviderConfig(payload: any, columns: string): Promise<any> {
    const { data, error } = await this.table().insert(payload).select(columns).single();
    if (error) throw error;
    return data;
  }

  async getProviderEnvironments(companyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("fiscal_provider_environments")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw error;
    return data ?? [];
  }

  async hasSecret(
    companyId: string,
    kind: string,
    environment?: NfeEnvironment,
    ownerId: string | null = null,
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("fiscal_has_secret", {
      _company_id: companyId,
      _kind: kind,
      _owner_id: ownerId as unknown as string,
      ...(environment ? { _environment: environment } : {}),
    } as never);
    if (error) return false;
    return Boolean(data);
  }

  /** Persiste um segredo já cifrado pelo chamador. */
  async setSecret(params: {
    companyId: string;
    kind: string;
    ownerId: string | null;
    ciphertext: string | null;
    environment?: NfeEnvironment | null;
  }): Promise<void> {
    const { error } = await this.supabase.rpc("fiscal_set_secret", {
      _company_id: params.companyId,
      _kind: params.kind,
      _owner_id: (params.ownerId ?? null) as unknown as string,
      _ciphertext: params.ciphertext as unknown as string,
      ...(params.environment ? { _environment: params.environment } : {}),
    } as never);
    if (error) throw error;
  }

  async recordProviderHealth(
    companyId: string,
    status: string,
    message: string,
  ): Promise<void> {
    await this.supabase.rpc("fiscal_record_provider_health", {
      _company_id: companyId,
      _status: status,
      _message: message,
    } as never);
  }
}
