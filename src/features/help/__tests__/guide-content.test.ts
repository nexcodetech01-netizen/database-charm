import { describe, expect, it } from "vitest";
import { GUIDE_SECTIONS, filterGuide } from "../guide-content";

describe("guia de uso", () => {
  it("tem ids únicos", () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("busca ignora acento e maiúscula", () => {
    expect(filterGuide(GUIDE_SECTIONS, "CREDIARIO").map((s) => s.id)).toContain("crediario");
    expect(filterGuide(GUIDE_SECTIONS, "etiqueta compra").map((s) => s.id)).toContain("etiquetas");
  });
  it("busca vazia mostra tudo", () => {
    expect(filterGuide(GUIDE_SECTIONS, "  ").length).toBe(GUIDE_SECTIONS.length);
  });
});
