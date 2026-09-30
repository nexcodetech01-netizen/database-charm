import { describe, expect, it } from "vitest";
import { partnerNamesFrom, planWithdrawals } from "../withdrawal-split";

describe("partnerNamesFrom", () => {
  it("usa as categorias de retirada por sócia, sem a dividida", () => {
    expect(
      partnerNamesFrom([
        "Mercadoria",
        "Retirada — Tiele",
        "Retirada — dividida",
        "Retirada — Gabriela",
      ]),
    ).toEqual(["Gabriela", "Tiele"]);
  });
});

describe("planWithdrawals", () => {
  const partnerNames = ["Gabriela", "Tiele"];

  it("a retirada dividida conta metade para cada uma", () => {
    const plan = planWithdrawals({
      partnerNames,
      withdrawals: [
        { category: "Retirada — Tiele", total: 100 },
        { category: "Retirada — dividida", total: 390.73 },
      ],
      safeAmount: null,
      cashBalance: 0,
    });
    expect(plan.partners).toEqual([
      { name: "Gabriela", withdrawn: 195.37, available: 0 },
      { name: "Tiele", withdrawn: 295.37, available: 0 },
    ]);
  });

  it("guarda 10% do saldo e divide o restante meio a meio", () => {
    const plan = planWithdrawals({
      partnerNames,
      withdrawals: [],
      safeAmount: 800,
      cashBalance: 1148.74,
    });
    expect(plan.reserve).toBe(114.87);
    expect(plan.availableTotal).toBe(685.13);
        expect(plan.partners.map((p) => p.available)).toEqual([342.56, 342.56]);
  });

  it("nunca sugere retirada negativa", () => {
    const plan = planWithdrawals({ partnerNames, withdrawals: [], safeAmount: 50, cashBalance: 1000 });
    expect(plan.availableTotal).toBe(0);
    expect(plan.partners.every((p) => p.available === 0)).toBe(true);
  });
});
