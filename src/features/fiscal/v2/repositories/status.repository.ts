import type { SupabaseClient } from "@supabase/supabase-js";
import type { NfeEnvironment } from "../types";

/**
 * Repository para persistência de status e configurações do provedor.
 */
export class StatusRepository {
  constructor(private supabase: SupabaseClient) {}

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

  async getProviderConfig(companyId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from("fiscal_provider_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
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

  async updateProviderConfig(companyId: string, payload: any): Promise<any> {
    const { data, error } = await this.supabase
      .from("fiscal_provider_config")
      .update(payload)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async insertProviderConfig(payload: any): Promise<any> {
    const { data, error } = await this.supabase
      .from("fiscal_provider_config")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
}
