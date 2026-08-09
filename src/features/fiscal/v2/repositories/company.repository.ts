import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyFiscalProfile } from "../types";

const COMPANY_COLS =
  "id, name, trade_name, cnpj, ie, im, phone, email, address, address_number," +
  " complement, neighborhood, city, state, zip_code";

type Row = Record<string, string | null | undefined>;

function mapProfile(companyId: string, row: Row | null): CompanyFiscalProfile {
  const c = row ?? {};
  return {
    id: companyId,
    legalName: (c.name as string) ?? null,
    tradeName: (c.trade_name as string) ?? null,
    cnpj: (c.cnpj as string) ?? null,
    ie: (c.ie as string) ?? null,
    im: (c.im as string) ?? null,
    phone: (c.phone as string) ?? null,
    email: (c.email as string) ?? null,
    address: (c.address as string) ?? null,
    addressNumber: (c.address_number as string) ?? null,
    complement: (c.complement as string) ?? null,
    neighborhood: (c.neighborhood as string) ?? null,
    city: (c.city as string) ?? null,
    state: (c.state as string) ?? null,
    zipcode: (c.zip_code as string) ?? null,
  };
}

/**
 * Repository para persistência de dados da empresa (perfil fiscal).
 */
export class CompanyRepository {
  constructor(private supabase: SupabaseClient) {}

  async getProfile(companyId: string): Promise<CompanyFiscalProfile> {
    const { data, error } = await this.supabase
      .from("companies")
      .select(COMPANY_COLS)
      .eq("id", companyId)
      .maybeSingle();
    if (error) throw error;
    return mapProfile(companyId, (data ?? null) as Row | null);
  }

  /** Atualiza o cadastro e devolve o perfil relido (read-back). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateProfile(companyId: string, payload: Record<string, any>): Promise<CompanyFiscalProfile> {
    const { error } = await this.supabase
      .from("companies")
      .update(payload)
      .eq("id", companyId);
    if (error) throw error;
    return this.getProfile(companyId);
  }

  async hasPermission(userId: string, companyId: string, code: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("has_permission", {
      _user_id: userId,
      _company_id: companyId,
      _permission_code: code,
    });
    if (error) throw error;
    return Boolean(data);
  }
}
