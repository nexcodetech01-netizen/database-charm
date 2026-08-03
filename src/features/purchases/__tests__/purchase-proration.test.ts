import { describe, it, expect } from 'vitest';

/**
 * Simulação manual da lógica de rateio proporcional ao valor (Regra de Negócio)
 */
function calculateProration(
  items: { qty: number, price: number }[], 
  extraCosts: number
) {
  const itemsBase = items.reduce((sum, it) => sum + (it.qty * it.price), 0);
  
  return items.map(it => {
    const share = itemsBase > 0 ? (it.qty * it.price) / itemsBase : 0;
    const proratedUnit = itemsBase > 0 ? (extraCosts * share) / it.qty : 0;
    return Number(proratedUnit.toFixed(6));
  });
}

describe('Purchase Proration Engine', () => {
  it('should handle zero freight', () => {
    const results = calculateProration([{ qty: 10, price: 100 }], 0);
    expect(results[0]).toBe(0);
  });

  it('should handle single product proration', () => {
    // 10 un a R$ 100 = R$ 1000 total. Frete R$ 50. 
    // Rateio deve ser R$ 5 por unidade.
    const results = calculateProration([{ qty: 10, price: 100 }], 50);
    expect(results[0]).toBe(5);
  });

  it('should handle multiple products with different values', () => {
    const items = [
      { qty: 2, price: 100 }, // Total 200 (2/3 da base de 300)
      { qty: 1, price: 100 }, // Total 100 (1/3 da base de 300)
    ];
    const freight = 30; // 2/3 de 30 = 20 (R$ 10/un). 1/3 de 30 = 10 (R$ 10/un).
    const results = calculateProration(items, freight);
    
    expect(results[0]).toBe(10); // 20 / 2 = 10
    expect(results[1]).toBe(10); // 10 / 1 = 10
  });

  it('should handle rounding in complex shares', () => {
    const items = [
      { qty: 3, price: 10 }, // Total 30
      { qty: 1, price: 70 }, // Total 70. Base 100.
    ];
    const freight = 15;
    // Item 1: 30% de 15 = 4.5. Unitario = 4.5 / 3 = 1.5
    // Item 2: 70% de 15 = 10.5. Unitario = 10.5 / 1 = 10.5
    const results = calculateProration(items, freight);
    
    expect(results[0]).toBe(1.5);
    expect(results[1]).toBe(10.5);
  });
});
