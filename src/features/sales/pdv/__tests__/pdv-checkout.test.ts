import { describe, expect, it, vi } from "vitest";
import { createSaleDraftState } from "../../store/sale-store";
import type { SaleItemDraft } from "../../types";
import {
  nextPdvSaleNumber,
  submitPdvSale,
  validatePdvSale,
} from "../lib/checkout";

function item(overrides: Partial<SaleItemDraft> = {}): SaleItemDraft {
  return {
    ui_key: "k1",
    product_id: "p1",
    description: "Produto teste",
    quantity: 2,
    unit_price: 50,
    ...overrides,
  } as SaleItemDraft;
}

function draft() {
  return createSaleDraftState({
    number: nextPdvSaleNumber(new Date("2026-07-31T10:20:30")),
    customerId: "cus-1",
    items: [item()],
  });
}

describe("PDV — persistência da venda", () => {
  it("gera número no padrão do PDV", () => {
    expect(nextPdvSaleNumber(new Date("2026-07-31T10:20:30"))).toBe(
      "PDV-20260731-102030",
    );
  });

  it("permite venda sem cliente (consumidor final — P0.2)", () => {
    const check = validatePdvSale(
      createSaleDraftState({ number: "PDV-1", items: [item()] }),
    );
    expect(check.ok).toBe(true);
  });


  it("bloqueia venda sem itens", () => {
    const check = validatePdvSale(
      createSaleDraftState({ number: "PDV-1", customerId: "cus-1" }),
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe("no_items");
  });

  it("cria a venda com sucesso usando o payload do SaleEngine", async () => {
    const create = vi.fn().mockResolvedValue({ id: "sale-1" });
    const state = draft();

    const result = await submitPdvSale({
      state,
      companyId: "co-1",
      cashSessionId: "sess-1",
      create,
    });

    expect(result).toEqual({ ok: true, sale: { id: "sale-1" } });
    const payload = create.mock.calls[0][0];
    expect(payload.company_id).toBe("co-1");
    expect(payload.customer_id).toBe("cus-1");
    expect(payload.cash_session_id).toBe("sess-1");
    expect(payload.status).toBe("pending");
    expect(payload.sale_date).toBe("");
    expect(payload.items).toHaveLength(1);
  });

  it("retorna erro e preserva o carrinho quando a persistência falha", async () => {
    const create = vi.fn().mockRejectedValue(new Error("falha no banco"));
    const state = draft();
    const before = JSON.parse(JSON.stringify(state));

    const result = await submitPdvSale({
      state,
      companyId: "co-1",
      cashSessionId: null,
      create,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("persist_failed");
      expect(result.message).toBe("falha no banco");
    }
    // Carrinho intacto: submitPdvSale nunca muta o estado.
    expect(state).toEqual(before);
    expect(state.items).toHaveLength(1);
  });

  it("não chama o serviço quando a validação falha", async () => {
    const create = vi.fn();
    const result = await submitPdvSale({
      state: createSaleDraftState({ number: "PDV-1", customerId: "cus-1" }),
      companyId: "co-1",
      cashSessionId: null,
      create,
    });
    expect(create).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});
