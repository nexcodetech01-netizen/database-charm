// ============= Lines 1-181 of 181 total lines =============

import { authorizePreview } from "@/features/catalog/lib/preview-auth.server";
import { cached } from "./short-cache.server";
import { loadCatalogTheme, type CatalogTheme } from "./catalog-theme";

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
  created_at?: string | null;
  model?: string | null;
  color?: string | null;
  size?: string | null;
};

export type CollectionPagePayload = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  status: string;
  company_name: string;
  /** Cor principal da loja (Configurações › Empresa); null = neutro. */
  brand_color: string | null;
  /** Logo da loja (URL assinada); null = sem logo. */
  logo_url: string | null;
  /** Tema do catálogo escolhido pela loja. */
  catalog_theme: CatalogTheme;
  installment_max: number | null;
  installment_min_amount: number;
  card_fee_percent: number;
  card_price_active: boolean;
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
    /** 2ª foto (ex.: costas), para trocar ao tocar/passar o mouse. */
    second_url: string | null;
    image_count: number;
    created_at: string | null;
    model: string | null;
    color: string | null;
    size: string | null;
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
    if (params.isPreview) return await loadCollectionPagePayloadInner(params);
    return await cached(
      `col:${params.slug}`,
      () => loadCollectionPagePayloadInner(params),
      (r) => r.ok,
    );
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

  const [{ data: company }, { data: payCfg }, { data: cardCfg }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("companies")
      .select("id, name, trade_name, whatsapp, phone, primary_color, logo_path")
      .eq("id", col.company_id)
      .maybeSingle<{
        id: string;
        name: string;
        trade_name: string | null;
        whatsapp: string | null;
        phone: string | null;
        primary_color: string | null;
        logo_path: string | null;
      }>(),
    supabaseAdmin
      .from("bella_pay_config")
      .select("credit_card_max_installments, connection_status")
      .eq("company_id", col.company_id)
      .maybeSingle<{ credit_card_max_installments: number | null; connection_status: string | null }>(),
    supabaseAdmin
      .from("company_card_price_config")
            .select("card_fee_percent,max_installments,active,min_installment_amount")
      .eq("company_id", col.company_id)
      .maybeSingle<{
        card_fee_percent: number | null;
        max_installments: number | null;
        active: boolean | null;
        min_installment_amount: number | null;
      }>(),
    supabaseAdmin
      .from("product_collection_items")
      .select(
        "position, product:products(id, sku, name, brand, model, color, size, price, stock, unit, status, category_id, cover_image_path, image_url, created_at, updated_at, company_id, description, sales_channels, product_type, category:product_categories(id, name))",
      )
      .eq("collection_id", col.id)
      .order("position"),
  ]);

  // Só entra na vitrine: ativo, com estoque, no canal catálogo.
  const candidates = (items ?? [])
    .map((it) => it.product as PublicItemProduct | null)
    .filter(
      (p): p is PublicItemProduct =>
        !!p && p.status === "active" && Number(p.stock) > 0 && (p as any).sales_channels?.includes("catalog"),
    );

  // Galeria de cada peça, na ordem.
  const candidateIds = candidates.map((p) => p.id);
  const galleryById = new Map<string, string[]>();
  if (candidateIds.length > 0) {
    const { data: gallery } = await supabaseAdmin
      .from("product_images")
      .select("product_id, path, position")
      .in("product_id", candidateIds)
      .order("position");
    for (const g of gallery ?? []) {
      if (!g.path) continue;
      const pid = g.product_id as string;
      const list = galleryById.get(pid) ?? [];
      list.push(g.path as string);
      galleryById.set(pid, list);
    }
  }

  // ...e precisa ter foto. Sem capa definida, usa a 1ª foto da galeria.
  const products = candidates
    .map((p) => {
      const cover = p.cover_image_path || galleryById.get(p.id)?.[0] || null;
      return cover === p.cover_image_path ? p : { ...p, cover_image_path: cover };
    })
    .filter((p) => !!p.cover_image_path);

  // Quantas fotos e qual é a 2ª (ex.: costas) para trocar no card.
  const secondPathById = new Map<string, string>();
  const imageCountById = new Map<string, number>();
  for (const p of products) {
    const all = new Set([p.cover_image_path!, ...(galleryById.get(p.id) ?? [])]);
    imageCountById.set(p.id, all.size);
    const second = [...all].find((x) => x !== p.cover_image_path);
    if (second) secondPathById.set(p.id, second);
  }

  const paths = [
    ...products.map((p) => p.cover_image_path),
    ...secondPathById.values(),
  ].filter((p): p is string => !!p);

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

  // Logo da loja para o topo do catálogo (falha não derruba a página).
  let logoUrl: string | null = null;
  if (company?.logo_path) {
    const { data: signedLogo } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUrl(company.logo_path, 60 * 60);
    logoUrl = signedLogo?.signedUrl ?? null;
  }

  const payload: CollectionPagePayload = {
    id: col.id,
    slug: col.slug,
    name: col.name,
    description: col.description,
    cover_url: col.cover_url,
    status: col.status,
    company_name: company?.trade_name?.trim() || company?.name || "",
    catalog_theme: await loadCatalogTheme(supabaseAdmin, col.company_id),
    brand_color: company?.primary_color ?? null,
    logo_url: logoUrl,
        installment_max: cardCfg?.max_installments ?? payCfg?.credit_card_max_installments ?? 3,
    installment_min_amount: Number(cardCfg?.min_installment_amount ?? 0),
    card_fee_percent: Number(cardCfg?.card_fee_percent ?? 2.88),
    card_price_active: cardCfg?.active ?? true,
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
      second_url: secondPathById.has(p.id) ? (urlMap.get(secondPathById.get(p.id)!) ?? null) : null,
      image_count: imageCountById.get(p.id) ?? 1,
      created_at: p.created_at ?? null,
      model: p.model ?? null,
      color: p.color ?? null,
      size: p.size ?? null,
    })),
  };

  return { ok: true, payload };
}
