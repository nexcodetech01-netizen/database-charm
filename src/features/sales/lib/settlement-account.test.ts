import { describe, expect, it } from "vitest";
import { pickSettlementAccount } from "./settlement-account";

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
