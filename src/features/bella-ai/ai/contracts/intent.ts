/**
 * AIIntent.v1 — contrato canônico de intenção.
 * Fase 1: apenas intents commercial.*.
 */
import { z } from "zod";

export const SUPPORTED_INTENTS = [
  "commercial.dashboard",
  "commercial.product.explain",
  "commercial.category",
  "commercial.company",
  "commercial.pricing.simulate",
  "unknown",
] as const;

export type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];

export const INTENT_VERSION = "AIIntent.v1" as const;

export const aiIntentSchema = z.object({
  version: z.literal(INTENT_VERSION),
  intent: z.enum(SUPPORTED_INTENTS),
  domain: z.literal("commercial").or(z.literal("unknown")),
  action: z.string(),
  slots: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  source: z.enum(["deterministic", "llm"]),
  raw: z.string(),
});

export type AIIntent = z.infer<typeof aiIntentSchema>;
