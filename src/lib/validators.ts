import { z } from "zod";
import { digits } from "./masks";

/** Valida CPF (dígitos verificadores). */
export function isValidCPF(value: string): boolean {
  const d = digits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (base: number) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += Number(d[i]) * (base + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** Valida CNPJ (dígitos verificadores). */
export function isValidCNPJ(value: string): boolean {
  const d = digits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (base: number, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += Number(d[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(12, w1) === Number(d[12]) && calc(13, w2) === Number(d[13]);
}

/** Aceita string vazia ou CPF válido. */
export const cpfSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || isValidCPF(v), "CPF inválido");

/** Aceita string vazia ou CNPJ válido. */
export const cnpjSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || isValidCNPJ(v), "CNPJ inválido");

/** Aceita string vazia, CPF válido ou CNPJ válido. */
export const cpfCnpjSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => {
    if (!v) return true;
    const d = digits(v);
    if (d.length === 11) return isValidCPF(d);
    if (d.length === 14) return isValidCNPJ(d);
    return false;
  }, "CPF/CNPJ inválido");

/** Aceita telefone com 10 ou 11 dígitos, ou vazio. */
export const phoneSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => {
    if (!v) return true;
    const len = digits(v).length;
    return len === 10 || len === 11;
  }, "Telefone inválido");

/** Aceita CEP com 8 dígitos, ou vazio. */
export const cepSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || digits(v).length === 8, "CEP inválido");
