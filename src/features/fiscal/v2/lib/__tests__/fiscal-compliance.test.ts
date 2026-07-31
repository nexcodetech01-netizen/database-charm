import { describe, expect, it } from "vitest";
import { formatAccessKey, isValidAccessKey, normalizeAccessKey } from "../access-key";
import {
  DEFAULT_COMMERCIAL_UNIT,
  resolveCommercialCode,
  resolveCommercialUnit,
} from "../item-identity";
import {
  allocateDiscount,
  expectedDocumentTotal,
  round2,
  totalsAreConsistent,
} from "../document-totals";
import { buildXmlFileName } from "../xml-file";

const KEY = "3".repeat(44);

describe("access-key (P0.6.3)", () => {
  it("remove o prefixo NFe e mantém 44 dígitos", () => {
    expect(normalizeAccessKey(`NFe${KEY}`)).toBe(KEY);
    expect(normalizeAccessKey(KEY)).toBe(KEY);
    expect(formatAccessKey(`NFe${KEY}`)).toBe(KEY);
    expect(formatAccessKey(`NFe${KEY}`).startsWith("NFe")).toBe(false);
  });

  it("tolera separadores e espaços", () => {
    expect(normalizeAccessKey(` ${KEY.slice(0, 4)} ${KEY.slice(4)} `)).toBe(KEY);
  });

  it("trata ausência de chave", () => {
    expect(normalizeAccessKey(null)).toBeNull();
    expect(normalizeAccessKey("")).toBeNull();
    expect(formatAccessKey(null)).toBe("—");
    expect(formatAccessKey(null, "")).toBe("");
    expect(isValidAccessKey(KEY)).toBe(true);
    expect(isValidAccessKey("123")).toBe(false);
  });

  it("nome do XML usa a chave sem prefixo", () => {
    expect(buildXmlFileName({ accessKey: `NFe${KEY}` })).toBe(`NFe-${KEY}.xml`);
  });
});

describe("item-identity (P0.6.3)", () => {
  it("usa o SKU como código comercial quando existir", () => {
    expect(resolveCommercialCode("PROD-F8C844", "uuid-1")).toBe("PROD-F8C844");
    expect(resolveCommercialCode("  ABC  ", "uuid-1")).toBe("ABC");
  });

  it("mantém o comportamento atual sem SKU", () => {
    expect(resolveCommercialCode(null, "uuid-1")).toBe("uuid-1");
    expect(resolveCommercialCode("   ", "uuid-1")).toBe("uuid-1");
  });

  it("usa a unidade cadastrada no produto", () => {
    expect(resolveCommercialUnit("cx")).toBe("CX");
    expect(resolveCommercialUnit("KG")).toBe("KG");
    expect(resolveCommercialUnit("Mt")).toBe("MT");
    expect(resolveCommercialUnit("L")).toBe("L");
    expect(resolveCommercialUnit("Pç")).toBe("PC");
  });

  it("cai para UN somente na ausência de unidade", () => {
    expect(resolveCommercialUnit(null)).toBe(DEFAULT_COMMERCIAL_UNIT);
    expect(resolveCommercialUnit("  ")).toBe(DEFAULT_COMMERCIAL_UNIT);
  });
});

describe("document-totals (P0.6.3)", () => {
  it("rateia o desconto proporcionalmente", () => {
    const parts = allocateDiscount([100, 300], 40);
    expect(parts).toEqual([10, 30]);
    expect(round2(parts[0]! + parts[1]!)).toBe(40);
  });

  it("resíduo de arredondamento fecha com o desconto do cabeçalho", () => {
    const parts = allocateDiscount([33.33, 33.33, 33.34], 10);
    expect(round2(parts.reduce((a, b) => a + b, 0))).toBe(10);
  });

  it("ignora desconto zero ou inválido", () => {
    expect(allocateDiscount([10, 20], 0)).toEqual([0, 0]);
    expect(allocateDiscount([10, 20], -5)).toEqual([0, 0]);
    expect(allocateDiscount([], 10)).toEqual([]);
  });

  it("valida a equação vNF = vProd - vDesc + vFrete", () => {
    expect(expectedDocumentTotal({ products: 100, discount: 10, freight: 15 })).toBe(105);
    expect(
      totalsAreConsistent({ products: 100, discount: 10, freight: 15, total: 105 }),
    ).toBe(true);
    expect(
      totalsAreConsistent({ products: 100, discount: 10, freight: 15, total: 90 }),
    ).toBe(false);
  });
});
