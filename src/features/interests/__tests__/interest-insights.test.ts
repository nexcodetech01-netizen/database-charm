import { describe, expect, it } from "vitest";
import {
  buildInterestInsights,
  isOpenInterest,
  stockBackInterestNotice,
  summarizeInterests,
  waitingCountByProduct,
} from "../lib/interest-insights";
import type { ProductInterestRow } from "../types";

const row = (over: Partial<ProductInterestRow>): ProductInterestRow =>
  ({
    id: over.id ?? Math.random().toString(36).slice(2),
    company_id: "c1",
    product_id: over.product_id ?? "p1",
    customer_id: over.customer_id ?? null,
    customer_name: over.customer_name ?? "Cliente",
    phone: over.phone ?? null,
    channel: over.channel ?? "whatsapp",
    status: over.status ?? "aguardando",
    interest_date: "2026-01-10",
    notes: null,
    responsible_user_id: null,
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-01-10T00:00:00Z",
    product: over.product ?? { id: "p1", name: "Vestido Azul", sku: "V1", stock: 0, price: 100 },
    ...over,
  }) as ProductInterestRow;

describe("lista de interesse — agregação", () => {
  it("considera apenas status em aberto", () => {
    expect(isOpenInterest("aguardando")).toBe(true);
    expect(isOpenInterest("disponivel")).toBe(true);
    expect(isOpenInterest("avisado")).toBe(true);
    expect(isOpenInterest("concluido")).toBe(false);
    expect(isOpenInterest("cancelado")).toBe(false);
  });

  it("conta clientes aguardando por produto", () => {
    const rows = [
      row({ customer_name: "Ana" }),
      row({ customer_name: "Bia" }),
      row({ customer_name: "Cida", status: "cancelado" }),
    ];
    expect(waitingCountByProduct(rows)).toEqual({ p1: 2 });
  });

  it("calcula potencial de vendas e clientes distintos", () => {
    const rows = [
      row({ customer_name: "Ana" }),
      row({ customer_name: "Ana" }),
      row({
        product_id: "p2",
        customer_name: "Bia",
        product: { id: "p2", name: "Bolsa", sku: "B1", stock: 3, price: 250 },
      }),
    ];
    const s = summarizeInterests(rows);
    expect(s.openCount).toBe(3);
    expect(s.waitingCustomers).toBe(2);
    expect(s.waitedProducts).toBe(2);
    expect(s.potential).toBe(2 * 100 + 250);
    expect(s.readyCount).toBe(1);
    expect(s.byProduct[0]?.productId).toBe("p1");
  });

  it("resumo vazio quando não há interesses em aberto", () => {
    const s = summarizeInterests([row({ status: "concluido" })]);
    expect(s.openCount).toBe(0);
    expect(s.potential).toBe(0);
    expect(buildInterestInsights(s)).toEqual([]);
  });
});

describe("lista de interesse — insights da Bella", () => {
  it("informa produtos já disponíveis com clientes aguardando", () => {
    const s = summarizeInterests([
      row({
        customer_name: "Ana",
        product: { id: "p1", name: "Vestido Azul", sku: "V1", stock: 5, price: 100 },
      }),
    ]);
    const texts = buildInterestInsights(s).map((i) => i.text);
    expect(texts.some((t) => t.includes("já está disponível"))).toBe(true);
    expect(texts.some((t) => t.includes("Vestido Azul"))).toBe(true);
  });

  it("avisa quando o produto volta ao estoque", () => {
    expect(stockBackInterestNotice({ stock: 4, waiting: 2 })).toBe(
      "Existem clientes aguardando este produto.",
    );
    expect(stockBackInterestNotice({ stock: 0, waiting: 2 })).toBeNull();
    expect(stockBackInterestNotice({ stock: 4, waiting: 0 })).toBeNull();
  });
});
