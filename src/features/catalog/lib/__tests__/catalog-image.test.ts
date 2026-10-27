import { describe, expect, it } from "vitest";
import { catalogImgProps } from "../catalog-image";

const signed = "https://x.supabase.co/storage/v1/object/public/product-images/c/p/1.jpg";

describe("fotos do catálogo no tamanho certo", () => {
  it("pede a versão redimensionada com 1x/2x", () => {
    const p = catalogImgProps(signed, 320);
    expect(p.src).toBe(`${signed}.w400.webp`);
    expect(p.srcSet).toBe(`${signed}.w400.webp 1x, ${signed}.w1200.webp 2x`);
    expect(p.loading).toBe("lazy");
    expect(p.onError).toBeTypeOf("function");
  });

  it("primeiras fotos carregam já", () => {
    expect(catalogImgProps(signed, 320, { eager: true })).toMatchObject({
      loading: "eager",
      fetchPriority: "high",
    });
  });

  it("URL que não é do storage fica como está", () => {
    const p = catalogImgProps("https://cdn.exemplo.com/a.jpg", 320);
    expect(p.src).toBe("https://cdn.exemplo.com/a.jpg");
    expect(p.srcSet).toBeUndefined();
  });

  it("se a versão leve não existir, volta para a original", async () => {
    const { withoutImageTransform } = await import("@/features/products/services/product-images.service");
    expect(withoutImageTransform(`${signed}.w400.webp`)).toBe(signed);
  });
});
