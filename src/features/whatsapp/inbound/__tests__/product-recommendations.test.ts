import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RECOMMENDATIONS,
  NO_RECOMMENDATIONS_MESSAGE,
  RECOMMENDATIONS_FOOTER,
  formatRecommendationCaption,
  formatRecommendationsMessage,
  isAlternativeRequestIntent,
  parsePriceDirection,
  rankRecommendations,
  type RecommendationItem,
} from "../product-recommendations";
import { handleRecommendationTurn } from "../product-recommendations.server";
import { resetCartSessions } from "../cart-session.server";

function item(
  id: string,
  over: Partial<RecommendationItem> = {},
): RecommendationItem {
  return {
    id,
    name: `Produto ${id}`,
    price: 100,
    brand: null,
    categoryId: "c1",
    unit: "un",
    coverImagePath: `${id}.jpg`,
    ...over,
  };
}

function dbWith(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: () => ({ order: async () => ({ data: rows }) }),
          }),
        }),
      }),
    }),
  };
}

const storage = {
  from: () => ({
    createSignedUrls: async (paths: string[]) => ({
      data: paths.map((p) => ({ path: p, signedUrl: `https://cdn.test/${p}` })),
    }),
  }),
};

const state = { step: "products" as const, lastProductIds: ["p1"] };

describe("product-recommendations — intenção", () => {
  it.each([
    "não gostei",
    "tem outro?",
    "tem outra opção?",
    "mostra outro",
    "quero outro modelo",
    "tem outro parecido?",
    "tem um mais barato?",
    "tem um mais caro?",
    "quero outro",
  ])("reconhece '%s'", (t) => {
    expect(isAlternativeRequestIntent(t)).toBe(true);
  });

  it("ignora mensagens não relacionadas", () => {
    expect(isAlternativeRequestIntent("qual o preço?")).toBe(false);
    expect(isAlternativeRequestIntent("")).toBe(false);
  });

  it("extrai a direção de preço", () => {
    expect(parsePriceDirection("tem um mais barato?")).toBe("cheaper");
    expect(parsePriceDirection("tem um mais caro?")).toBe("pricier");
    expect(parsePriceDirection("tem outro?")).toBeNull();
  });
});

describe("product-recommendations — ranking", () => {
  const current = item("p1", { price: 100, brand: "Acme", categoryId: "c1" });

  it("prioriza a mesma categoria", () => {
    const out = rankRecommendations({
      current,
      candidates: [
        current,
        item("p2", { categoryId: "c2", price: 100 }),
        item("p3", { categoryId: "c1", price: 100 }),
      ],
    });
    expect(out[0]!.id).toBe("p3");
  });

  it("prioriza a mesma marca dentro da categoria", () => {
    const out = rankRecommendations({
      current,
      candidates: [
        current,
        item("p2", { categoryId: "c1", brand: "Outra", price: 100 }),
        item("p3", { categoryId: "c1", brand: "Acme", price: 100 }),
      ],
    });
    expect(out[0]!.id).toBe("p3");
  });

  it("prioriza faixa de preço semelhante", () => {
    const out = rankRecommendations({
      current,
      candidates: [
        current,
        item("p2", { price: 900 }),
        item("p3", { price: 110 }),
      ],
    });
    expect(out[0]!.id).toBe("p3");
  });

  it("retorna apenas produtos mais baratos", () => {
    const out = rankRecommendations({
      current,
      candidates: [current, item("p2", { price: 80 }), item("p3", { price: 150 })],
      direction: "cheaper",
    });
    expect(out.map((p) => p.id)).toEqual(["p2"]);
  });

  it("retorna apenas produtos mais caros", () => {
    const out = rankRecommendations({
      current,
      candidates: [current, item("p2", { price: 80 }), item("p3", { price: 150 })],
      direction: "pricier",
    });
    expect(out.map((p) => p.id)).toEqual(["p3"]);
  });

  it("exclui o produto atual", () => {
    const out = rankRecommendations({ current, candidates: [current] });
    expect(out).toHaveLength(0);
  });

  it("limita a 5 produtos", () => {
    const candidates = [current, ...Array.from({ length: 12 }, (_, i) => item(`x${i}`))];
    const out = rankRecommendations({ current, candidates });
    expect(out).toHaveLength(MAX_RECOMMENDATIONS);
  });
});

describe("product-recommendations — mensagens", () => {
  it("formata a lista com nome, preço e rodapé", () => {
    const text = formatRecommendationsMessage([item("p2", { name: "Bolsa", price: 199.9 })]);
    expect(text).toContain("Bolsa");
    expect(text).toContain("R$");
    expect(text).toContain(RECOMMENDATIONS_FOOTER);
  });

  it("usa a mensagem padrão quando não há resultados", () => {
    expect(formatRecommendationsMessage([])).toBe(NO_RECOMMENDATIONS_MESSAGE);
  });

  it("formata a legenda da foto principal", () => {
    expect(formatRecommendationCaption(item("p2", { name: "Bolsa", price: 50 }))).toContain(
      "Bolsa",
    );
  });
});

describe("product-recommendations — turno", () => {
  beforeEach(() => resetCartSessions());

  const rows = [
    { id: "p1", name: "Atual", price: 100, brand: "Acme", category_id: "c1", unit: "un", cover_image_path: "p1.jpg" },
    { id: "p2", name: "Similar", price: 110, brand: "Acme", category_id: "c1", unit: "un", cover_image_path: "p2.jpg" },
  ];

  it("responde com recomendações e fotos principais", async () => {
    const out = await handleRecommendationTurn({
      db: dbWith(rows) as never,
      storage: storage as never,
      companyId: "co",
      phone: "5511999999999",
      text: "não gostei, tem outro?",
      state,
    });
    expect(out).not.toBeNull();
    expect(out!.products.map((p) => p.id)).toEqual(["p2"]);
    expect(out!.media[0]!.imageUrl).toBe("https://cdn.test/p2.jpg");
    expect(out!.text).toContain(RECOMMENDATIONS_FOOTER);
  });

  it("responde a mensagem padrão quando não há semelhantes", async () => {
    const out = await handleRecommendationTurn({
      db: dbWith([rows[0]]) as never,
      storage: storage as never,
      companyId: "co",
      phone: "5511999999999",
      text: "tem outro?",
      state,
    });
    expect(out!.text).toBe(NO_RECOMMENDATIONS_MESSAGE);
    expect(out!.media).toHaveLength(0);
  });

  it("ignora quando não há produto em contexto (contexto expirado)", async () => {
    const out = await handleRecommendationTurn({
      db: dbWith(rows) as never,
      storage: storage as never,
      companyId: "co",
      phone: "5511999999999",
      text: "tem outro?",
      state: null,
    });
    expect(out).toBeNull();
  });

  it("ignora mensagens que não pedem alternativa", async () => {
    const out = await handleRecommendationTurn({
      db: dbWith(rows) as never,
      storage: storage as never,
      companyId: "co",
      phone: "5511999999999",
      text: "qual o preço?",
      state,
    });
    expect(out).toBeNull();
  });
});
