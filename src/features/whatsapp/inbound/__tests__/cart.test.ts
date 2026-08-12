import { beforeEach, describe, expect, it } from "vitest";
import {
  CART_SESSION_TTL_MS,
  addProduct,
  clearCartSession,
  createCartSession,
  isCartSessionExpired,
  removeAt,
  removeProductById,
  cartItemCount,
} from "../cart-session";
import {
  formatCartMessage,
  formatCartUpdatedMessage,
  hasAddIntent,
  isAnaphoricAdd,
  matchProduct,
  parseCartCommand,
  parseOrdinal,
  parseQuantity,
} from "../cart";
import { getCartSession, resetCartSessions, saveCartSession } from "../cart-session.server";
import { handleCatalogTurn } from "../catalog-nav.server";
import type { ProductSearchItem } from "../product-search";

const products: ProductSearchItem[] = [
  { id: "p1", name: "Bolsa Helena", price: 189.9, brand: null, categoryId: "cat-bolsa", unit: null },
  { id: "p2", name: "Bolsa Marina", price: 249.9, brand: null, categoryId: "cat-bolsa", unit: null },
  { id: "p3", name: "Perfume Floral 100ml", price: 119.9, brand: "Dior", categoryId: "cat-perfume", unit: null },
];

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
        gt: () => builder,
        in: () => builder,
        not: () => builder,
        order: () => Promise.resolve({ data: rows }),
        then: (r: any) => Promise.resolve({ data: rows }).then(r),
      };
      return builder;
    },
  };
}

beforeEach(() => resetCartSessions());

// ------------------------------------------------------------------ parsing

describe("carrinho — interpretação de frases", () => {
  it("reconhece intenções de adicionar", () => {
    for (const t of ["Quero essa", "Pode adicionar", "Levo essa", "Quero duas"]) {
      expect(hasAddIntent(t)).toBe(true);
    }
    expect(hasAddIntent("bom dia")).toBe(false);
  });

  it("reconhece referência ao último produto mostrado", () => {
    expect(isAnaphoricAdd("Quero essa")).toBe(true);
    expect(isAnaphoricAdd("Pode adicionar")).toBe(true);
    expect(isAnaphoricAdd("Quero a Bolsa Helena")).toBe(false);
  });

  it("lê quantidade", () => {
    expect(parseQuantity("Quero duas")).toBe(2);
    expect(parseQuantity("quero 3 bolsas")).toBe(3);
    expect(parseQuantity("Quero essa")).toBe(1);
  });

  it("lê comandos de remover, mostrar e limpar", () => {
    expect(parseCartCommand("Tira essa")).toEqual({ kind: "remove", text: "essa", ordinal: null });
    expect(parseCartCommand("Remover a segunda")).toEqual({
      kind: "remove",
      text: null,
      ordinal: 2,
    });
    expect(parseCartCommand("Mostrar meu pedido")).toEqual({ kind: "view" });
    expect(parseCartCommand("Limpar pedido")).toEqual({ kind: "clear" });
    expect(parseCartCommand("bom dia")).toBeNull();
    expect(parseOrdinal("remover a terceira")).toBe(3);
  });

  it("casa o produto pelo nome e não adivinha em empate", () => {
    expect(matchProduct("Quero a Bolsa Helena", products)?.id).toBe("p1");
    expect(matchProduct("quero uma bolsa", products)).toBeNull();
  });
});

// ------------------------------------------------------- sessão pura (estado)

describe("carrinho — sessão temporária", () => {
  it("guarda empresa, telefone, preço do momento, subtotal, total e timestamp", () => {
    const s = addProduct(createCartSession("c1", "5511999", 1000), products[0]!, 1, 1000);
    expect(s.companyId).toBe("c1");
    expect(s.phone).toBe("5511999");
    expect(s.items[0]).toEqual({
      productId: "p1",
      name: "Bolsa Helena",
      qty: 1,
      unitPrice: 189.9,
      subtotal: 189.9,
    });
    expect(s.total).toBe(189.9);
    expect(s.createdAt).toBe(1000);
    expect(s.updatedAt).toBe(1000);
  });

  it("soma quantidade do mesmo produto e recalcula o total", () => {
    let s = addProduct(createCartSession("c1", "p", 0), products[0]!, 1, 0);
    s = addProduct(s, products[0]!, 2, 10);
    expect(s.items[0]!.qty).toBe(3);
    expect(s.items[0]!.subtotal).toBe(569.7);
    expect(s.total).toBe(569.7);
    expect(cartItemCount(s)).toBe(3);
  });

  it("calcula o total com múltiplos itens", () => {
    let s = addProduct(createCartSession("c1", "p", 0), products[0]!);
    s = addProduct(s, products[2]!, 2);
    expect(s.total).toBe(429.7);
  });

  it("remove por posição e por produto, atualizando o total", () => {
    let s = addProduct(createCartSession("c1", "p", 0), products[0]!);
    s = addProduct(s, products[2]!);
    const byIndex = removeAt(s, 1);
    expect(byIndex.removed?.productId).toBe("p3");
    expect(byIndex.session.total).toBe(189.9);
    const byId = removeProductById(s, "p1");
    expect(byId.session.items.map((i) => i.productId)).toEqual(["p3"]);
    expect(removeAt(s, 9).removed).toBeNull();
  });

  it("limpa o carrinho zerando o total", () => {
    const s = clearCartSession(addProduct(createCartSession("c1", "p", 0), products[0]!));
    expect(s.items).toEqual([]);
    expect(s.total).toBe(0);
  });

  it("expira o contexto após o TTL", () => {
    const s = addProduct(createCartSession("c1", "p", 0), products[0]!, 1, 0);
    expect(isCartSessionExpired(s, CART_SESSION_TTL_MS - 1)).toBe(false);
    expect(isCartSessionExpired(s, CART_SESSION_TTL_MS + 1)).toBe(true);
    expect(isCartSessionExpired(null)).toBe(true);
  });

  it("descarta a sessão expirada no store e devolve carrinho vazio", () => {
    saveCartSession(addProduct(createCartSession("c1", "5511", 0), products[0]!, 1, 0));
    const revived = getCartSession("c1", "5511", CART_SESSION_TTL_MS + 5000);
    expect(revived.items).toEqual([]);
    expect(revived.total).toBe(0);
  });
});

