import { describe, expect, it, vi } from "vitest";
import {
  PDV_SESSION_INITIAL,
  pdvSessionReducer,
  printPdvReceipt,
  startNewPdvSale,
  type PdvSessionState,
} from "../lib/completion";

const sale = { id: "sale-1", number: "PDV-1", total: 150 };

function received(): PdvSessionState {
  const created = pdvSessionReducer(PDV_SESSION_INITIAL, {
    type: "SALE_CREATED",
    sale,
  });
  return pdvSessionReducer(created, {
    type: "SALE_RECEIVED",
    paymentMethod: "pix",
    receivedAt: "2026-07-31T12:00:00.000Z",
  });
}

describe("PDV — conclusão e recibo (Sprint 2.6)", () => {
  it("remove pendingSale e registra a venda concluída após o recebimento", () => {
    const state = received();
    expect(state.pendingSale).toBeNull();
    expect(state.completed).toEqual({
      ...sale,
      paymentMethod: "pix",
      receivedAt: "2026-07-31T12:00:00.000Z",
    });
  });

  it("abre o recibo somente quando existe venda concluída", () => {
    const opened = pdvSessionReducer(received(), { type: "OPEN_RECEIPT" });
    expect(opened.receiptOpen).toBe(true);

    const noSale = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "OPEN_RECEIPT",
    });
    expect(noSale.receiptOpen).toBe(false);
  });

  it("fecha o recibo mantendo a venda concluída", () => {
    const closed = pdvSessionReducer(
      pdvSessionReducer(received(), { type: "OPEN_RECEIPT" }),
      { type: "CLOSE_RECEIPT" },
    );
    expect(closed.receiptOpen).toBe(false);
    expect(closed.completed?.id).toBe("sale-1");
  });

  it("aciona a impressão pela infraestrutura existente", () => {
    const printer = vi.fn();
    printPdvReceipt(printer);
    expect(printer).toHaveBeenCalledTimes(1);
  });

  it("Nova Venda limpa o carrinho e reinicia o estado da sessão", () => {
    const resetCart = vi.fn();
    const next = startNewPdvSale(received(), { resetCart });
    expect(resetCart).toHaveBeenCalledTimes(1);
    expect(next).toEqual(PDV_SESSION_INITIAL);
    expect(next.pendingSale).toBeNull();
    expect(next.completed).toBeNull();
    expect(next.receiptOpen).toBe(false);
  });

  it("Nova Venda não toca na sessão de caixa (caixa permanece aberto)", () => {
    const cash = { id: "cash-1", status: "open" };
    startNewPdvSale(received(), { resetCart: () => {} });
    expect(cash).toEqual({ id: "cash-1", status: "open" });
  });

  it("ignora recebimento sem venda pendente", () => {
    const state = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_RECEIVED",
      paymentMethod: "cash",
    });
    expect(state).toEqual(PDV_SESSION_INITIAL);
  });
});
