/**
 * Busca (no servidor, sem login) nome, logo e cor da loja para as telas
 * públicas. Usa o mesmo bucket/forma de URL assinada da logo da empresa.
 */
import type { StoreBranding } from "./brand";

const LOGO_BUCKET = "product-images";
const LOGO_TTL_SECONDS = 60 * 60;

type AdminClient = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  storage: { from: (bucket: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export async function loadStoreBranding(
  supabaseAdmin: AdminClient,
  companyId: string,
): Promise<StoreBranding> {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("name, trade_name, logo_path, primary_color")
    .eq("id", companyId)
    .maybeSingle();

  const c = (company ?? {}) as {
    name?: string | null;
    trade_name?: string | null;
    logo_path?: string | null;
    primary_color?: string | null;
  };

  let logoUrl: string | null = null;
  if (c.logo_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(c.logo_path, LOGO_TTL_SECONDS);
    logoUrl = (signed as { signedUrl?: string } | null)?.signedUrl ?? null;
  }

  return {
    name: c.trade_name?.trim() || c.name?.trim() || null,
    logoUrl,
    primaryColor: c.primary_color ?? null,
  };
}
