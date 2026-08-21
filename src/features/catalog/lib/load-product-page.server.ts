// ============= Lines 1-235 of 235 total lines =============

import { authorizePreview } from "@/features/catalog/lib/preview-auth.server";

const BUCKET = "product-images";
const SIGN_TTL = 60 * 60;
const DEFAULT_ENTRADA_PERCENT = 30;

export type ProductPagePayload = {
  id: string;
  company_id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  stock: number;
  unit: string;
  images: Array<{ path: string; url: string; focal_x: number; focal_y: number; zoom: number }>;
  collection: { id: string; slug: string; name: string };
  company_name: string;
  installment_max: number | null;
  pix_discount_percent: null;
  cta: "whatsapp" | "entrada" | "comprar_agora" | "none";
  cta_mode: "whatsapp" | "entrada" | "comprar_agora";
  whatsapp_phone: string | null;
  entrada_percent: number;
  show_price: boolean;
  show_installments: boolean;
  show_stock: boolean;
  show_brand: boolean;
  related: Array<{
    id: string;
    name: string;
    brand: string | null;
    price: number;
    stock: number;
    cover_url: string | null;
  }>;
};

export type ProductPageResult =
  | { ok: true; payload: ProductPagePayload }
  | { ok: false; status: 404; error: string };

/**
 * Lógica compartilhada de "carregar a página pública de um produto".
 * Chamada diretamente pela rota HTTP (`$productId.ts`, cache de CDN) E pelo
 * server function de SSR (`loadPublicProduct`) — nenhum dos dois faz
 * `fetch()` pra si mesmo. Mesmo padrão adotado na correção da SuperFrete
 * de 2026-08-18.
 */
