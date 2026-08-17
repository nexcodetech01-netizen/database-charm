import { z } from "zod";

const preprocessNumeric = (val: unknown) => {
  if (typeof val === "string") {
    const normalized = val.replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
};

export const ShippingCalculatorSchema = z.object({
  cep_origem: z.string().min(8, "CEP de origem inválido"),
  cep_destino: z.string().min(8, "CEP de destino inválido"),
  peso_kg: z.preprocess(preprocessNumeric, z.number({ 
    required_error: "Peso é obrigatório",
    invalid_type_error: "Peso deve ser um número" 
  }).min(0.1, "Peso mínimo 0.1kg")),
  altura_cm: z.preprocess(preprocessNumeric, z.number({
    required_error: "Altura é obrigatória",
    invalid_type_error: "Altura deve ser um número"
  }).min(2, "Altura mínima 2cm")),
  largura_cm: z.preprocess(preprocessNumeric, z.number({
    required_error: "Largura é obrigatória",
    invalid_type_error: "Largura deve ser um número"
  }).min(11, "Largura mínima 11cm")),
  comprimento_cm: z.preprocess(preprocessNumeric, z.number({
    required_error: "Comprimento é obrigatório",
    invalid_type_error: "Comprimento deve ser um número"
  }).min(16, "Comprimento mínimo 16cm")),
  valor_declarado: z.preprocess(preprocessNumeric, z.number({
    required_error: "Valor seguro é obrigatório",
    invalid_type_error: "Valor seguro deve ser um número"
  }).min(0, "Valor mínimo R$ 0")),
});

export type ShippingCalculatorInput = z.infer<typeof ShippingCalculatorSchema>;

export interface ShippingOption {
  id: string; // The service ID for SuperFrete
  servico: string;
  transportadora: string;
  preco: number;
  prazo_dias: number;
}

export const AddressSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  document: z.string().min(11, "CPF/CNPJ inválido"),
  postal_code: z.string().min(8, "CEP inválido"),
  address: z.string().min(3, "Endereço inválido"),
  number: z.string().min(1, "Número obrigatório"),
  complement: z.string().optional(),
  district: z.string().min(2, "Bairro inválido"),
  city: z.string().min(2, "Cidade inválida"),
  state: z.string().length(2, "UF deve ter 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  invoice_number: z.string().optional(),
});

export type AddressInfo = z.infer<typeof AddressSchema>;

export const GenerateLabelSchema = z.object({
  quote_id: z.string().optional(),
  service_code: z.string(),
  sender: AddressSchema,
  recipient: AddressSchema,
  package_details: ShippingCalculatorSchema,
});

export type GenerateLabelInput = z.infer<typeof GenerateLabelSchema>;

export interface LabelResult {
  success: boolean;
  order_id?: string;
  tracking_code?: string;
  label_url?: string;
  error?: string;
}
