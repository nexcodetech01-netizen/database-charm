import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartTotal,
  formatAddedMessage,
  formatCartMessage,
  hasAddIntent,
  matchProduct,
  parseCartCommand,
  parseQuantity,
  removeFromCart,
} from "../cart";
import { handleCatalogTurn } from "../catalog-nav.server";
import type { ProductSearchItem } from "../product-search";

const products: ProductSearchItem[] = [
  { id: "p1", name: "Bolsa Helena", price: 189.9, brand: null, categoryId: "cat-bolsa", unit: null },
  { id: "p2", name: "Bolsa Marina", price: 249.9, brand: null, categoryId: "cat-bolsa", unit: null },
  { id: "p3", name: "Perfume Floral 100ml", price: 119.9, brand: "Dior", categoryId: "cat-perfume", unit: null },
];

describe("cart — parser", () => {
  it("identifica o produto pelo nome completo", () => {
    expect(matchProduct("Quero a Bolsa Helena.", products)?.id).toBe("p1");
  });

  it("não adivinha quando há empate entre produtos", () => {
    expect(matchProduct("quero uma bolsa", products)).toBeNull();
  });

  it("lê quantidade explícita", () => {
    expect(parseQuantity("quero 2 Bolsa Helena")).toBe(2);
    expect(parseQuantity("quero duas bolsas")).toBe(2);
    expect(parseQuantity("quero a Bolsa Helena")).toBe(1);
  });

  it("reconhece intenção de adicionar", () => {
    expect(hasAddIntent("Quero a Bolsa Helena")).toBe(true);
    expect(hasAddIntent("bom dia")).toBe(false);
  });

  it("reconhece comandos do pedido", () => {
    expect(parseCartCommand("ver pedido")).toEqual({ kind: "view" });
    expect(parseCartCommand("limpar pedido")).toEqual({ kind: "clear" });
    expect(parseCartCommand("remover bolsa helena")).toEqual({
      kind: "remove",
      text: "bolsa helena",
    });
    expect(parseCartCommand("oi tudo bem")).toBeNull();
  });
});

describe("cart — estado puro", () => {
  it("adiciona, soma quantidade e calcula total", () => {
    let cart = addToCart([], products[0]!, 1);
    cart = addToCart(cart, products[0]!, 2);
    expect(cart).toHaveLength(1);
    expect(cart[0]!.qty).toBe(3);
    expect(cartTotal(cart)).toBeCloseTo(569.7, 2);
  });

  it("remove item pelo nome", () => {
    const cart = addToCart(addToCart([], products[0]!), products[1]!);
    const { cart: next, removed } = removeFromCart(cart, "bolsa helena");
    expect(removed?.productId).toBe("p1");
    expect(next.map((l) => l.productId)).toEqual(["p2"]);
  });

  it("formata a mensagem de confirmação", () => {
    const msg = formatAddedMessage(addToCart([], products[0]!));
    expect(msg).toContain("Perfeito!");
    expect(msg).toContain("Adicionei ao seu pedido.");
    expect(msg).toContain("Bolsa Helena — R$ 189,90");
    expect(msg).toContain("Total: R$ 189,90");
    expect(msg).toContain("Você deseja ver mais algum produto?");
  });

  it("informa pedido vazio", () => {
    expect(formatCartMessage([])).toContain("vazio");
  });
});

// --- Integração com o turno de catálogo (db mockado, somente leitura) ---

function makeDb() {
  return {
    from(table: string) {
      const rows =
        table === "products"
          ? products.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              brand: p.brand,
              category_id: p.categoryId,
              unit: null,
              status: "active",
            }))
          : [
              { id: "cat-bolsa", name: "Bolsas", icon: null, status: "active" },
              { id: "cat-perfume", name: "Perfumes", icon: null, status: "active" },
            ];
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        not: () => builder,
        order: () => Promise.resolve({ data: rows }),
        then: (r: any) => Promise.resolve({ data: rows }).then(r),
      };
      return builder;
    },
  };
}

describe("cart — turno conversacional", () => {
  it("adiciona o produto pedido e responde com o pedido atual", async () => {
    const result = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "Quero a Bolsa Helena.",
      state: null,
    });
    expect(result).not.toBeNull();
    expect(result!.text).toContain("Bolsa Helena — R$ 189,90");
    expect(result!.text).toContain("Total: R$ 189,90");
    expect(result!.state?.cart).toEqual([
      { productId: "p1", name: "Bolsa Helena", price: 189.9, qty: 1 },
    ]);
  });

  it("acumula itens no mesmo pedido", async () => {
    const first = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "Quero a Bolsa Helena.",
      state: null,
    });
    const second = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "Perfume Floral 100ml",
      state: first!.state,
    });
    expect(second!.state?.cart?.map((l) => l.productId)).toEqual(["p1", "p3"]);
    expect(second!.text).toContain("Total: R$ 309,80");
  });

  it("mostra e limpa o pedido", async () => {
    const added = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "Quero a Bolsa Helena.",
      state: null,
    });
    const view = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "ver pedido",
      state: added!.state,
    });
    expect(view!.text).toContain("Bolsa Helena");

    const cleared = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "limpar pedido",
      state: view!.state,
    });
    expect(cleared!.state?.cart).toEqual([]);
  });

  it("preserva o pedido ao voltar para as categorias", async () => {
    const added = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "Quero a Bolsa Helena.",
      state: null,
    });
    const back = await handleCatalogTurn({
      db: makeDb(),
      companyId: "c1",
      text: "voltar",
      state: added!.state,
    });
    expect(back!.state?.cart?.map((l) => l.productId)).toEqual(["p1"]);
  });
});
