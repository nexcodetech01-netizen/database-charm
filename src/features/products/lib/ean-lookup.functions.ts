/**
 * Consulta pública opcional de produto por EAN/GTIN.
 *
 * Fonte: Open Food Facts (base aberta, sem chave de API). Retorna apenas
 * dados cadastrais (descrição, marca, quantidade/embalagem, imagem).
 * A base pública NÃO fornece NCM/CEST — esses continuam vindo da categoria
 * ou do histórico interno da empresa.
 *
 * O gatilho é sempre manual: nada é preenchido sem ação do usuário.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, "Código de barras deve ter entre 8 e 14 dígitos."),
});

export interface EanLookupResult {
  found: boolean;
  source: string;
  barcode: string;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  imageUrl: string | null;
  categories: string[];
}

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    product_name_pt?: string;
    generic_name?: string;
    brands?: string;
    quantity?: string;
    image_front_url?: string;
    image_url?: string;
    categories?: string;
  };
}

const clean = (value: string | undefined | null): string | null => {
  const text = (value ?? "").trim();
  return text.length ? text : null;
};

export const lookupProductByEan = createServerFn({ method: "POST" })
  // Consulta externa disparada pelo app: exige sessão autenticada.
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data }): Promise<EanLookupResult> => {
    const { integrationFetchJson } = await import("@/lib/http-client.server");

    const empty: EanLookupResult = {
      found: false,
      source: "Open Food Facts",
      barcode: data.barcode,
      name: null,
      brand: null,
      quantity: null,
      imageUrl: null,
      categories: [],
    };

    try {
      const json = await integrationFetchJson<OffResponse>(
        `https://world.openfoodfacts.org/api/v2/product/${data.barcode}.json?fields=product_name,product_name_pt,generic_name,brands,quantity,image_front_url,image_url,categories`,
        { method: "GET", headers: { "User-Agent": "NexOS-ERP/1.0 (product-registration)" } },
        { integration: "openfoodfacts", timeoutMs: 8_000, maxAttempts: 2 },
      );

      const product = json.product;
      if (json.status !== 1 || !product) return empty;

      const name =
        clean(product.product_name_pt) ??
        clean(product.product_name) ??
        clean(product.generic_name);

      if (!name) return empty;

      return {
        ...empty,
        found: true,
        name,
        brand: clean(product.brands)?.split(",")[0]?.trim() ?? null,
        quantity: clean(product.quantity),
        imageUrl: clean(product.image_front_url) ?? clean(product.image_url),
        categories: clean(product.categories)
          ? clean(product.categories)!
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
              .slice(0, 5)
          : [],
      };
    } catch (error) {
      console.error("[ean-lookup] falha na consulta pública", error);
      return empty;
    }
  });
