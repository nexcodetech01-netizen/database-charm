import { vi } from "vitest";
import { supabaseAdminMock } from "./session-store.mock";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

/**
 * Sprint 6.7 — Etapa 6: sugestões complementares (upsell).
 * Testes puros + servidor com stubs. Nada é gravado, vendido ou movimentado.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  MAX_UPSELL_SUGGESTIONS,
  formatUpsellMessage,
  isUpsellTriggerIntent,
  rankUpsell,
  resolveUpsellProductId,
  type UpsellItem,
} from "../product-upsell";
import { handleUpsellTurn } from "../product-upsell.server";
import { getCartSession, resetCartSessions, saveCartSession } from "../cart-session.server";
import { addProduct } from "../cart-session";

function p(over: Partial<UpsellItem> & { id: string; name: string }): UpsellItem {
  return {
    price: 100,
    brand: null,
    categoryId: null,
    unit: "un",
    status: "active",
    collectionIds: [],
    relatedProductIds: [],
    ...over,
  } as UpsellItem;
}

const current = p({
  id: "cur",
  name: "Bolsa Elegance",
  price: 200,
  brand: "Elegance",
  categoryId: "bolsas",
  collectionIds: ["verao"],
  relatedProductIds: ["rel"],
});

describe("isUpsellTriggerIntent", () => {
  it.each([
    "Vou levar essa.",
    "Quero essa.",
    "Pode adicionar.",
    "Gostei dessa.",
  ])("reconhece %s", (t) => {
    expect(isUpsellTriggerIntent(t)).toBe(true);
  });

  it("ignora mensagens sem escolha", () => {
    expect(isUpsellTriggerIntent("bom dia")).toBe(false);
    expect(isUpsellTriggerIntent("")).toBe(false);
  });
});

describe("rankUpsell", () => {
  it("prioriza produto relacionado explicitamente", () => {
    const out = rankUpsell({
      current,
      candidates: [p({ id: "outro", name: "Outro", categoryId: "bolsas" }), p({ id: "rel", name: "Relacionado" })],
    });
    expect(out[0]!.id).toBe("rel");
  });

  it("prioriza mesma coleção depois de relacionados", () => {
    const out = rankUpsell({
      current,
      candidates: [
        p({ id: "a", name: "Sem coleção" }),
        p({ id: "b", name: "Mesma coleção", collectionIds: ["verao"] }),
      ],
    });
    expect(out[0]!.id).toBe("b");
  });

  it("prioriza categoria complementar configurada", () => {
    const out = rankUpsell({
      current,
      candidates: [
        p({ id: "a", name: "Aleatório" }),
        p({ id: "c", name: "Carteira", categoryId: "carteiras" }),
      ],
      complementaryCategoryIds: ["carteiras"],
    });
    expect(out[0]!.id).toBe("c");
  });

  it("prioriza mesma marca", () => {
    const out = rankUpsell({
      current,
      candidates: [
        p({ id: "a", name: "Genérico" }),
        p({ id: "m", name: "Mesma marca", brand: "Elegance" }),
      ],
    });
    expect(out[0]!.id).toBe("m");
  });

  it("usa faixa de preço semelhante como desempate", () => {
    const out = rankUpsell({
      current,
      candidates: [
        p({ id: "longe", name: "Longe", price: 900 }),
        p({ id: "perto", name: "Perto", price: 210 }),
      ],
    });
    expect(out[0]!.id).toBe("perto");
  });

  it("nunca sugere o próprio produto", () => {
    const out = rankUpsell({ current, candidates: [current, p({ id: "x", name: "X" })] });
    expect(out.map((i) => i.id)).toEqual(["x"]);
  });

  it("nunca sugere itens já no carrinho", () => {
    const out = rankUpsell({
      current,
      candidates: [p({ id: "in-cart", name: "No carrinho" }), p({ id: "novo", name: "Novo" })],
      cartProductIds: ["in-cart"],
    });
    expect(out.map((i) => i.id)).toEqual(["novo"]);
  });

  it("nunca sugere produto inativo", () => {
    const out = rankUpsell({
      current,
      candidates: [p({ id: "off", name: "Inativo", status: "inactive" }), p({ id: "on", name: "Ativo" })],
    });
    expect(out.map((i) => i.id)).toEqual(["on"]);
  });

  it("limita a 3 sugestões", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      p({ id: `p${i}`, name: `P${i}`, categoryId: "bolsas" }),
    );
    expect(rankUpsell({ current, candidates: many })).toHaveLength(MAX_UPSELL_SUGGESTIONS);
  });

  it("retorna vazio quando não há candidatos", () => {
    expect(rankUpsell({ current, candidates: [] })).toEqual([]);
  });
});

describe("formatUpsellMessage", () => {
  it("monta a mensagem com nome e preço", () => {
    const text = formatUpsellMessage([p({ id: "a", name: "Carteira Premium", price: 89.9 })]);
    expect(text).toContain("💕 Excelente escolha!");
    expect(text).toContain("📸 Carteira Premium");
    expect(text).toContain("89,90");
    expect(text).toContain("Gostaria de adicionar algum deles ao seu pedido? 😊");
  });

  it("é vazia sem sugestões", () => {
    expect(formatUpsellMessage([])).toBe("");
  });
});

describe("resolveUpsellProductId", () => {
  it("usa o último produto exibido", () => {
    expect(resolveUpsellProductId({ lastProductIds: ["cur"] })).toBe("cur");
  });

  it("retorna null sem contexto", () => {
    expect(resolveUpsellProductId({ lastProductIds: [] })).toBeNull();
  });

  it("ignora carrinho expirado", () => {
    const now = Date.now();
    const session = addProduct(
      { companyId: "c", phone: "1", items: [], total: 0, createdAt: 0, updatedAt: 0 },
      { id: "cur", name: "Bolsa", price: 200, brand: null, categoryId: null, unit: "un" },
      1,
      now - 60 * 60 * 1000,
    );
    expect(resolveUpsellProductId({ lastProductIds: [], session, now })).toBeNull();
  });
});

describe("handleUpsellTurn", () => {
  const rows = [
    { id: "cur", name: "Bolsa Elegance", price: 200, brand: "Elegance", category_id: "bolsas", unit: "un", status: "active", cover_image_path: null },
    { id: "b", name: "Carteira Premium", price: 89.9, brand: "Elegance", category_id: "carteiras", unit: "un", status: "active", cover_image_path: null },
  ];

  function makeDb(products = rows) {
    return {
      from(table: string) {
        const q: any = {
          select: () => q,
          eq: () => q,
          in: () => Promise.resolve({ data: [] }),
          order: () =>
            Promise.resolve({ data: table === "products" ? products : [] }),
        };
        return q;
      },
    };
  }

  beforeEach(async () => await resetCartSessions());

  it("sugere complementares após adicionar", async () => {
    const out = await handleUpsellTurn({
      db: makeDb() as never,
      companyId: "co",
      phone: "5511",
      text: "Vou levar essa.",
      lastProductIds: ["cur"],
    });
    expect(out?.products.map((i) => i.id)).toEqual(["b"]);
    expect(out?.text).toContain("Carteira Premium");
  });

  it("não responde quando não há escolha", async () => {
    const out = await handleUpsellTurn({
      db: makeDb() as never,
      companyId: "co",
      phone: "5511",
      text: "bom dia",
      lastProductIds: ["cur"],
    });
    expect(out).toBeNull();
  });

  it("não responde sem produto em contexto", async () => {
    const out = await handleUpsellTurn({
      db: makeDb() as never,
      companyId: "co",
      phone: "5511",
      text: "Pode adicionar.",
      lastProductIds: [],
    });
    expect(out).toBeNull();
  });

  it("não responde quando não há recomendação", async () => {
    const out = await handleUpsellTurn({
      db: makeDb([rows[0]!]) as never,
      companyId: "co",
      phone: "5511",
      text: "Quero essa.",
      lastProductIds: ["cur"],
    });
    expect(out).toBeNull();
  });

  it("não repete itens já no carrinho", async () => {
    const session = await getCartSession("co", "5511");
    await saveCartSession(
      addProduct(session, {
        id: "b",
        name: "Carteira Premium",
        price: 89.9,
        brand: "Elegance",
        categoryId: "carteiras",
        unit: "un",
      }),
    );
    const out = await handleUpsellTurn({
      db: makeDb() as never,
      companyId: "co",
      phone: "5511",
      text: "Vou levar essa.",
      lastProductIds: ["cur"],
    });
    expect(out).toBeNull();
  });
});
