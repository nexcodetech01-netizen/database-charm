import { describe, expect, it } from "vitest";
import { toCustomerReference } from "../customer-reference";

describe("toCustomerReference", () => {
  it("remove o prefixo da categoria em SKUs padrão", () => {
    expect(toCustomerReference("BOL-QUA-PRE-001")).toBe("QUA-PRE-001");
    expect(toCustomerReference("BOL-CAR-BEG-001")).toBe("CAR-BEG-001");
    expect(toCustomerReference("BOL-SAC-CRE-001")).toBe("SAC-CRE-001");
    expect(toCustomerReference("BOL-FAB-CAR-001")).toBe("FAB-CAR-001");
  });
  it("mantém o SKU original quando não segue o padrão", () => {
    expect(toCustomerReference("ABC123")).toBe("ABC123");
    expect(toCustomerReference("BOL-QUA-001")).toBe("BOL-QUA-001");
    expect(toCustomerReference("BOL-QUA-PRE-ABC")).toBe("BOL-QUA-PRE-ABC");
  });
  it("trata vazio/nulo", () => {
    expect(toCustomerReference("")).toBe("");
    expect(toCustomerReference(null)).toBe("");
    expect(toCustomerReference(undefined)).toBe("");
  });
});
