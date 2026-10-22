import { describe, expect, it } from "vitest";
import { createIdempotencyKeeper, saleFingerprint } from "./idempotency";

function seqIds() {
  let n = 0;
  return () => `id-${++n}`;
}

const base = {
  customerId: "c1",
  paymentMethod: "pix_manual",
  discount: 0,
  shipping: 0,
  items: [{ product_id: "p1", description: "Bolsa", quantity: 1, unit_price: 89.9 }],
};

describe("createIdempotencyKeeper", () => {
  it("reaproveita a chave enquanto o conteúdo é o mesmo (reenvio após queda de rede)", () => {
    const k = createIdempotencyKeeper(seqIds());
    const fp = saleFingerprint(base);
    expect(k.keyFor(fp)).toBe("id-1");
    expect(k.keyFor(fp)).toBe("id-1");
  });

  it("gera chave nova quando o carrinho muda", () => {
    const k = createIdempotencyKeeper(seqIds());
    expect(k.keyFor(saleFingerprint(base))).toBe("id-1");
    const changed = { ...base, items: [{ ...base.items[0], quantity: 2 }] };
    expect(k.keyFor(saleFingerprint(changed))).toBe("id-2");
  });

  it("após reset, a próxima venda (mesmo conteúdo) recebe chave nova", () => {
    const k = createIdempotencyKeeper(seqIds());
    const fp = saleFingerprint(base);
    expect(k.keyFor(fp)).toBe("id-1");
    k.reset();
    expect(k.keyFor(fp)).toBe("id-2");
  });

  it("duas vendas iguais em sequência (mesmo total, mesmo minuto) nunca compartilham chave", () => {
    const k = createIdempotencyKeeper(seqIds());
    const fp = saleFingerprint(base);
    const first = k.keyFor(fp);
    k.reset(); // primeira venda concluída
    const second = k.keyFor(fp);
    expect(first).not.toBe(second);
  });
});
