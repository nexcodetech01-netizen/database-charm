import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const LIST = "src/routes/_authenticated/produtos.tsx";
const DETAIL = "src/routes/_authenticated/produtos_.$productId.index.tsx";
const NEW = "src/routes/_authenticated/produtos_.novo.tsx";
const EDIT = "src/routes/_authenticated/produtos_.$productId.editar.tsx";
const FILTERS = "src/features/products/components/product-filters.tsx";

const RAW_COLORS = /\b(?:bg|text|border)-(?:emerald|green|red|rose|amber|yellow)-\d{3}\b/;

describe("UI.3.1 — Produtos Premium", () => {
  it("lista usa EntityHeader e ActionToolbar", () => {
    const src = read(LIST);
    expect(src).toContain("EntityHeader");
    expect(src).toContain("ActionToolbar");
    expect(src).not.toContain("<PageLayout");
  });

  it("filtros usam Panel do design system", () => {
    const src = read(FILTERS);
    expect(src).toContain('from "@/components/design"');
    expect(src).toContain("<Panel");
  });

  it("detalhe usa Section e LoadingSurface", () => {
    const src = read(DETAIL);
    expect(src).toContain("<Section");
    expect(src).toContain("LoadingSurface");
    expect(src).not.toContain("<PageLayout");
    expect(src).not.toContain("<CardContent");
  });

  it("cadastro e edição usam FormLayout e EntityHeader", () => {
    for (const p of [NEW, EDIT]) {
      const src = read(p);
      expect(src).toContain("FormLayout");
      expect(src).toContain("EntityHeader");
    }
  });

  it("nenhuma cor crua nas telas migradas", () => {
    for (const p of [LIST, NEW, EDIT, FILTERS]) {
      expect(RAW_COLORS.test(read(p))).toBe(false);
    }
  });
});
