import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyFiscalProfile } from "../types";

export async function fetchCompanyFiscalProfile(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyFiscalProfile | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, trade_name, cnpj, ie, im, phone, email, address, address_number, address_complement, neighborhood, city, state, zipcode")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    id: row.id,
    legalName: row.name,
    tradeName: row.trade_name,
    cnpj: row.cnpj,
    ie: row.ie,
    im: row.im,
    phone: row.phone,
    email: row.email,
    address: row.address,
    addressNumber: row.address_number,
    complement: row.address_complement,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    zipcode: row.zipcode,
  };
}
