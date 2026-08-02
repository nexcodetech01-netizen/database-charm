import { describe, expect, it } from "vitest";
import { MARGIN_ORIGIN_LABEL, categoryPolicyIsActive, resolveMarginPolicy } from "../margin-policy";
import { findMarketReference, marketReferenceKey } from "../market-reference";

const FALLBACK = 40;

describe("resolveMarginPolicy", () => {
  it("categoria SEM configuração → cai para a empresa", () => {
    const r = resolveMarginPolicy({
      category: { targetPct: null, autoPolicy: true },
      companyTargetPct: 38,
      fallbackTargetPct: FALLBACK,
    });
    expect(r).toMatchObject({ marginPct: 38, origin: "company", originLabel: "Empresa" });
  });

  it("sem categoria e sem empresa → fallback canônico", () => {
    const r = resolveMarginPolicy({ fallbackTargetPct: FALLBACK });
    expect(r.marginPct).toBe(FALLBACK);
    expect(r.origin).toBe("fallback");
  });

  it("categoria configurada → margem da categoria", () => {
    const r = resolveMarginPolicy({
      category: { targetPct: 55, minPct: 25, maxPct: 70, autoPolicy: true },
      companyTargetPct: 38,
      fallbackTargetPct: FALLBACK,
    });
    expect(r).toMatchObject({ marginPct: 55, origin: "category", originLabel: "Categoria" });
    expect(r.minPct).toBe(25);
    expect(r.maxPct).toBe(70);
  });

  it("política automática desligada → categoria não impõe margem", () => {
    const r = resolveMarginPolicy({
      category: { targetPct: 55, minPct: 25, maxPct: 70, autoPolicy: false },
      companyTargetPct: 38,
      fallbackTargetPct: FALLBACK,
    });
    expect(r.origin).toBe("company");
    expect(r.marginPct).toBe(38);
    expect(r.minPct).toBeNull();
  });

  it("produto com margem própria vence a categoria (exceção)", () => {
    const r = resolveMarginPolicy({
      product: { marginPct: 62, useCategoryMargin: false },
      category: { targetPct: 55, minPct: 25, maxPct: 70, autoPolicy: true },
      fallbackTargetPct: FALLBACK,
    });
    expect(r).toMatchObject({ marginPct: 62, origin: "product", originLabel: "Produto" });
  });

  it("produto marcado para usar a categoria ignora a margem própria", () => {
    const r = resolveMarginPolicy({
      product: { marginPct: 62, useCategoryMargin: true },
      category: { targetPct: 55, autoPolicy: true },
      fallbackTargetPct: FALLBACK,
    });
    expect(r.marginPct).toBe(55);
    expect(r.origin).toBe("category");
  });

  it("margem própria fora da faixa é limitada pela categoria e sinaliza auditoria", () => {
    const r = resolveMarginPolicy({
      product: { marginPct: 90, useCategoryMargin: false },
      category: { targetPct: 55, minPct: 25, maxPct: 70, autoPolicy: true },
      fallbackTargetPct: FALLBACK,
    });
    expect(r.marginPct).toBe(70);
    expect(r.clamped).toBe(true);
    expect(r.origin).toBe("product");
  });

  it("produto antigo sem margem e sem categoria mantém a política da empresa", () => {
    const r = resolveMarginPolicy({
      product: { marginPct: 0, useCategoryMargin: false },
      companyTargetPct: 33,
      fallbackTargetPct: FALLBACK,
    });
    expect(r.marginPct).toBe(33);
    expect(r.origin).toBe("company");
  });

  it("auditoria expõe rótulos pt-BR para todas as origens", () => {
    expect(MARGIN_ORIGIN_LABEL).toEqual({
      product: "Produto",
      category: "Categoria",
      company: "Empresa",
      fallback: "Padrão do sistema",
    });
  });

  it("categoryPolicyIsActive exige margem padrão e política ligada", () => {
    expect(categoryPolicyIsActive({ targetPct: 50, autoPolicy: true })).toBe(true);
    expect(categoryPolicyIsActive({ targetPct: 50, autoPolicy: false })).toBe(false);
    expect(categoryPolicyIsActive({ targetPct: null, autoPolicy: true })).toBe(false);
    expect(categoryPolicyIsActive(null)).toBe(false);
  });
});

describe("referências de mercado (Bella consultiva)", () => {
  const refs = [
    {
      categoryKey: "relogios",
      label: "Relógios",
      conservativePct: 35,
      commonPct: 55,
      premiumPct: 70,
      companyScoped: false,
    },
    {
      categoryKey: "relogios",
      label: "Relógios (nossa loja)",
      conservativePct: 40,
      commonPct: 58,
      premiumPct: 75,
      companyScoped: true,
    },
    {
      categoryKey: "bijuterias",
      label: "Bijuterias",
      conservativePct: 40,
      commonPct: 60,
      premiumPct: 75,
      companyScoped: false,
    },
  ];

  it("normaliza acentos e plural na chave", () => {
    expect(marketReferenceKey("Relógios")).toBe("relogios");
    expect(marketReferenceKey("Bolsa Social")).toBe("bolsa-social");
  });

  it("casa categoria por nome tolerando singular/plural e acento", () => {
    expect(findMarketReference(refs, "Relógio")?.categoryKey).toBe("relogios");
    expect(findMarketReference(refs, "bijuteria")?.label).toBe("Bijuterias");
  });

  it("referência da empresa sobrepõe a global", () => {
    expect(findMarketReference(refs, "Relógios")?.companyScoped).toBe(true);
  });

  it("sem referência conhecida não sugere nada", () => {
    expect(findMarketReference(refs, "Luminária de Mesa")).toBeNull();
    expect(findMarketReference(refs, "")).toBeNull();
  });
});
