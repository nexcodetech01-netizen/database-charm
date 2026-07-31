/**
 * Fiscal v2 — Zod schemas (Sprint 007).
 *
 * TODOS os schemas de Skills DEVEM ser `.strict()` — o BaseSkill valida
 * runtime e rejeita campos desconhecidos.
 */
import { z } from "zod";
import { fiscalEnvironmentSchema } from "../types/environment";

export const fiscalIssueSchema = z
  .object({
    saleId: z.string().uuid("saleId inválido"),
    environment: fiscalEnvironmentSchema.optional(),
    force: z.boolean().optional(),
  })
  .strict();

export type FiscalIssueInput = z.infer<typeof fiscalIssueSchema>;

export const fiscalStatusSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    accessKey: z.string().min(44).max(44).optional(),
    saleId: z.string().uuid().optional(),
  })
  .strict();

export type FiscalStatusInput = z.infer<typeof fiscalStatusSchema>;

export const fiscalCancelSchema = z
  .object({
    documentId: z.string().uuid(),
    reason: z.string().min(15, "Justificativa deve ter no mínimo 15 caracteres").max(255),
  })
  .strict();

export type FiscalCancelInput = z.infer<typeof fiscalCancelSchema>;

export const fiscalSearchSchema = z
  .object({
    status: z
      .enum([
        "draft",
        "validating",
        "signing",
        "sending",
        "authorized",
        "rejected",
        "cancelled",
        "error",
      ])
      .optional(),
    saleId: z.string().uuid().optional(),
    accessKey: z.string().min(44).max(44).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export type FiscalSearchInput = z.infer<typeof fiscalSearchSchema>;
