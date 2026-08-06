import { describe, it, expect } from "vitest";
import { calculateMLFinalPrice, calculateMLNetValue, DEFAULT_ML_SETTINGS } from "../ml-pricing";
import { validateMercadoLivreRequirements } from "../ml-validation";

describe("MercadoLivre Pricing Logic (ml-pricing.ts)", () => {
  it("should calculate correct final price for Premium >= R$ 79", () => {
    // Desejado R$ 183.90
    // (183.90 + 24.65) / 0.85 = 245.3529... -> 245.36
    const desired = 183.90;
    const final = calculateMLFinalPrice(desired, "gold_pro");
    expect(final).toBe(245.36);
    
    // Verificação reversa
    const net = calculateMLNetValue(final, "gold_pro");
    // 245.36 * 0.85 - 24.65 = 208.556 - 24.65 = 183.906
    expect(net).toBeGreaterThanOrEqual(desired);
    expect(net).toBeLessThan(desired + 0.02);
  });

  it("should calculate correct final price for Classic < R$ 79 (with Fixed Fee)", () => {
    // Desejado R$ 30.00
    // No Clássico: (30 + 6.50) / (1 - 0.135) = 36.50 / 0.865 = 42.1965... -> 42.20
    const desired = 30.00;
    const final = calculateMLFinalPrice(desired, "gold_special");
    expect(final).toBe(42.20);

    const net = calculateMLNetValue(final, "gold_special");
    // 42.20 * 0.865 - 6.50 = 36.503 - 6.50 = 30.003
    expect(net).toBeGreaterThanOrEqual(desired);
  });

  it("should handle the threshold boundary exactly", () => {
    // Threshold is 79.
    // If net value is such that price is 78.99 -> no free shipping, but fixed fee applies if classic.
    // If net value is such that price is 79.00 -> free shipping applies.
    
    const settings = { ...DEFAULT_ML_SETTINGS };
    
    // Case 1: Premium at threshold
    // Price = 79.00. Net = 79 * 0.85 - 24.65 = 67.15 - 24.65 = 42.50
    expect(calculateMLNetValue(79.00, "gold_pro", settings)).toBeCloseTo(42.50, 2);
    
    // Case 2: Premium just below threshold
    // Price = 78.99. Net = 78.99 * 0.85 - 0 = 67.1415
    expect(calculateMLNetValue(78.99, "gold_pro", settings)).toBeCloseTo(67.1415, 4);
  });
});

describe("MercadoLivre Integration Validation", () => {
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

  it("should fail validation if price is insufficient", () => {
    // Premium + Price 30.00 -> Shipping 0 (since < 79)
    // Net = 30 * 0.85 - 0 = 25.50 (Valid)
    
    // If we force price to be 80, but net should have been higher:
    // Actually the validation checks if net > 0.
    // Let's find a case where net < 0.
    // If price = 25 and it's gold_pro (Premium), but somehow it was forced to trigger shipping? 
    // Wait, the validation logic in ml-validation.ts has hardcoded 79.
    
    const result = validateMercadoLivreRequirements({
      ...baseProduct,
      price: 10,
      listingType: "gold_pro"
    });
    
    // 10 * 0.85 - 0 = 8.5 > 0 -> Valid.
    expect(result.requirements.find(r => r.id === "price_formula")?.isValid).toBe(true);

    // If price = 80, but we want it to be invalid? 
    // 80 * 0.85 - 24.65 = 68 - 24.65 = 43.35 > 0.
    
    // To get net < 0:
    // Price = 28, if it triggered shipping: 28 * 0.85 - 24.65 = 23.8 - 24.65 = -0.85
    // But shipping only triggers >= 79.
    
    // So the only way to get net < 0 is if the price is extremely low, like R$ 1.00 in Classic:
    // 1.00 * (1-0.135) - 6.50 = 0.865 - 6.50 = -5.635
    const resultClassic = validateMercadoLivreRequirements({
      ...baseProduct,
      price: 1,
      listingType: "gold_special"
    });
    expect(resultClassic.requirements.find((r: any) => r.id === "price_formula")?.isValid).toBe(false);
  });
});
