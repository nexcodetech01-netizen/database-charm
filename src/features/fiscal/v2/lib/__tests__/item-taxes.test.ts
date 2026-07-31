import { describe, expect, it } from "vitest";
import { isMei, isSimplesNacional, resolveItemTaxes, toFocusTaxFields } from "../item-taxes";
import {
  CRT_NOT_CONFIGURED_MESSAGE,
  crtCoherenceMessage,
  defaultCrtForRegime,
  isCrtCoherent,
  requireCrt,
  resolveProviderCrt,
} from "../crt";

describe("item-taxes", () => {
  it("Simples Nacional gera ICMS/PIS/COFINS zerados", () => {
    const t = resolveItemTaxes(1, { cst: null, amount: 100 }, "102");
    expect(t.icms.situacaoTributaria).toBe("102");
    expect(t.pis.situacaoTributaria).toBe("49");
    expect(t.cofins.situacaoTributaria).toBe("49");
    expect(t.pis.valor).toBe(0);
  });

  it("Regime normal calcula PIS/COFINS sobre o valor do item", () => {
    const t = resolveItemTaxes(3, { cst: null, amount: 100 });
    expect(t.icms.situacaoTributaria).toBe("41");
    expect(t.pis.situacaoTributaria).toBe("01");
    expect(t.pis.valor).toBe(1.65);
    expect(t.cofins.valor).toBe(7.6);
  });

  it("MEI (CRT 4) usa CSOSN e NUNCA destaca PIS/COFINS", () => {
    const t = resolveItemTaxes(4, { cst: null, amount: 100 }, "102");
    expect(t.icms.situacaoTributaria).toBe("102");
    expect(t.icms.modalidadeBaseCalculo).toBeUndefined();
    expect(t.pis.situacaoTributaria).toBe("49");
    expect(t.cofins.situacaoTributaria).toBe("49");
    expect(t.pis.aliquotaPercentual).toBe(0);
    expect(t.cofins.aliquotaPercentual).toBe(0);
    expect(t.pis.valor).toBe(0);
    expect(t.cofins.valor).toBe(0);
  });

  it("MEI respeita o CSOSN configurado (103/300/400/500/900)", () => {
    for (const csosn of ["102", "103", "300", "400", "500", "900"]) {
      const t = resolveItemTaxes(4, { cst: null, amount: 250 }, csosn);
      expect(t.icms.situacaoTributaria).toBe(csosn);
      expect(t.pis.situacaoTributaria).toBe("49");
    }
  });

  it("MEI nunca é tratado como Regime Normal", () => {
    const mei = resolveItemTaxes(4, { cst: null, amount: 1000 });
    const normal = resolveItemTaxes(3, { cst: null, amount: 1000 });
    expect(mei.pis.valor).toBe(0);
    expect(normal.pis.valor).toBeGreaterThan(0);
    expect(isMei(4)).toBe(true);
    expect(isMei(1)).toBe(false);
    expect(isSimplesNacional(4)).toBe(true);
    expect(isSimplesNacional(3)).toBe(false);
  });

  it("payload Focus sempre contém os três grupos", () => {
    for (const crt of [1, 2, 3, 4, null]) {
      const fields = toFocusTaxFields(resolveItemTaxes(crt, { cst: null, amount: 0 }));
      expect(fields.icms_situacao_tributaria).toBeTruthy();
      expect(fields.pis_situacao_tributaria).toBeTruthy();
      expect(fields.cofins_situacao_tributaria).toBeTruthy();
      expect(fields.pis_valor).toBeDefined();
      expect(fields.cofins_valor).toBeDefined();
    }
  });
});

describe("crt", () => {
  it("exige CRT configurado — nunca assume 1", () => {
    expect(() => requireCrt(null)).toThrow(CRT_NOT_CONFIGURED_MESSAGE);
    expect(() => requireCrt(undefined)).toThrow(CRT_NOT_CONFIGURED_MESSAGE);
    expect(() => requireCrt(0)).toThrow(CRT_NOT_CONFIGURED_MESSAGE);
    expect(() => requireCrt(5)).toThrow(CRT_NOT_CONFIGURED_MESSAGE);
    expect(requireCrt(4)).toBe(4);
  });

  it("valida coerência regime × CRT", () => {
    expect(isCrtCoherent("mei", 4)).toBe(true);
    expect(isCrtCoherent("mei", 1)).toBe(false);
    expect(isCrtCoherent("simples", 1)).toBe(true);
    expect(isCrtCoherent("simples", 2)).toBe(true);
    expect(isCrtCoherent("simples", 4)).toBe(false);
    expect(isCrtCoherent("presumido", 3)).toBe(true);
    expect(isCrtCoherent("real", 3)).toBe(true);
    expect(isCrtCoherent("real", 1)).toBe(false);
    expect(crtCoherenceMessage("mei")).toContain("4");
  });

  it("sugere o CRT padrão de cada regime", () => {
    expect(defaultCrtForRegime("mei")).toBe(4);
    expect(defaultCrtForRegime("simples")).toBe(1);
    expect(defaultCrtForRegime("presumido")).toBe(3);
    expect(defaultCrtForRegime("real")).toBe(3);
  });

  it("feature flag ENABLE_CRT4_MEI controla o valor enviado ao provedor", () => {
    // flag desligada (default) → comportamento atual
    expect(resolveProviderCrt(4, false)).toBe(1);
    // flag ligada → envia CRT 4
    expect(resolveProviderCrt(4, true)).toBe(4);
    // demais regimes não são afetados
    for (const crt of [1, 2, 3] as const) {
      expect(resolveProviderCrt(crt, false)).toBe(crt);
      expect(resolveProviderCrt(crt, true)).toBe(crt);
    }
    expect(() => resolveProviderCrt(null, true)).toThrow(CRT_NOT_CONFIGURED_MESSAGE);
  });
});

