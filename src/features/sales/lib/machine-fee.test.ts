import { describe, it, expect } from "vitest";
import { machineFeeAmount } from "./settlement-account";

describe("machineFeeAmount", () => {
  it("R$100 com 2,99% + R$0,49 dá R$3,48", () => {
    expect(machineFeeAmount(100, { fee_percent: 2.99, fee_fixed: 0.49 })).toBe(3.48);
  });
});
