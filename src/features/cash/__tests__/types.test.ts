import { describe, expect, it } from "vitest";
import { emptyByMethod } from "../types";

describe("cash types", () => {
  it("emptyByMethod inicializa todas as chaves em zero", () => {
    const m = emptyByMethod();
    expect(m.cash).toEqual({ count: 0, total: 0 });
    expect(m.pix).toEqual({ count: 0, total: 0 });
    expect(m.credit_card).toEqual({ count: 0, total: 0 });
    expect(m.debit_card).toEqual({ count: 0, total: 0 });
    expect(m.payment_link).toEqual({ count: 0, total: 0 });
    expect(m.other).toEqual({ count: 0, total: 0 });
  });
});
