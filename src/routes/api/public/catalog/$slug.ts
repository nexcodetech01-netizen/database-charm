import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";
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
  barcode: string | null;
  brand: string | null;
  description: string | null;
  price: number | string;
  stock: number | string;
  unit: string;
  status: string;
  cover_image_path: string | null;
};

async function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

export const Route = createFileRoute("/api/public/catalog/$slug")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: await corsHeaders() }),
      GET: async ({ params, request }) => {
        const limited = enforceRateLimit(
          { route: "catalog:collection", max: 60, windowMs: 60_000 },
          await corsHeaders(),
        );
        if (limited) return limited;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const url = new URL(request.url);
        const isPreview = url.searchParams.get("preview") === "1";

        const headers = {
          ...(await corsHeaders()),
          "content-type": "application/json",
        };

        const { data: col, error: colErr } = await supabaseAdmin
          .from("product_collections")
          .select(
            "id, slug, name, description, cover_url, status, company_id, scheduled_at, cta_mode, show_price, show_installments, show_stock, show_brand",
          )
          .eq("slug", params.slug)
          .maybeSingle<PublicCollectionRow>();


        if (colErr) {
          return new Response(JSON.stringify({ error: colErr.message }), {
            status: 500,
            headers,
          });
        }
        if (!col) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers,
          });
        }

        // Preview (coleção agendada) exige usuário autenticado da empresa dona.
        if (col.status === "scheduled") {
          if (!isPreview) {
            return new Response(JSON.stringify({ error: "not_found" }), {
              status: 404,
              headers,
            });
          }
          const auth = await authorizePreview(supabaseAdmin, col.company_id);
          if (!auth.ok) {
            return new Response(JSON.stringify({ error: "not_found" }), {
              status: 404,
              headers,
            });
          }
        } else if (col.status !== "active") {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers,
          });
        }

        const [{ data: company }, { data: payCfg }, { data: items }] =
          await Promise.all([
            supabaseAdmin
              .from("companies")
              .select("id, name, whatsapp, phone")
              .eq("id", col.company_id)
              .maybeSingle<{
                id: string;
                name: string;
                whatsapp: string | null;
                phone: string | null;
              }>(),
            supabaseAdmin
              .from("bella_pay_config")
              .select("credit_card_max_installments, connection_status")
              .eq("company_id", col.company_id)
              .maybeSingle<{
                credit_card_max_installments: number | null;
                connection_status: string | null;
              }>(),
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
          .filter((p): p is PublicItemProduct => !!p && p.status === "active" && Number(p.stock) > 0 && (p as any).sales_channels?.includes("catalog"));

        const paths = products
          .map((p) => p.cover_image_path)
          .filter((p): p is string => !!p);

        let urlMap = new Map<string, string>();
        if (paths.length > 0) {
          const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrls(paths, SIGN_TTL);
          urlMap = new Map(
            (signed ?? [])
              .filter((s) => s.signedUrl)
              .map((s) => [s.path as string, s.signedUrl as string]),
          );
        }

        const whatsapp = (company?.whatsapp || company?.phone || "").replace(
          /\D+/g,
          "",
        );
        const ctaMode = (col.cta_mode ?? "whatsapp") as
          | "whatsapp"
          | "entrada"
          | "comprar_agora";
        const bellaPayReady = payCfg?.connection_status === "connected";
        let cta: "whatsapp" | "entrada" | "comprar_agora" | "none" = ctaMode;
        if (ctaMode === "whatsapp" && !whatsapp) cta = "none";
        if (ctaMode === "entrada" && !bellaPayReady) cta = "none";
        if (ctaMode === "comprar_agora") cta = "none";

        const payload = {
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
          products: products.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku ?? null,
            brand: p.brand,
            category_name: (p as any).category?.name ?? null,
            description: p.description,
            price: Number(p.price),
            stock: Number(p.stock),
            unit: p.unit,
            cover_url: p.cover_image_path
              ? (urlMap.get(p.cover_image_path) ?? null)
              : null,
          })),
        };


        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            ...headers,
            "cache-control": "public, max-age=60, s-maxage=60",
          },
        });
      },
    },
  },
});
