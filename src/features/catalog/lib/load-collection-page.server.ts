// ============= Lines 1-181 of 181 total lines =============

import { authorizePreview } from "@/features/catalog/lib/preview-auth.server";

const BUCKET = "product-images";
const SIGN_TTL = 60 * 60;
const DEFAULT_ENTRADA_PERCENT = 30;

type PublicCollectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  status: string;
  company_id: string;
  scheduled_at: string | null;
  cta_mode: string | null;
  show_price: boolean | null;
  show_installments: boolean | null;
  show_stock: boolean | null;
  show_brand: boolean | null;
};

type PublicItemProduct = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  description: string | null;
  price: number | string;
  stock: number | string;
  unit: string;
  status: string;
  cover_image_path: string | null;
};

export type CollectionPagePayload = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  status: string;
  company_name: string;
  installment_max: number | null;
  cta: "whatsapp" | "entrada" | "comprar_agora" | "none";
  cta_mode: "whatsapp" | "entrada" | "comprar_agora";
  whatsapp_phone: string | null;
  entrada_percent: number;
  show_price: boolean;
  show_installments: boolean;
  show_stock: boolean;
  show_brand: boolean;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    brand: string | null;
    category_name: string | null;
    description: string | null;
    price: number;
    stock: number;
    unit: string;
    cover_url: string | null;
  }>;
  categories: string[];
};

export type CollectionPageResult =
  | { ok: true; payload: CollectionPagePayload }
  | { ok: false; status: 404 | 500; error: string };

/**
 * Lógica compartilhada de "carregar a página pública de uma coleção".
 * Chamada diretamente pela rota HTTP (`$slug.ts`, cache de CDN) E pelo
 * server function de SSR (`loadPublicCollection`) — nenhum dos dois faz
 * `fetch()` pra si mesmo. Mesmo padrão adotado na correção da SuperFrete
 * de 2026-08-18: uma server function chamando a si mesma via HTTP é frágil
 * (resolução de origin em SSR, latência dobrada) e desnecessário quando o
 * código já roda no mesmo processo.
 */
export async function loadCollectionPagePayload(params: {
  slug: string;
  isPreview: boolean;
}): Promise<CollectionPageResult> {
  try {
    return await loadCollectionPagePayloadInner(params);
  } catch (err) {
    // BUG-CATALOGO-500 (2026-08-27): a função inteira rodava sem try/catch —
    // qualquer exceção (banco, storage, config ausente) virava um 500 cru,
    // sem corpo JSON e sem stack visível pro usuário nem pro dev server.
    //
    // Causa mais provável desse 500 específico: `supabaseAdmin` (client.server.ts)
    // lança exceção na primeira chamada quando as secrets SUPABASE_URL /
    // MY_SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) não estão
    // configuradas no ambiente. Essa é a ÚNICA rota do app que depende do
    // cliente administrativo — por isso só ela quebra.
    // eslint-disable-next-line no-console
    console.error(`[catalog:${params.slug}] ERRO ao montar payload público`, err);

    const isAdminClientMissing =
      err instanceof Error && err.message.includes("Operação administrativa indisponível");

    return {
      ok: false,
      // Sem a chave de serviço configurada, a home pública não pode
      // funcionar de jeito nenhum — melhor devolver 404 (página não
      // encontrada) do que um 500 "quebrado" pro visitante do site.
      status: isAdminClientMissing ? 404 : 500,
      error: isAdminClientMissing
        ? "not_found"
        : err instanceof Error
          ? err.message
          : "Erro ao carregar o catálogo.",
    };
  }
}

async function loadCollectionPagePayloadInner(params: {
  slug: string;
  isPreview: boolean;
}): Promise<CollectionPageResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: col, error: colErr } = await supabaseAdmin
    .from("product_collections")
    .select(
      "id, slug, name, description, cover_url, status, company_id, scheduled_at, cta_mode, show_price, show_installments, show_stock, show_brand",
    )
    .eq("slug", params.slug)
    .maybeSingle<PublicCollectionRow>();

  if (colErr) return { ok: false, status: 500, error: colErr.message };
  if (!col) return { ok: false, status: 404, error: "not_found" };

  // Preview (coleção agendada) exige usuário autenticado da empresa dona.
  if (col.status === "scheduled") {
    if (!params.isPreview) return { ok: false, status: 404, error: "not_found" };
    const auth = await authorizePreview(supabaseAdmin, col.company_id);
    if (!auth.ok) return { ok: false, status: 404, error: "not_found" };
  } else if (col.status !== "active") {
    return { ok: false, status: 404, error: "not_found" };
  }

  const [{ data: company }, { data: payCfg }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("companies")
      .select("id, name, whatsapp, phone")
      .eq("id", col.company_id)
      .maybeSingle<{ id: string; name: string; whatsapp: string | null; phone: string | null }>(),
    supabaseAdmin
      .from("bella_pay_config")
      .select("credit_card_max_installments, connection_status")
      .eq("company_id", col.company_id)
      .maybeSingle<{ credit_card_max_installments: number | null; connection_status: string | null }>(),
    supabaseAdmin
      .from("product_collection_items")
      .select(
        "position, product:products(id, sku, name, brand, price, stock, unit, status, category_id, cover_image_path, image_url, created_at, updated_at, company_id, description, sales_channels, product_type, category:product_categories(id, name))",
      )
      .eq("collection_id", col.id)
      .order("position"),
  ]);

  const products = (items ?? [])
    .map((it) => it.product as PublicItemProduct | null)
    .filter(
      (p): p is PublicItemProduct =>
        !!p && p.status === "active" && Number(p.stock) > 0 && (p as any).sales_channels?.includes("catalog"),
    );

  const paths = products.map((p) => p.cover_image_path).filter((p): p is string => !!p);

  let urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL);
    urlMap = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));
  }

  const whatsapp = (company?.whatsapp || company?.phone || "").replace(/\D+/g, "");
  const ctaMode = (col.cta_mode ?? "whatsapp") as "whatsapp" | "entrada" | "comprar_agora";
  const bellaPayReady = payCfg?.connection_status === "connected";
  let cta: "whatsapp" | "entrada" | "comprar_agora" | "none" = ctaMode;
  if (ctaMode === "whatsapp" && !whatsapp) cta = "none";
  if (ctaMode === "entrada" && !bellaPayReady) cta = "none";
  if (ctaMode === "comprar_agora") cta = "none";

  const categoriesSet = new Set<string>();
  products.forEach((p: any) => {
    if (p.category?.name) categoriesSet.add(p.category.name);
  });

  const payload: CollectionPagePayload = {
    id: col.id,
    slug: col.slug,
    name: col.name,
    description: col.description,
    cover_url: col.cover_url,
    status: col.status,
    company_name: company?.name ?? "",
    installment_max: payCfg?.credit_card_max_installments ?? null,
    cta,
    cta_mode: ctaMode,
    whatsapp_phone: whatsapp || null,
    entrada_percent: DEFAULT_ENTRADA_PERCENT,
    show_price: col.show_price ?? true,
    show_installments: col.show_installments ?? true,
    show_stock: col.show_stock ?? true,
    show_brand: col.show_brand ?? true,
    categories: Array.from(categoriesSet).sort((a, b) => a.localeCompare(b)),
    products: products.map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      brand: p.brand,
      category_name: p.category?.name ?? null,
      description: p.description,
      price: Number(p.price),
      stock: Number(p.stock),
      unit: p.unit,
      cover_url: p.cover_image_path ? (urlMap.get(p.cover_image_path) ?? null) : null,
    })),
  };

  return { ok: true, payload };
}
