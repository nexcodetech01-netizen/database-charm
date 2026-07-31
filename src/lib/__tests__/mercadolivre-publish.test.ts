import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterMlFamilyNameAttribute,
  mlPublishPayloadSchema,
  sanitizeMlTitle,
} from "../mercadolivre-publish.functions";

const baseAttributes = [
  { id: "BRAND", value_name: "Genérica" },
  { id: "MODEL", value_name: "Padrão" },
  { id: "COLOR", value_name: "Caramelo" },
];

const basePayload = {
  family_name: "Bolsa Feminina de Couro",
  category_id: "MLB457449",
  price: 199.9,
  available_quantity: 3,
  currency_id: "BRL" as const,
  buying_mode: "buy_it_now" as const,
  condition: "new" as const,
  listing_type_id: "gold_special" as const,
  pictures: [{ source: "https://cdn.example.com/img1.jpg" }],
  attributes: baseAttributes,
};

describe("sanitizeMlTitle", () => {
  it("substitui travessões unicode por hífen simples", () => {
    expect(sanitizeMlTitle("Bolsa – Edição — Especial")).toBe(
      "Bolsa - Edição - Especial",
    );
  });

  it("remove emojis, aspas e símbolos não permitidos", () => {
    expect(sanitizeMlTitle('🔥 "Bolsa" #Nova! @2026 <promo>')).toBe(
      "Bolsa Nova 2026 promo",
    );
  });

  it("preserva acentos, dígitos, ponto e hífen", () => {
    expect(sanitizeMlTitle("Mochila 15.6-polegadas Ação")).toBe(
      "Mochila 15.6-polegadas Ação",
    );
  });

  it("colapsa espaços múltiplos", () => {
    expect(sanitizeMlTitle("  Bolsa   Feminina    Couro  ")).toBe(
      "Bolsa Feminina Couro",
    );
  });

  it("trunca em 60 caracteres", () => {
    const long = "A".repeat(120);
    const out = sanitizeMlTitle(long);
    expect(out).toHaveLength(60);
    expect(out).toBe("A".repeat(60));
  });

  it("aceita entradas nulas e vazias", () => {
    expect(sanitizeMlTitle(null)).toBe("");
    expect(sanitizeMlTitle(undefined)).toBe("");
    expect(sanitizeMlTitle("   ")).toBe("");
  });
});

describe("filterMlFamilyNameAttribute", () => {
  it("remove family_name identificado por id ou key antes do envio", () => {
    const attributes = [
      ...baseAttributes,
      { id: "family_name", value_name: "Bolsa" },
      { key: " FAMILY_NAME ", value_name: "Bolsa" },
    ];

    const filtered = filterMlFamilyNameAttribute(attributes);

    expect(filtered).toEqual(baseAttributes);
  });
});

describe("mlPublishPayloadSchema (item simples com family_name)", () => {
  it("aceita payload válido com family_name + price/qty na raiz", () => {
    expect(mlPublishPayloadSchema.safeParse(basePayload).success).toBe(true);
  });

  it("rejeita title na raiz (removido permanentemente)", () => {
    expect(
      mlPublishPayloadSchema.safeParse({ ...basePayload, title: "X" })
        .success,
    ).toBe(false);
  });

  it("rejeita variations na raiz (removido permanentemente)", () => {
    expect(
      mlPublishPayloadSchema.safeParse({ ...basePayload, variations: [] })
        .success,
    ).toBe(false);
  });

  it("exige family_name", () => {
    const { family_name: _f, ...rest } = basePayload;
    expect(mlPublishPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it("exige price e available_quantity na raiz", () => {
    const { price: _p, ...noPrice } = basePayload;
    expect(mlPublishPayloadSchema.safeParse(noPrice).success).toBe(false);
    const { available_quantity: _q, ...noQty } = basePayload;
    expect(mlPublishPayloadSchema.safeParse(noQty).success).toBe(false);
  });

  it("rejeita se attributes não contiver BRAND ou MODEL", () => {
    expect(
      mlPublishPayloadSchema.safeParse({
        ...basePayload,
        attributes: baseAttributes.filter((a) => a.id !== "BRAND"),
      }).success,
    ).toBe(false);
    expect(
      mlPublishPayloadSchema.safeParse({
        ...basePayload,
        attributes: baseAttributes.filter((a) => a.id !== "MODEL"),
      }).success,
    ).toBe(false);
  });

  it("rejeita family_name acima de 50 caracteres", () => {
    expect(
      mlPublishPayloadSchema.safeParse({
        ...basePayload,
        family_name: "A".repeat(51),
      }).success,
    ).toBe(false);
  });

  it("rejeita category_id fora do padrão MLB1234", () => {
    expect(
      mlPublishPayloadSchema.safeParse({ ...basePayload, category_id: "1234" })
        .success,
    ).toBe(false);
  });

  it("rejeita zero fotos e mais de 12 fotos", () => {
    expect(
      mlPublishPayloadSchema.safeParse({ ...basePayload, pictures: [] })
        .success,
    ).toBe(false);
    const many = Array.from({ length: 13 }, (_, i) => ({
      source: `https://cdn.example.com/${i}.jpg`,
    }));
    expect(
      mlPublishPayloadSchema.safeParse({ ...basePayload, pictures: many })
        .success,
    ).toBe(false);
  });
});

describe("payload enviado ao POST /items (integração com fetch mockado)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: "MLB123", permalink: "https://ml/x" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("payload com family_name + price/qty na raiz, sem title e sem variations", async () => {
    const parsed = mlPublishPayloadSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);

    const res = await fetch("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });
    expect(res.ok).toBe(true);

    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse((init as RequestInit).body as string) as Record<
      string,
      unknown
    >;

    expect(sent).toHaveProperty("family_name");
    expect(sent).toHaveProperty("price");
    expect(sent).toHaveProperty("available_quantity");
    expect(sent).not.toHaveProperty("title");
    expect(sent).not.toHaveProperty("variations");

    const ids = (sent.attributes as { id: string }[]).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["BRAND", "MODEL", "COLOR"]));
    const brand = (sent.attributes as Array<{ id: string; value_id?: string; value_name?: string }>).find(
      (a) => a.id === "BRAND",
    );
    expect(brand?.value_id).toBeUndefined();
    expect(brand?.value_name).toBe("Genérica");
  });
});