export async function loadProductPagePayload(params: {
  slug: string;
  productId: string;
  isPreview: boolean;
}): Promise<ProductPageResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: col } = await supabaseAdmin
    .from("product_collections")
    .select("id, slug, name, status, company_id, cta_mode, show_price, show_installments, show_stock, show_brand")
    .eq("slug", params.slug)
    .maybeSingle<{
      id: string;
      slug: string;
      name: string;
      status: string;
      company_id: string;
      cta_mode: string | null;
      show_price: boolean | null;
      show_installments: boolean | null;
      show_stock: boolean | null;
      show_brand: boolean | null;
    }>();

  if (!col) return { ok: false, status: 404, error: "not_found" };

  if (col.status === "scheduled") {
    if (!params.isPreview) return { ok: false, status: 404, error: "not_found" };
    const auth = await authorizePreview(supabaseAdmin, col.company_id);
    if (!auth.ok) return { ok: false, status: 404, error: "not_found" };
  } else if (col.status !== "active") {
    return { ok: false, status: 404, error: "not_found" };
  }

  // Ensure product belongs to this collection
  const { data: link } = await supabaseAdmin
    .from("product_collection_items")
    .select("id")
    .eq("collection_id", col.id)
    .eq("product_id", params.productId)
    .maybeSingle();
  if (!link) return { ok: false, status: 404, error: "not_found" };

  const [{ data: prod }, { data: images }, { data: company }, { data: payCfg }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select(
        "id, sku, name, brand, price, stock, unit, status, category_id, cover_image_path, image_url, created_at, updated_at, company_id, description, sales_channels, product_type",
      )
      .eq("id", params.productId)
      .eq("company_id", col.company_id)
      .maybeSingle(),
    supabaseAdmin
      .from("product_images")
      .select("path, position, focal_x, focal_y, zoom")
      .eq("product_id", params.productId)
      .order("position"),
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
  ]);

  if (!prod || prod.status !== "active" || (prod as any).sales_channels?.includes("catalog") === false) {
    return { ok: false, status: 404, error: "not_found" };
  }

  const allPaths = Array.from(
    new Set([...(images ?? []).map((i) => i.path as string), prod.cover_image_path].filter((p): p is string => !!p)),
  );

  let urlMap = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(allPaths, SIGN_TTL);
    urlMap = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));
  }

  const framingByPath = new Map<string, { focal_x: number; focal_y: number; zoom: number }>();
  for (const img of images ?? []) {
    const p = img.path as string;
    if (!p) continue;
    framingByPath.set(p, {
      focal_x: Number((img as { focal_x?: number | null }).focal_x ?? 50),
      focal_y: Number((img as { focal_y?: number | null }).focal_y ?? 50),
      zoom: Number((img as { zoom?: number | null }).zoom ?? 1),
    });
  }

  const orderedPaths: string[] = [];
  if (prod.cover_image_path) orderedPaths.push(prod.cover_image_path);
  for (const img of images ?? []) {
    const p = img.path as string;
    if (p && !orderedPaths.includes(p)) orderedPaths.push(p);
  }

  const outImages = orderedPaths
    .map((p) => {
      const frame = framingByPath.get(p) ?? { focal_x: 50, focal_y: 50, zoom: 1 };
      return { path: p, url: urlMap.get(p) ?? "", ...frame };
    })
    .filter((i) => i.url);

  const whatsapp = (company?.whatsapp || company?.phone || "").replace(/\D+/g, "");
  const bellaPayReady = payCfg?.connection_status === "connected";
  const ctaMode = (col.cta_mode ?? "whatsapp") as "whatsapp" | "entrada" | "comprar_agora";
  let cta: "whatsapp" | "entrada" | "comprar_agora" | "none" = ctaMode;
  if (ctaMode === "whatsapp" && !whatsapp) cta = "none";
  if (ctaMode === "entrada" && !bellaPayReady) cta = "none";
  if (ctaMode === "comprar_agora") cta = "none";

  // Related products from the same collection (up to 4, excluding current)
  const { data: relatedItems } = await supabaseAdmin
    .from("product_collection_items")
    .select(
      "position, product:products(id, sku, name, brand, price, stock, unit, status, category_id, cover_image_path, image_url, created_at, updated_at, company_id, description, sales_channels, product_type)",
    )
    .eq("collection_id", col.id)
    .neq("product_id", params.productId)
    .order("position")
    .limit(8);

  type RelProd = {
    id: string;
    name: string;
    brand: string | null;
    price: number | string;
    stock: number | string;
    status: string;
    cover_image_path: string | null;
  };
  const relatedRaw = (relatedItems ?? [])
    .map((it) => it.product as RelProd | null)
    .filter(
      (p): p is RelProd =>
        !!p && p.status === "active" && Number(p.stock) > 0 && (p as any).sales_channels?.includes("catalog"),
    )
    .slice(0, 4);

  const relatedPaths = relatedRaw.map((p) => p.cover_image_path).filter((p): p is string => !!p);
  let relatedUrlMap = new Map<string, string>();
  if (relatedPaths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(relatedPaths, SIGN_TTL);
    relatedUrlMap = new Map(
      (signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]),
    );
  }
  const related = relatedRaw.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: Number(p.price),
    stock: Number(p.stock),
    cover_url: p.cover_image_path ? (relatedUrlMap.get(p.cover_image_path) ?? null) : null,
  }));

  const payload: ProductPagePayload = {
    id: prod.id,
    company_id: col.company_id,
    name: prod.name,
    brand: prod.brand,
    description: prod.description,
    price: Number(prod.price),
    stock: Number(prod.stock),
    unit: prod.unit,
    images: outImages,
    collection: { id: col.id, slug: col.slug, name: col.name },
    company_name: company?.name ?? "",
    installment_max: payCfg?.credit_card_max_installments ?? null,
    pix_discount_percent: null,
    cta,
    cta_mode: ctaMode,
    whatsapp_phone: whatsapp || null,
    entrada_percent: DEFAULT_ENTRADA_PERCENT,
    show_price: col.show_price ?? true,
    show_installments: col.show_installments ?? true,
    show_stock: col.show_stock ?? true,
    show_brand: col.show_brand ?? true,
    related,
  };

  return { ok: true, payload };
}
