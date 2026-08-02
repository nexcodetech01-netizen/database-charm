import { describe, expect, it } from "vitest";
import {
  areCategoryNamesEquivalent,
  categoryNameKey,
  findEquivalentCategory,
  groupDuplicateCategories,
} from "../category-name-key";
import { resolveMergePlan } from "../merge-plan";

describe("categoryNameKey", () => {
  it("normaliza singular/plural", () => {
    expect(categoryNameKey("Bolsa")).toBe(categoryNameKey("Bolsas"));
    expect(categoryNameKey("Carteira")).toBe(categoryNameKey("Carteiras"));
  });
  it("ignora maiúsculas/minúsculas", () => {
    expect(categoryNameKey("BOLSA")).toBe(categoryNameKey("bolsa"));
  });
  it("ignora acentos", () => {
    expect(categoryNameKey("Bólsa")).toBe(categoryNameKey("Bolsa"));
    expect(categoryNameKey("Cosméticos")).toBe(categoryNameKey("cosmeticos"));
  });
  it("ignora espaços extras e pontuação", () => {
    expect(categoryNameKey("  Bolsa   ")).toBe("bolsa");
    expect(categoryNameKey("Bolsa - Social")).toBe(categoryNameKey("bolsa social"));
  });
  it("não confunde categorias diferentes", () => {
    expect(areCategoryNamesEquivalent("Bolsa", "Mochila")).toBe(false);
    expect(areCategoryNamesEquivalent("Bolsa", "Bolsa Social")).toBe(false);
  });
  it("nome vazio nunca é equivalente", () => {
    expect(areCategoryNamesEquivalent("", "")).toBe(false);
  });
});

describe("findEquivalentCategory", () => {
  const cats = [
    { id: "1", name: "Bolsas" },
    { id: "2", name: "Carteira" },
  ];
  it("encontra equivalente por plural", () => {
    expect(findEquivalentCategory(cats, "bolsa")?.id).toBe("1");
  });
  it("permite renomear a própria categoria", () => {
    expect(findEquivalentCategory(cats, "Carteiras", "2")).toBeNull();
  });
  it("retorna null quando não há equivalente", () => {
    expect(findEquivalentCategory(cats, "Relógios")).toBeNull();
  });
});

describe("groupDuplicateCategories", () => {
  it("agrupa apenas duplicadas", () => {
    const groups = groupDuplicateCategories([
      { id: "1", name: "Bolsa" },
      { id: "2", name: "Bolsas" },
      { id: "3", name: "Mochila" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.categories.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });
  it("categorias sem produtos também são consideradas", () => {
    const groups = groupDuplicateCategories([
      { id: "1", name: "Carteira", product_count: 0 },
      { id: "2", name: "Carteiras", product_count: 0 },
    ]);
    expect(groups).toHaveLength(1);
  });
});

describe("resolveMergePlan", () => {
  const base = { min_margin_pct: 25, target_margin_pct: 50, max_margin_pct: 65 };
  it("sugere a categoria com mais produtos como destino", () => {
    const plan = resolveMergePlan([
      { id: "1", name: "Bolsa", product_count: 4, ...base },
      { id: "2", name: "Bolsas", product_count: 26, ...base },
    ]);
    expect(plan.targetId).toBe("2");
    expect(plan.sources.map((s) => s.id)).toEqual(["1"]);
    expect(plan.policyConflict).toBe(false);
    expect(plan.productsToMove).toBe(4);
  });
  it("sinaliza conflito quando as políticas divergem", () => {
    const plan = resolveMergePlan([
      { id: "1", name: "Carteira", product_count: 7, ...base },
      { id: "2", name: "Carteiras", product_count: 3, ...base, target_margin_pct: 60 },
    ]);
    expect(plan.policyConflict).toBe(true);
    expect(plan.targetId).toBe("1");
  });
  it("preserva a política do destino escolhido", () => {
    const plan = resolveMergePlan(
      [
        { id: "1", name: "Bolsa", product_count: 4, ...base },
        { id: "2", name: "Bolsas", product_count: 26, ...base, target_margin_pct: 55 },
      ],
      "1",
    );
    expect(plan.target?.target_margin_pct).toBe(50);
  });
});
