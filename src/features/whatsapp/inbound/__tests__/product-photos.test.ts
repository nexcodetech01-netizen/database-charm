import { vi } from "vitest";
import { supabaseAdminMock } from "./session-store.mock";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import { beforeEach, describe, expect, it } from "vitest";
import {
  formatAfterPhotosMessage,
  isPhotoRequestIntent,
  MAX_PRODUCT_PHOTOS,
  NO_PHOTOS_MESSAGE,
  resolveContextProductId,
  selectPhotos,
} from "../product-photos";
import { handlePhotoTurn } from "../product-photos.server";
import { getCartSession, resetCartSessions, saveCartSession } from "../cart-session.server";
import { addProduct } from "../cart-session";
import { CART_SESSION_TTL_MS } from "../cart-session";

function dbWith(rows: Array<{ id: string; path: string; position: number }>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ order: async () => ({ data: rows }) }),
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

describe("product-photos — intenção", () => {
  it.each([
    "quero ver mais fotos",
    "manda foto",
    "tem outras fotos?",
    "mostra mais",
    "quero ver detalhes",
    "envia imagens",
    "mostra atrás",
    "mostra o produto",
  ])("reconhece '%s'", (t) => {
    expect(isPhotoRequestIntent(t)).toBe(true);
  });

  it("ignora mensagens não relacionadas", () => {
    expect(isPhotoRequestIntent("qual o preço?")).toBe(false);
    expect(isPhotoRequestIntent("")).toBe(false);
  });
});

describe("product-photos — seleção", () => {
  it("ordena pela ordem cadastrada e limita a 5", () => {
    const imgs = [5, 3, 1, 2, 4, 6, 7].map((n) => ({ path: `p${n}.jpg`, position: n }));
    const out = selectPhotos(imgs);
    expect(out).toHaveLength(MAX_PRODUCT_PHOTOS);
    expect(out.map((i) => i.path)).toEqual(["p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg", "p5.jpg"]);
  });
});

describe("product-photos — contexto", () => {
  beforeEach(async () => await resetCartSessions());

  it("usa o último produto exibido", () => {
    expect(resolveContextProductId({ state })).toBe("p1");
  });

  it("cai para o último item do carrinho", async () => {
    const s = addProduct(await getCartSession("c1", "551199"), {
      id: "p9",
      name: "Bolsa",
      price: 10,
    } as never);
    expect(resolveContextProductId({ state: null, session: s })).toBe("p9");
  });

  it("sem contexto retorna null", () => {
    expect(resolveContextProductId({ state: null, session: null })).toBeNull();
  });

  it("contexto expirado é ignorado", async () => {
    const now = Date.now();
    const s = addProduct(await getCartSession("c1", "551199", now), {
      id: "p9",
      name: "Bolsa",
      price: 10,
    } as never, 1, now);
    expect(
      resolveContextProductId({ state: null, session: s, now: now + CART_SESSION_TTL_MS + 1 }),
    ).toBeNull();
  });
});

describe("handlePhotoTurn", () => {
  beforeEach(async () => await resetCartSessions());

  const base = {
    companyId: "c1",
    phone: "551199",
    text: "manda foto",
    state,
    storage: storage as never,
  };

  it("produto com 1 imagem", async () => {
    const out = await handlePhotoTurn({
      ...base,
      db: dbWith([{ id: "i1", path: "a.jpg", position: 0 }]),
    });
    expect(out?.images).toEqual(["https://cdn.test/a.jpg"]);
    expect(out?.text).toBe(formatAfterPhotosMessage());
  });

  it("produto com várias imagens", async () => {
    const out = await handlePhotoTurn({
      ...base,
      db: dbWith([
        { id: "i2", path: "b.jpg", position: 1 },
        { id: "i1", path: "a.jpg", position: 0 },
        { id: "i3", path: "c.jpg", position: 2 },
      ]),
    });
    expect(out?.images).toEqual([
      "https://cdn.test/a.jpg",
      "https://cdn.test/b.jpg",
      "https://cdn.test/c.jpg",
    ]);
  });

  it("limita a 5 imagens", async () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      id: `i${i}`,
      path: `f${i}.jpg`,
      position: i,
    }));
    const out = await handlePhotoTurn({ ...base, db: dbWith(rows) });
    expect(out?.images).toHaveLength(MAX_PRODUCT_PHOTOS);
  });

  it("produto sem imagens", async () => {
    const out = await handlePhotoTurn({ ...base, db: dbWith([]) });
    expect(out?.images).toEqual([]);
    expect(out?.text).toBe(NO_PHOTOS_MESSAGE);
  });

  it("sem contexto de produto devolve null", async () => {
    const out = await handlePhotoTurn({ ...base, state: null, db: dbWith([]) });
    expect(out).toBeNull();
  });

  it("contexto expirado devolve null", async () => {
    const now = Date.now();
    await saveCartSession(
      addProduct(await getCartSession("c1", "551199", now), {
        id: "p9",
        name: "Bolsa",
        price: 10,
      } as never, 1, now),
    );
    const out = await handlePhotoTurn({
      ...base,
      state: null,
      now: now + CART_SESSION_TTL_MS + 1,
      db: dbWith([{ id: "i1", path: "a.jpg", position: 0 }]),
    });
    expect(out).toBeNull();
  });

  it("mensagem fora da intenção não entra no fluxo", async () => {
    const out = await handlePhotoTurn({ ...base, text: "qual o preço?", db: dbWith([]) });
    expect(out).toBeNull();
  });
});
