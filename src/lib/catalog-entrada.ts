/**
 * Validação de entrada do endpoint público de cobrança do catálogo
 * (`/api/public/catalog/entrada`). Módulo puro — testável isoladamente.
 */
import { z } from "zod";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const entradaRequestSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-]*$/i, "slug inválido"),
  productId: z.string().trim().regex(UUID, "productId inválido"),
  buyerName: z.string().trim().min(2).max(120),
  buyerEmail: z.string().trim().email().max(180).optional(),
  buyerPhone: z
    .string()
    .trim()
    .regex(/^\+?\d{10,15}$/, "telefone inválido")
    .optional(),
});

export type EntradaRequest = z.infer<typeof entradaRequestSchema>;

export type EntradaParseResult = { ok: true; data: EntradaRequest } | { ok: false; error: string };

/** Normaliza campos vazios em `undefined` antes de validar. */
export function parseEntradaRequest(raw: unknown): EntradaParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "invalid_body" };
  }
  const input = raw as Record<string, unknown>;
  const candidate = {
    slug: input.slug,
    productId: input.productId,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail === "" || input.buyerEmail == null ? undefined : input.buyerEmail,
    buyerPhone: input.buyerPhone === "" || input.buyerPhone == null ? undefined : input.buyerPhone,
  };

  const parsed = entradaRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.[0];
    return { ok: false, error: field ? `invalid_${String(field)}` : "invalid_params" };
  }
  return { ok: true, data: parsed.data };
}

/** Referência externa determinística — base da idempotência da cobrança. */
export function buildExternalReference(
  collectionId: string,
  productId: string,
  buyerName: string,
): string {
  const buyer = buyerName.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  return `catalog:${collectionId}:${productId}:${buyer}`;
}
