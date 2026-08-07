import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomerFiscalInfo {
  id: string;
  name: string;
  document: string;
  email: string | null;
  address?: {
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip: string;
  };
}

export async function fetchCustomerFiscalInfo(
  supabase: SupabaseClient,
  companyId: string,
  customerId: string,
): Promise<CustomerFiscalInfo | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, document, email, street, number, district, city, state, zip")
    .eq("company_id", companyId)
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    email: row.email,
    address: row.street ? {
      street: row.street,
      number: row.number,
      district: row.district,
      city: row.city,
      state: row.state,
      zip: row.zip,
    } : undefined,
  };
}
