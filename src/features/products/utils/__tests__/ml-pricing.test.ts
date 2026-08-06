import { describe, it, expect } from "vitest";
import { validateMercadoLivreRequirements } from "./ml-validation";

describe("MercadoLivre Pricing Validation (with shipping and fees)", () => {
  // Configurações atuais:
  // Frete Grátis: R$ 24,65 (para produtos >= R$ 79)
  // Taxa Fixa: R$ 6,50 (apenas Clássico < R$ 79)
  // Comissão Clássico: 13,5%
  // Comissão Premium: 15%

  const baseProduct = {
    id: "test-prod",
    name: "Produto de Teste Longo o Suficiente para SEO",
    price: 0,
    categoryId: "MLB123",
    selectedPhotoPaths: ["photo.jpg"],
    ncm: "12345678",
    weight: 1,
    length: 10,
    width: 10,
    height: 10,
    brand: "Generica",
    model: "X1",
  };

  it("should validate Premium formula correctly for product >= R$ 79 (Free Shipping)", () => {
    // Exemplo: Preço R$ 100
    // Comissão (15%): R$ 15
    // Frete: R$ 24,65
    // Líquido: 100 - 15 - 24,65 = 60,35 (Válido)
    const result = validateMercadoLivreRequirements({
      ...baseProduct,
      price: 100,
      listingType: "gold_pro"
    });
    
    const formulaReq = result.requirements.find(r => r.id === "price_formula");
    expect(formulaReq?.isValid).toBe(true);
  });

  it("should fail if price is too low to cover Premium fees + Free Shipping", () => {
    // Exemplo: Preço R$ 80
    // Comissão (15%): R$ 12
    // Frete: R$ 24,65
    // Líquido: 80 - 12 - 24,65 = 43,35 (Ainda positivo, mas e se fosse menor?)
    
    // Um preço que quebra: R$ 25 (impossível pois >=79 gatilha frete, mas vamos testar a lógica da fórmula)
    // Se o preço fosse R$ 28 e gatilhasse frete de 24.65:
    // 28 - (28 * 0.15) - 24.65 = 28 - 4.2 - 24.65 = -0.85
    const result = validateMercadoLivreRequirements({
      ...baseProduct,
      price: 28,
      listingType: "gold_pro"
    });

    const formulaReq = result.requirements.find(r => r.id === "price_formula");
    expect(formulaReq?.isValid).toBe(false);
  });

  it("should validate Classic formula with Fixed Fee for price < R$ 79", () => {
    // Exemplo: Preço R$ 50
    // Comissão (13.5%): R$ 6.75
    // Taxa Fixa: R$ 6,50
    // Frete: R$ 0
    // Líquido: 50 - 6.75 - 6.50 = 36.75
    const result = validateMercadoLivreRequirements({
      ...baseProduct,
      price: 50,
      listingType: "gold_special"
    });

    const formulaReq = result.requirements.find(r => r.id === "price_formula");
    expect(formulaReq?.isValid).toBe(true);
  });

  it("should handle cent rounding scenarios correctly (Math.ceil)", () => {
    // Simulação do cálculo do diálogo: (Desejado + Frete) / 0.85
    // Se desejado R$ 183.90 e Frete R$ 24.65
    // (183.90 + 24.65) / 0.85 = 208.55 / 0.85 = 245.35294...
    // Arredondado para cima: 245.36 (ou 245.35 dependendo da implementação exata de centavos)
    
    const desired = 183.90;
    const shipping = 24.65;
    const calculated = (desired + shipping) / 0.85;
    const rounded = Math.ceil(calculated * 100) / 100;
    
    expect(rounded).toBe(245.36);

    const result = validateMercadoLivreRequirements({
      ...baseProduct,
      price: rounded,
      listingType: "gold_pro"
    });
    
    expect(result.requirements.find(r => r.id === "price_formula")?.isValid).toBe(true);
  });
});
