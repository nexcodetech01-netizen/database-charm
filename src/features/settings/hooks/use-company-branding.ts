import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { companyBrandingService } from "@/services/company-branding.service";

export interface CompanyBranding {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  ie: string | null;
  im: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  segment: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  logo_path: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

/**
 * Centraliza dados institucionais + URL assinada da logo.
 * Utilizado em cupom, PDFs, Central de Vendas e Bella IA.
 */
export function useCompanyBranding(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["company", "branding", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const logoUrl = await companyBrandingService.signedLogoUrl(
        (data as { logo_path?: string | null }).logo_path ?? null,
      );
      return {
        company: data as unknown as CompanyBranding,
        logoUrl,
      };
    },
  });
}
