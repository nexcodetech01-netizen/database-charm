import { describe, expect, it } from "vitest";
import { catalogImgProps } from "../catalog-image";

const signed =
  "https://x.supabase.co/storage/v1/object/sign/product-images/c/p/1.jpg?token=abc";

describe("fotos do catálogo no tamanho certo", () => {
  it("pede a versão redimensionada com 1x/2x", () => {
    const p = catalogImgProps(signed, 320);
    expect(p.src).toContain("/render/image/sign/");
    expect(p.src).toContain("width=320");
    expect(p.srcSet).toContain("width=640");
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
});
