import { describe, expect, it } from "vitest";
import {
  collectBrands,
  handleProductSearchTurn,
  listActiveProducts,
} from "../product-search.server";
import {
  describeFilters,
  formatSearchResultsMessage,
  hasSearchableFilters,
  matchBrand,
  matchCategoryByStem,
  parsePriceRange,
  parseProductQuery,
  rankProducts,
  scoreProduct,
  stem,
  type ProductSearchItem,
} from "../product-search";

const categories = [
  { id: "cat-bolsa", name: "Bolsas", icon: "ShoppingBag", productCount: 3 },
  { id: "cat-perfume", name: "Perfumes", icon: "Star", productCount: 2 },
  { id: "cat-carteira", name: "Carteiras", icon: "Tag", productCount: 1 },
];

const brands = ["Chanel", "Dior"];

const products: ProductSearchItem[] = [
  { id: "p1", name: "Bolsa Preta Couro", price: 350, brand: "Chanel", categoryId: "cat-bolsa", unit: "un" },
  { id: "p2", name: "Bolsa Bege Lona", price: 180, brand: null, categoryId: "cat-bolsa", unit: "un" },
  { id: "p3", name: "Perfume Floral 100ml", price: 110, brand: "Dior", categoryId: "cat-perfume", unit: "un" },
  { id: "p4", name: "Perfume Amadeirado", price: 240, brand: "Dior", categoryId: "cat-perfume", unit: "un" },
  { id: "p5", name: "Carteira Slim", price: 90, brand: null, categoryId: "cat-carteira", unit: "un" },
];

function parse(text: string) {
  return parseProductQuery(text, { categories, brands });
}

describe("product-search — parser (frases do escopo)", () => {
  it('"quero uma bolsa" → categoria=bolsa', () => {
    const f = parse("quero uma bolsa");
    expect(f.categoryId).toBe("cat-bolsa");
    expect(f.text).toBeNull();
    expect(f.priceMax).toBeNull();
    expect(f.priceMin).toBeNull();
  });

  it('"bolsa preta" → categoria=bolsa, texto=preta', () => {
    const f = parse("bolsa preta");
    expect(f.categoryId).toBe("cat-bolsa");
    expect(f.text).toBe("preta");
  });

  it('"perfume até 120" → categoria=perfume, precoMax=120', () => {
    const f = parse("perfume até 120");
    expect(f.categoryId).toBe("cat-perfume");
    expect(f.priceMax).toBe(120);
    expect(f.text).toBeNull();
  });

  it('"carteira" → categoria=carteira', () => {
    const f = parse("carteira");
    expect(f.categoryId).toBe("cat-carteira");
    expect(f.categoryName).toBe("Carteiras");
  });
});

describe("product-search — parser (demais casos)", () => {
  it("reconhece preço máximo em várias formas", () => {
    expect(parsePriceRange("menos de 150").max).toBe(150);
    expect(parsePriceRange("ate R$ 1.200,50").max).toBe(1200.5);
    expect(parsePriceRange("no maximo 80").max).toBe(80);
    expect(parsePriceRange("abaixo de 99").max).toBe(99);
  });

  it("reconhece preço mínimo", () => {
    expect(parsePriceRange("acima de 300").min).toBe(300);
    expect(parsePriceRange("a partir de 50").min).toBe(50);
    expect(parsePriceRange("mais de 1.000").min).toBe(1000);
  });

  it("reconhece faixa combinada", () => {
    const f = parse("bolsa acima de 100 ate 400");
    expect(f.priceMin).toBe(100);
    expect(f.priceMax).toBe(400);
    expect(f.categoryId).toBe("cat-bolsa");
  });

  it("reconhece marca cadastrada e a remove do texto livre", () => {
    const f = parse("perfume Dior amadeirado");
    expect(f.brand).toBe("Dior");
    expect(f.categoryId).toBe("cat-perfume");
    expect(f.text).toBe("amadeirado");
  });

  it("não inventa marca inexistente", () => {
    expect(matchBrand("perfume xyz", brands)).toBeNull();
    expect(parse("bolsa xyz").brand).toBeNull();
  });

  it("casa categoria no singular e no plural", () => {
    expect(matchCategoryByStem("bolsas", categories)?.id).toBe("cat-bolsa");
    expect(matchCategoryByStem("perfume", categories)?.id).toBe("cat-perfume");
    expect(matchCategoryByStem("bom dia", categories)).toBeNull();
    expect(stem("bolsas")).toBe("bolsa");
  });

  it("ignora saudações e stopwords no texto livre", () => {
    const f = parse("oi, gostaria de ver uma bolsa por favor");
    expect(f.categoryId).toBe("cat-bolsa");
    expect(f.text).toBe("favor");
  });

  it("mensagem sem filtros não é pesquisável", () => {
    const f = parse("bom dia");
    expect(hasSearchableFilters(f)).toBe(false);
    expect(hasSearchableFilters(parse("carteira"))).toBe(true);
  });
});

