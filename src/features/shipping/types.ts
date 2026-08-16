import { z } from "zod";

export const ShippingCalculatorSchema = z.object({
  cep_origem: z.string().min(8, "CEP de origem inválido"),
  cep_destino: z.string().min(8, "CEP de destino inválido"),
  peso_kg: z.number().min(0.1, "Peso mínimo 0.1kg"),
  altura_cm: z.number().min(2, "Altura mínima 2cm"),
  largura_cm: z.number().min(11, "Largura mínima 11cm"),
  comprimento_cm: z.number().min(16, "Comprimento mínimo 16cm"),
  valor_declarado: z.number().optional().default(0),
});

export type ShippingCalculatorInput = z.infer<typeof ShippingCalculatorSchema>;

export interface ShippingOption {
  servico: string;
  transportadora: string;
  preco: number;
  prazo_dias: number;
}
