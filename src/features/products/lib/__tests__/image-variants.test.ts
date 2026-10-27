import { describe, expect, it } from "vitest";
import { isVariantPath, pickVariant, variantPath } from "../image-variants";
import { withImageTransform, withoutImageTransform } from "../../services/product-images.service";

const pub = "https://x.supabase.co/storage/v1/object/public/product-images/c/p/1.jpg";

describe("fotos leves", () => {
  it("escolhe 400 para listas e 1200 para a página do produto", () => {
    expect(pickVariant(80)).toBe(400);
    expect(pickVariant(400)).toBe(400);
    expect(pickVariant(800)).toBe(1200);
    expect(pickVariant(2000)).toBeNull();
  });

  it("monta e reconhece o caminho da versão leve", () => {
    expect(variantPath("c/p/1.jpg", 400)).toBe("c/p/1.jpg.w400.webp");
    expect(isVariantPath("c/p/1.jpg.w400.webp")).toBe(true);
    expect(isVariantPath("c/p/1.jpg")).toBe(false);
  });

  it("URL pública vai para a versão leve e volta para a original", () => {
    const thumb = withImageTransform(pub, 160);
    expect(thumb).toBe(`${pub}.w400.webp`);
    expect(withImageTransform(thumb, 160)).toBe(thumb);
    expect(withoutImageTransform(thumb)).toBe(pub);
    expect(withImageTransform("https://outro.com/a.jpg", 160)).toBe("https://outro.com/a.jpg");
  });
});
