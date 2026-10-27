import { describe, expect, it, vi } from "vitest";

const prod = (
  id: string,
  stock: number,
  cover: string | null,
  extra: Record<string, unknown> = {},
) => ({
  id,
  sku: null,
  name: id,
  brand: null,
  model: null,
  color: null,
  size: null,
  price: 50,
  stock,
  unit: "UN",
  status: "active",
  category_id: null,
  cover_image_path: cover,
  image_url: null,
  created_at: null,
  updated_at: null,
  company_id: "c1",
  description: null,
  sales_channels: ["loja_fisica", "catalog"],
  product_type: null,
  category: null,
  ...extra,
});

const tables: Record<string, unknown> = {
  product_collections: {
    id: "col1",
    slug: "s",
    name: "C",
    description: null,
    cover_url: null,
    status: "active",
    company_id: "c1",
    scheduled_at: null,
    cta_mode: "whatsapp",
    show_price: true,
    show_installments: true,
    show_stock: true,
    show_brand: true,
  },
  companies: {
    id: "c1",
    name: "T&G",
    whatsapp: "14999999999",
    phone: null,
    primary_color: null,
    logo_path: null,
  },
  bella_pay_config: null,
  company_card_price_config: null,
  product_collection_items: [
    { position: 1, product: prod("com-estoque-e-capa", 2, "a.webp") },
    { position: 2, product: prod("sem-estoque", 0, "b.webp") },
    { position: 3, product: prod("sem-foto", 3, null) },
    { position: 4, product: prod("so-galeria", 1, null) },
    {
      position: 5,
      product: prod("fora-do-catalogo", 1, "c.webp", { sales_channels: ["loja_fisica"] }),
    },
  ],
  product_images: [
    { product_id: "so-galeria", path: "g1.webp", position: 0 },
    { product_id: "so-galeria", path: "g2.webp", position: 1 },
    { product_id: "com-estoque-e-capa", path: "a.webp", position: 0 },
    { product_id: "com-estoque-e-capa", path: "a-costas.webp", position: 1 },
  ],
};

function query(table: string) {
  const data = tables[table];
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    maybeSingle: async () => ({ data, error: null }),
    then: (res: (v: unknown) => unknown) => res({ data, error: null }),
  };
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (t: string) => query(t),
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}` })),
        }),
        createSignedUrl: async () => ({ data: null }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x/${p}` } }),
      }),
    },
  },
}));
vi.mock("@/features/catalog/lib/preview-auth.server", () => ({
  authorizePreview: async () => ({ ok: true }),
}));

describe("vitrine do catálogo", () => {
  it("mostra só peças com estoque e com foto", async () => {
    const { loadCollectionPagePayload } = await import("../load-collection-page.server");
    const r = await loadCollectionPagePayload({ slug: "s", isPreview: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.payload.products.map((p) => [p.id, p]));
    expect(Object.keys(byId).sort()).toEqual(["com-estoque-e-capa", "so-galeria"]);
    expect(byId["so-galeria"].cover_url).toBe("https://x/g1.webp");
    expect(byId["so-galeria"].second_url).toBe("https://x/g2.webp");
    expect(byId["so-galeria"].image_count).toBe(2);
    expect(byId["com-estoque-e-capa"].second_url).toBe("https://x/a-costas.webp");
    expect(byId["com-estoque-e-capa"].image_count).toBe(2);
  });
});