describe("product-search — relevância", () => {
  it("prioriza categoria, marca e texto", () => {
    const f = parse("bolsa preta");
    expect(scoreProduct(products[0]!, f)).toBeGreaterThan(scoreProduct(products[1]!, f));
    const ranked = rankProducts(products, f);
    expect(ranked[0]?.id).toBe("p1");
  });

  it("aplica o teto de preço", () => {
    const ranked = rankProducts(products, parse("perfume até 120"));
    expect(ranked.map((p) => p.id)).toEqual(["p3"]);
  });

  it("aplica o piso de preço", () => {
    const ranked = rankProducts(products, parse("bolsa acima de 300"));
    expect(ranked.map((p) => p.id)).toEqual(["p1"]);
  });

  it("respeita o limite de resultados", () => {
    expect(rankProducts(products, parse("carteira"), 1)).toHaveLength(1);
  });

  it("descreve e formata a resposta", () => {
    const f = parse("perfume até 120");
    expect(describeFilters(f)).toContain("Perfumes");
    const msg = formatSearchResultsMessage(f, rankProducts(products, f));
    expect(msg).toContain("Perfume Floral 100ml");
    expect(msg).toContain("voltar");
    expect(formatSearchResultsMessage(f, [])).toContain("Não encontrei");
  });
});

/** Client fake do Supabase — apenas leitura de produtos ativos. */
function makeDb(rows = products, capture: Record<string, unknown> = {}) {
  const query: any = {
    select: () => query,
    eq: (col: string, value: unknown) => {
      capture[col] = value;
      return query;
    },
    order: () => Promise.resolve({ data: rows.map((p) => ({ ...p, category_id: p.categoryId })) }),
  };
  return { from: (t: string) => ((capture.table = t), query) };
}

describe("product-search — consulta (somente produtos ativos)", () => {
  it("filtra por company e status active", async () => {
    const capture: Record<string, unknown> = {};
    const list = await listActiveProducts(makeDb(products, capture) as any, "c1");
    expect(capture.table).toBe("products");
    expect(capture.company_id).toBe("c1");
    expect(capture.status).toBe("active");
    expect(list).toHaveLength(products.length);
  });

  it("coleta marcas distintas", () => {
    expect(collectBrands(products).sort()).toEqual(["Chanel", "Dior"]);
  });

  it("responde a uma busca ancorada em categoria", async () => {
    const result = await handleProductSearchTurn({
      db: makeDb() as any,
      companyId: "c1",
      text: "perfume até 120",
      categories,
    });
    expect(result).not.toBeNull();
    expect(result!.filters.priceMax).toBe(120);
    expect(result!.products.map((p) => p.id)).toEqual(["p3"]);
    expect(result!.state?.categoryId).toBe("cat-perfume");
  });

  it("ignora mensagens sem categoria/marca fora do catálogo", async () => {
    const result = await handleProductSearchTurn({
      db: makeDb() as any,
      companyId: "c1",
      text: "bom dia",
      categories,
    });
    expect(result).toBeNull();
  });

  it("dentro do catálogo aceita filtro só de preço", async () => {
    const result = await handleProductSearchTurn({
      db: makeDb() as any,
      companyId: "c1",
      text: "até 100",
      categories,
      inCatalog: true,
    });
    expect(result).not.toBeNull();
    expect(result!.products.every((p) => p.price <= 100)).toBe(true);
  });

  it("responde sem resultados quando a categoria existe mas nada casa", async () => {
    const result = await handleProductSearchTurn({
      db: makeDb() as any,
      companyId: "c1",
      text: "carteira acima de 5000",
      categories,
    });
    expect(result!.products).toHaveLength(0);
    expect(result!.text).toContain("Não encontrei");
  });
});
