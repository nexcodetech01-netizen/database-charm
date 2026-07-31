/**
 * AIResponse.v1 — contrato canônico de resposta ao usuário.
 * Toda saída da Bella IA passa por este schema (guardrail 9.3).
 */
import { z } from "zod";

export const RESPONSE_VERSION = "AIResponse.v1" as const;

export const aiSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pricing.explain"),
    explainId: z.string().min(1),
    toolCall: z.string().min(1),
  }),
  z.object({
    kind: z.literal("usecase"),
    useCase: z.string().min(1),
    toolCall: z.string().min(1),
    traceId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("context"),
    label: z.string().min(1),
    freshnessSec: z.number().nonnegative(),
  }),
]);
export type AISource = z.infer<typeof aiSourceSchema>;

export const aiWarningSchema = z.object({
  code: z.enum([
    "missing_cost",
    "missing_policy",
    "stale_data",
    "low_confidence",
    "insufficient_context",
    "guardrail_triggered",
    "intent_not_supported",
    "tool_error",
  ]),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type AIWarning = z.infer<typeof aiWarningSchema>;

export const aiSuggestedActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  intent: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  requiresApproval: z.boolean(),
  scopes: z.array(z.string()),
});
export type AISuggestedAction = z.infer<typeof aiSuggestedActionSchema>;

export const engineVersionsSchema = z.object({
  engineVersion: z.string(),
  calculationVersion: z.string(),
  policyVersion: z.string(),
  contextVersion: z.string().optional(),
  explainId: z.string(),
});
export type EngineVersions = z.infer<typeof engineVersionsSchema>;

export const aiResponseSchema = z.object({
  version: z.literal(RESPONSE_VERSION),
  summary: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(aiSourceSchema),
  actions: z.array(aiSuggestedActionSchema),
  warnings: z.array(aiWarningSchema),
  suggestedQuestions: z.array(z.string()),
  traceId: z.string().min(1),
  engineVersions: engineVersionsSchema.optional(),
});
export type AIResponse = z.infer<typeof aiResponseSchema>;
