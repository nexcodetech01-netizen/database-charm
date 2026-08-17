import { describe, it, expect } from 'vitest';
import { ShippingCalculatorSchema } from '../types';

describe('ShippingCalculatorSchema Numeric Normalization', () => {
  it('should accept and normalize "0,8" to 0.8 for peso_kg', () => {
    const data = {
      cep_origem: "01001-000",
      cep_destino: "20040-002",
      peso_kg: "0,8",
      altura_cm: "11",
      largura_cm: "16",
      comprimento_cm: "20",
      valor_declarado: "0"
    };
    
    const result = ShippingCalculatorSchema.safeParse(data);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.peso_kg).toBe(0.8);
      expect(typeof result.data.peso_kg).toBe('number');
    }
  });

  it('should accept numeric strings with dot', () => {
    const data = {
      cep_origem: "01001-000",
      cep_destino: "20040-002",
      peso_kg: "0.5",
      altura_cm: 15,
      largura_cm: 20,
      comprimento_cm: 25,
      valor_declarado: 100
    };
    
    const result = ShippingCalculatorSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.peso_kg).toBe(0.5);
    }
  });

  it('should fail for empty numeric fields', () => {
    const data = {
      cep_origem: "01001-000",
      cep_destino: "20040-002",
      peso_kg: "",
      altura_cm: "11",
      largura_cm: "16",
      comprimento_cm: "20",
      valor_declarado: "0"
    };
    
    const result = ShippingCalculatorSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
