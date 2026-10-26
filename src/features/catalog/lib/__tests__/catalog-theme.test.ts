import { describe, expect, it } from "vitest";
import { loadCatalogTheme } from "../catalog-theme";

const client = (result: { data: unknown; error: unknown }) => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }),
});

describe("loadCatalogTheme", () => {
  it("devolve o tema escuro quando a loja escolheu", async () => {
    expect(await loadCatalogTheme(client({ data: { catalog_theme: "dark" }, error: null }), "c")).toBe("dark");
  });
  it("cai no claro se a coluna ainda não existe", async () => {
    expect(
      await loadCatalogTheme(client({ data: null, error: { message: "column catalog_theme does not exist" } }), "c"),
    ).toBe("light");
  });
});