// ------------------------------------------------------------- formatação

describe("carrinho — mensagens", () => {
  it("formata o pedido atualizado no padrão da Bella", () => {
    const msg = formatCartUpdatedMessage(
      addProduct(createCartSession("c1", "p", 0), products[0]!),
    );
    expect(msg).toContain("🛍️ *Pedido atualizado!*");
    expect(msg).toContain("• *Bolsa Helena*");
    expect(msg).toContain("(x1)");
    expect(msg).toContain("R$ 189,90");
    expect(msg).toContain("*Total:");
    expect(msg).toContain("Gostaria de adicionar algo mais ou prefere finalizar o seu pedido agora?");
  });

  it("mostra o resumo completo com mais de um item", () => {
    let s = addProduct(createCartSession("c1", "p", 0), products[0]!);
    s = addProduct(s, products[2]!, 2);
    const msg = formatCartMessage(s);
    expect(msg).toContain("• *Bolsa Helena*");
    expect(msg).toContain("• *Perfume Floral 100ml*");
    expect(msg).toContain("(x2)");
    expect(msg).toContain("R$ 429,70");
  });

  it("informa carrinho vazio", () => {
    expect(formatCartMessage(createCartSession("c1", "p", 0))).toContain("vazio");
  });
});

// --------------------------------------------------- turno conversacional

describe("carrinho — turno conversacional", () => {
  const base = { db: makeDb(), companyId: "c1", phone: "5511999" };

  it("adiciona produto citado pelo nome", async () => {
    const r = await handleCatalogTurn({ ...base, text: "Quero a Bolsa Helena.", state: null });
    expect(r!.text).toContain("🛍️ *Pedido atualizado!*");
    expect(r!.text).toContain("(x1)");
    expect(getCartSession("c1", "5511999").total).toBe(189.9);
  });

  it("adiciona quantidade sobre o item já existente", async () => {
    await handleCatalogTurn({ ...base, text: "Quero a Bolsa Helena.", state: null });
    const r = await handleCatalogTurn({
      ...base,
      text: "Quero duas Bolsa Helena",
      state: { step: "cart" },
    });
    expect(r!.text).toContain("(x3)");
    expect(getCartSession("c1", "5511999").total).toBe(569.7);
  });

  it('entende "Quero essa" após mostrar um único produto', async () => {
    const r = await handleCatalogTurn({
      ...base,
      text: "Quero essa",
      state: { step: "products", lastProductIds: ["p1"] },
    });
    expect(r!.text).toContain("• *Bolsa Helena*");
    expect(getCartSession("c1", "5511999").items).toHaveLength(1);
  });

  it("remove item pela posição citada", async () => {
    await handleCatalogTurn({ ...base, text: "Quero a Bolsa Helena.", state: null });
    await handleCatalogTurn({
      ...base,
      text: "Quero o Perfume Floral 100ml",
      state: { step: "cart" },
    });
    const r = await handleCatalogTurn({
      ...base,
      text: "Remover a segunda",
      state: { step: "cart" },
    });
    expect(r!.text).toContain("Removi *Perfume Floral 100ml*");
    expect(getCartSession("c1", "5511999").total).toBe(189.9);
  });

  it("mostra e limpa o pedido", async () => {
    await handleCatalogTurn({ ...base, text: "Quero a Bolsa Helena.", state: null });
    const view = await handleCatalogTurn({
      ...base,
      text: "Mostrar meu pedido",
      state: { step: "cart" },
    });
    expect(view!.text).toContain("Bolsa Helena");

    const cleared = await handleCatalogTurn({
      ...base,
      text: "Limpar pedido",
      state: { step: "cart" },
    });
    expect(cleared!.text).toContain("Esvaziei o seu pedido");
    expect(getCartSession("c1", "5511999").items).toEqual([]);
  });

  it("isola carrinhos de telefones diferentes", async () => {
    await handleCatalogTurn({ ...base, text: "Quero a Bolsa Helena.", state: null });
    expect(getCartSession("c1", "5522888").items).toEqual([]);
  });
});
