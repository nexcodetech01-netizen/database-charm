import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerFiscalRow = {
  name: string | null;
  document: string | null;
  email: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

/**
 * Repository para leitura de clientes (visão fiscal).
 */
export class CustomersRepository {
  constructor(private supabase: SupabaseClient) {}

  /** Dados completos do destinatário usados na simulação de emissão. */
  async findFiscalInfo(
    companyId: string,
    customerId: string,
  ): Promise<CustomerFiscalRow | null> {
    const { data, error } = await this.supabase
      .from("customers")
      .select("name, document, email, address, address_number, neighborhood, city, state, zip")
      .eq("company_id", companyId)
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as CustomerFiscalRow | null;
  }

  /** Nome + documento (contexto do documento fiscal). */
  async findBasic(
    companyId: string,
    customerId: string,
  ): Promise<{ name: string | null; document: string | null } | null> {
    const { data, error } = await this.supabase
      .from("customers")
      .select("name, document")
      .eq("company_id", companyId)
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as {
      name: string | null;
      document: string | null;
    } | null;
  }
}
