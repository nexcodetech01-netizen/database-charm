import { describe, expect, it, vi } from "vitest";
import { pdvSettlementDate, receivePdvSale } from "../lib/receiving";
import type { PdvReceiveDeps } from "../lib/receiving";

type MockedDeps = {
  openReceivable: ReturnType<typeof vi.fn>;
  settle: ReturnType<typeof vi.fn>;
  markPaid: ReturnType<typeof vi.fn>;
};

function deps(overrides: Partial<MockedDeps> = {}): MockedDeps & PdvReceiveDeps {
  return {
    openReceivable: vi.fn().mockResolvedValue({ id: "tx-1", amount: 100 }),
    settle: vi.fn().mockResolvedValue({}),
    markPaid: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as MockedDeps & PdvReceiveDeps;
}

describe("PDV — recebimento da venda", () => {
  it("recebe em dinheiro usando o motor único de liquidação", async () => {
    const d = deps();
    const res = await receivePdvSale(
      {
        saleId: "sale-1",
        paymentMethod: "cash",
        accountId: "acc-1",
        paidAt: "2026-07-31",
      },
      d,
    );
    expect(res).toEqual({ ok: true });
    expect(d.openReceivable).toHaveBeenCalledWith("sale-1");
    expect(d.settle).toHaveBeenCalledWith("tx-1", {
      paymentMethod: "cash",
      accountId: "acc-1",
      paidAt: "2026-07-31",
    });
    expect(d.markPaid).toHaveBeenCalledWith("sale-1");
  });

  it("recebe via PIX", async () => {
    const d = deps();
    const res = await receivePdvSale(
      { saleId: "sale-1", paymentMethod: "pix", accountId: "acc-2" },
      d,
    );
    expect(res.ok).toBe(true);
    expect(d.settle.mock.calls[0][1].paymentMethod).toBe("pix");
  });

  it("exige forma de recebimento e conta", async () => {
    const d = deps();
    const noMethod = await receivePdvSale(
      { saleId: "s", paymentMethod: "", accountId: "acc-1" },
      d,
    );
    const noAccount = await receivePdvSale(
      { saleId: "s", paymentMethod: "cash", accountId: "" },
      d,
    );
    expect(noMethod.ok).toBe(false);
    expect(noAccount.ok).toBe(false);
    expect(d.openReceivable).not.toHaveBeenCalled();
  });

  it("retorna erro quando a baixa falha e não marca a venda como paga", async () => {
    const d = deps({ settle: vi.fn().mockRejectedValue(new Error("CAIXA_FECHADO")) });
    const res = await receivePdvSale(
      { saleId: "sale-1", paymentMethod: "cash", accountId: "acc-1" },
      d,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("settle_failed");
      expect(res.message).toBe("CAIXA_FECHADO");
    }
    // Venda permanece criada — nada é revertido aqui.
    expect(d.markPaid).not.toHaveBeenCalled();
  });

  it("sinaliza título inexistente sem quebrar a venda criada", async () => {
    const d = deps({ openReceivable: vi.fn().mockResolvedValue(null) });
    const res = await receivePdvSale(
      { saleId: "sale-1", paymentMethod: "cash", accountId: "acc-1" },
      d,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("no_receivable");
    expect(d.settle).not.toHaveBeenCalled();
  });

  it("informa quando a baixa ocorreu mas o status da venda falhou", async () => {
    const d = deps({ markPaid: vi.fn().mockRejectedValue(new Error("rls")) });
    const res = await receivePdvSale(
      { saleId: "sale-1", paymentMethod: "cash", accountId: "acc-1" },
      d,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("status_failed");
      expect(res.settled).toBe(true);
    }
  });

  it("gera a data de liquidação no formato do módulo financeiro", () => {
    expect(pdvSettlementDate(new Date(2026, 6, 31))).toBe("2026-07-31");
  });
});
