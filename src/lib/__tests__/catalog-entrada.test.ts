import { describe, expect, it } from "vitest";
import { buildExternalReference, parseEntradaRequest } from "../catalog-entrada";
import { checkRateLimit } from "../rate-limit.server";

const valid = {
  slug: "colecao-verao",
  productId: "11111111-2222-3333-4444-555555555555",
  buyerName: "Maria Souza",
  buyerEmail: "maria@example.com",
  buyerPhone: "+5511999999999",
};

describe("parseEntradaRequest — requisição válida", () => {
  it("aceita payload completo", () => {
    const res = parseEntradaRequest(valid);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.buyerName).toBe("Maria Souza");
  });

  it("aceita payload mínimo e normaliza campos vazios", () => {
    const res = parseEntradaRequest({ ...valid, buyerEmail: "", buyerPhone: "" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.buyerEmail).toBeUndefined();
      expect(res.data.buyerPhone).toBeUndefined();
    }
  });
});

describe("parseEntradaRequest — parâmetros inválidos", () => {
  it.each([
    ["body não objeto", "x", "invalid_body"],
    ["slug ausente", { ...valid, slug: "" }, "invalid_slug"],
    ["slug com path traversal", { ...valid, slug: "../../etc" }, "invalid_slug"],
    ["productId não-uuid", { ...valid, productId: "123" }, "invalid_productId"],
    ["nome curto", { ...valid, buyerName: "A" }, "invalid_buyerName"],
    ["nome longo", { ...valid, buyerName: "A".repeat(200) }, "invalid_buyerName"],
    ["email inválido", { ...valid, buyerEmail: "nope" }, "invalid_buyerEmail"],
    ["telefone inválido", { ...valid, buyerPhone: "abc" }, "invalid_buyerPhone"],
  ])("%s", (_label, payload, expected) => {
    const res = parseEntradaRequest(payload);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(expected);
  });
});

describe("buildExternalReference — tentativas repetidas", () => {
  it("é determinística para o mesmo comprador/produto", () => {
    const a = buildExternalReference("col", "prod", "Maria  Souza");
    const b = buildExternalReference("col", "prod", "  maria souza ");
    expect(a).toBe(b);
  });

  it("difere entre compradores", () => {
    expect(buildExternalReference("col", "prod", "Maria")).not.toBe(
      buildExternalReference("col", "prod", "João"),
    );
  });
});

describe("rate limiting — flood", () => {
  it("bloqueia após atingir o máximo na janela", () => {
    const opts = { route: `test:entrada:${Math.random()}`, windowMs: 60_000, max: 5 };
    const results = Array.from({ length: 7 }, () => checkRateLimit(opts));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]!.ok).toBe(false);
    expect(results[6]!.ok).toBe(false);
    expect(results[5]!.retryAfterSec).toBeGreaterThan(0);
  });
});
