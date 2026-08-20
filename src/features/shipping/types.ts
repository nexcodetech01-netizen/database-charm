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
  cep_origem: z.string()
    .min(8, "CEP muito curto")
    .regex(/^\d{5}-\d{3}$|^\d{8}$/, "CEP de origem inválido. Use o formato 00000-000"),
  cep_destino: z.string()
    .min(8, "CEP muito curto")
    .regex(/^\d{5}-\d{3}$|^\d{8}$/, "CEP de destino inválido. Use o formato 00000-000"),
  peso_kg: z.preprocess(preprocessNumeric, z.number({ 
    required_error: "Peso é obrigatório",
    invalid_type_error: "Peso deve ser um número" 
  }).min(0.01, "Peso mínimo 0.01kg").max(30, "Peso máximo 30kg")),
  altura_cm: z.preprocess(preprocessNumeric, z.number({
    required_error: "Altura é obrigatória",
    invalid_type_error: "Altura deve ser um número"
  }).min(2, "Altura mínima 2cm").max(105, "Altura máxima 105cm")),
  largura_cm: z.preprocess(preprocessNumeric, z.number({
    required_error: "Largura é obrigatória",
    invalid_type_error: "Largura deve ser um número"
  }).min(11, "Largura mínima 11cm").max(105, "Largura máxima 105cm")),
  comprimento_cm: z.preprocess(preprocessNumeric, z.number({
    required_error: "Comprimento é obrigatório",
    invalid_type_error: "Comprimento deve ser um número"
  }).min(16, "Comprimento mínimo 16cm").max(105, "Comprimento máxima 105cm")),
  format: z.string().default("3"),
  valor_declarado: z.preprocess(preprocessNumeric, z.number({
    required_error: "Valor seguro é obrigatório",
    invalid_type_error: "Valor seguro deve ser um número"
  }).min(0, "Valor mínimo R$ 0").max(10000, "Valor máximo R$ 10.000")),
});

export type ShippingCalculatorInput = {
  cep_origem: string;
  cep_destino: string;
  peso_kg: number;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
  format: string;
  valor_declarado: number;
};

export interface ShippingOption {
  id: string | number; // The service ID for SuperFrete
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
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().min(10, "Telefone inválido"),
  invoice_number: z.string().optional(),
});

export type AddressInfo = z.infer<typeof AddressSchema>;

export const GenerateLabelSchema = z.object({
  quote_id: z.string().optional(),
  service_code: z.union([z.string(), z.number()]),
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
