/**
 * Sales v2 — Schemas Zod (strict) das Skills (Sprint 005).
 *
 * Contratos rígidos exigidos pelo `defineBaseSkill`. Nenhum campo
 * livre é aceito; validações de negócio adicionais são feitas nos
 * Services (RLS + regras).
 */
import { z } from "zod";

const uuid = z.string().uuid();

export const saleItemInputSchema = z
  .object({
    productId: uuid,
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative().nullable().optional(),
    discount: z.number().nonnegative().nullable().optional(),
    description: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

/** sale.create — cria pedido/orçamento. */
export const saleCreateSchema = z
  .object({
    customerId: uuid.nullable().optional(),
    status: z
      .enum(["draft", "quotation", "approved", "reserved", "invoiced"])
      .optional(),
    items: z.array(saleItemInputSchema).min(1).max(200),
    discount: z.number().nonnegative().optional(),
    shipping: z.number().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
    saleDate: z.string().trim().min(10).max(30).optional(),
  })
  .strict();

/** sale.search — lista/filtra pedidos. */
export const saleSearchSchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    customerId: uuid.optional(),
    status: z
      .enum(["draft", "quotation", "approved", "reserved", "invoiced", "cancelled"])
      .optional(),
    dateFrom: z.string().trim().min(10).max(30).optional(),
    dateTo: z.string().trim().min(10).max(30).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

/** sale.cancel — cancela pedido. */
export const saleCancelSchema = z
  .object({
    saleId: uuid,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/** sale.quote — cria orçamento (atalho de saleCreate com status forçado). */
export const saleQuoteSchema = z
  .object({
    customerId: uuid.nullable().optional(),
    items: z.array(saleItemInputSchema).min(1).max(200),
    discount: z.number().nonnegative().optional(),
    shipping: z.number().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

/** sale.margin — analisa margem de venda(s). */
export const saleMarginSchema = z
  .object({
    saleId: uuid.optional(),
    dateFrom: z.string().trim().min(10).max(30).optional(),
    dateTo: z.string().trim().min(10).max(30).optional(),
  })
  .strict();

/** sale.best_customer — ranking de clientes por receita. */
// BUG ENCONTRADO E CORRIGIDO (2026-08-31): esse schema tem todos os
// campos OPCIONAIS (dateFrom/dateTo/limit), mas terminava com
// `.strict()` — isso faz o Zod REJEITAR a chamada inteira se vier
// QUALQUER campo a mais que o esperado, mesmo que os campos certos já
// estejam corretos. Como a Bella extrai parâmetros via IA generativa
// (não é sempre 100% previsível o que ela inclui), uma pergunta
// simples como "quem mais compra" — que não precisa de nenhum
// parâmetro — podia falhar com "Alguns campos precisam ser
// corrigidos" só porque a IA incluiu algum campo extra inofensivo.
// Removido o `.strict()`: agora campos extras são simplesmente
// ignorados (comportamento padrão do Zod), sem risco nenhum aqui —
// essa consulta é só leitura, não existe campo extra que pudesse
// causar dano.
export const saleBestCustomerSchema = z.object({
    dateFrom: z.string().trim().min(10).max(30).optional(),
    dateTo: z.string().trim().min(10).max(30).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  });

export type SaleCreatePayload = z.infer<typeof saleCreateSchema>;
export type SaleSearchPayload = z.infer<typeof saleSearchSchema>;
export type SaleCancelPayload = z.infer<typeof saleCancelSchema>;
export type SaleQuotePayload = z.infer<typeof saleQuoteSchema>;
export type SaleMarginPayload = z.infer<typeof saleMarginSchema>;
export type SaleBestCustomerPayload = z.infer<typeof saleBestCustomerSchema>;
