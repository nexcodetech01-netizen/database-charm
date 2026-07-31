/**
 * Finance v2 — Schemas Zod estritos das Skills (Sprint 006).
 * Todas em `.strict()` — bloqueia campos desconhecidos (exigido por BaseSkill).
 */
import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().trim().min(10).max(30);

export const financeCashSchema = z.object({}).strict();

export const financeReceivablesSchema = z
  .object({
    status: z.enum(["pending", "overdue", "paid", "partial", "cancelled"]).optional(),
    customerId: uuid.optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const financePayablesSchema = z
  .object({
    status: z.enum(["pending", "overdue", "paid", "cancelled"]).optional(),
    supplierId: uuid.optional(),
    categoryId: uuid.optional(),
    costCenterId: uuid.optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const financeForecastSchema = z
  .object({
    horizonDays: z.number().int().min(1).max(180).optional(),
  })
  .strict();

export const financeProLaboreSchema = z
  .object({
    reserveMonths: z.number().min(0).max(12).optional(),
  })
  .strict();

export const financeSummarySchema = z.object({}).strict();

// -------- Service-facing schemas (usados também pela camada de UI). --------
export const receivableCreateSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    amount: z.number().positive(),
    customerId: uuid.nullable().optional(),
    saleId: uuid.nullable().optional(),
    categoryId: uuid.nullable().optional(),
    accountId: uuid.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
    transactionDate: isoDate.nullable().optional(),
    interest: z.number().nonnegative().nullable().optional(),
    fine: z.number().nonnegative().nullable().optional(),
    discount: z.number().nonnegative().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    installments: z.number().int().min(1).max(120).nullable().optional(),
    installmentIntervalDays: z.number().int().min(1).max(365).nullable().optional(),
  })
  .strict();

export const payableCreateSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    amount: z.number().positive(),
    supplierId: uuid.nullable().optional(),
    purchaseId: uuid.nullable().optional(),
    categoryId: uuid.nullable().optional(),
    costCenterId: uuid.nullable().optional(),
    accountId: uuid.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
    transactionDate: isoDate.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export type FinanceCashPayload = z.infer<typeof financeCashSchema>;
export type FinanceReceivablesPayload = z.infer<typeof financeReceivablesSchema>;
export type FinancePayablesPayload = z.infer<typeof financePayablesSchema>;
export type FinanceForecastPayload = z.infer<typeof financeForecastSchema>;
export type FinanceProLaborePayload = z.infer<typeof financeProLaboreSchema>;
export type FinanceSummaryPayload = z.infer<typeof financeSummarySchema>;
export type ReceivableCreatePayload = z.infer<typeof receivableCreateSchema>;
export type PayableCreatePayload = z.infer<typeof payableCreateSchema>;
