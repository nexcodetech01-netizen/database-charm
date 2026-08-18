import { describe, it, expect } from "vitest";
import { isSettlementReason } from "../settlement-reason";

describe("isSettlementReason", () => {
  // Bug real (2026-08-18): a comparação exata nunca detectava esses
  // motivos de verdade, gravados com um sufixo depois de um travessão —
  // fazendo o "dinheiro esperado" do fechamento de caixa incluir TODA
  // venda (inclusive Pix/cartão) como se fosse suprimento manual.
  it("reconhece o motivo com sufixo de venda automática do PDV", () => {
    expect(isSettlementReason("Baixa financeira — Baixa automática PDV")).toBe(true);
  });

  it("reconhece o motivo com sufixo de comissão de marketplace", () => {
    expect(isSettlementReason("Baixa financeira — Comissão ML")).toBe(true);
  });

  it("reconhece com hífen simples em vez de travessão", () => {
    expect(isSettlementReason("Baixa financeira - Comissão ML")).toBe(true);
  });

  it("reconhece o texto exato, sem sufixo (comportamento original preservado)", () => {
    expect(isSettlementReason("baixa financeira")).toBe(true);
    expect(isSettlementReason("saneamento de baixa")).toBe(true);
    expect(isSettlementReason("estorno de baixa financeira")).toBe(true);
  });

  it("não é sensível a maiúsculas/minúsculas", () => {
    expect(isSettlementReason("BAIXA FINANCEIRA — teste")).toBe(true);
    expect(isSettlementReason("Saneamento De Baixa")).toBe(true);
  });

  it("continua tratando sangria/suprimento manual normal como manual (não settlement)", () => {
    expect(isSettlementReason("retirada")).toBe(false);
    expect(isSettlementReason("reforço de caixa")).toBe(false);
    expect(isSettlementReason("pagamento fornecedor")).toBe(false);
  });

  it("não confunde um motivo manual que só menciona 'baixa' no meio do texto", () => {
    // não deve dar match parcial em qualquer lugar — só no início
    expect(isSettlementReason("ajuste após baixa financeira do dia anterior")).toBe(false);
  });

  it("lida com nulo/vazio sem quebrar", () => {
    expect(isSettlementReason(null)).toBe(false);
    expect(isSettlementReason(undefined)).toBe(false);
    expect(isSettlementReason("")).toBe(false);
    expect(isSettlementReason("   ")).toBe(false);
  });
});
