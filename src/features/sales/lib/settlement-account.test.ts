import { describe, expect, it } from "vitest";
import { machineFeeAmount, machineFeeKey, pickSettlementAccount } from "./settlement-account";

const caixa = { id: "caixa", type: "cash" };
const banco = { id: "banco", type: "bank" };

describe("pickSettlementAccount", () => {
  it("dinheiro vai para o Caixa", () => {
    expect(pickSettlementAccount("cash", [banco, caixa], "caixa")).toBe("caixa");
  });

  it("PIX e cartões vão para o Banco, mesmo com o Caixa como padrão do PDV", () => {
    for (const method of ["pix_manual", "pix", "debit_card", "credit_card", "payment_link"]) {
      expect(pickSettlementAccount(method, [caixa, banco], "caixa")).toBe("banco");
    }
  });

  it("respeita a conta padrão do PDV quando ela é do tipo certo", () => {
    const outroBanco = { id: "banco-2", type: "bank" };
    expect(pickSettlementAccount("pix", [banco, outroBanco, caixa], "banco-2")).toBe("banco-2");
  });

  it("sem conta do tipo certo, mantém o comportamento antigo", () => {
    expect(pickSettlementAccount("pix", [caixa], "caixa")).toBe("caixa");
    expect(pickSettlementAccount("cash", [banco], null)).toBe("banco");
    expect(pickSettlementAccount("cash", [], null)).toBeNull();
  });
});

describe("maquininha", () => {
  const maquininha = { id: "infinitepay", type: "digital_wallet" };
  const contas = [caixa, banco, maquininha];

  it("débito, crédito e PIX da maquininha caem na conta da maquininha", () => {
    for (const method of ["debit_card", "credit_card", "pix"]) {
      expect(pickSettlementAccount(method, contas, "caixa", "infinitepay")).toBe("infinitepay");
    }
  });

  it("PIX da chave própria continua no banco e dinheiro no caixa", () => {
    expect(pickSettlementAccount("pix_manual", contas, "caixa", "infinitepay")).toBe("banco");
    expect(pickSettlementAccount("cash", contas, "caixa", "infinitepay")).toBe("caixa");
  });

  it("sem conta da maquininha configurada, mantém a regra anterior", () => {
    expect(pickSettlementAccount("debit_card", contas, "caixa", null)).toBe("banco");
  });
});

describe("taxa da maquininha", () => {
  it("escolhe a taxa pela forma de pagamento e parcelas", () => {
    expect(machineFeeKey("debit_card", null)).toBe("debit_card");
    expect(machineFeeKey("pix", null)).toBe("pix");
    expect(machineFeeKey("credit_card", 1)).toBe("credit_card_1");
    expect(machineFeeKey("credit_card", 3)).toBe("credit_card_3");
    expect(machineFeeKey("credit_card", null)).toBe("credit_card_1");
    expect(machineFeeKey("cash", null)).toBeNull();
  });

  it("calcula percentual + fixo em centavos", () => {
    expect(machineFeeAmount(100, { fee_percent: 1.37, fee_fixed: 0 })).toBe(1.37);
    expect(machineFeeAmount(113.17, { fee_percent: 2.88, fee_fixed: 0 })).toBe(3.26);
    expect(machineFeeAmount(50, { fee_percent: 0, fee_fixed: 0 })).toBe(0);
    expect(machineFeeAmount(50, null)).toBe(0);
  });
});
