/**
 * SessionContext.v1 — memória volátil da conversa (AI-004).
 *
 * REGRA CENTRAL: **nada** aqui é persistido. A memória vive apenas em
 * `Map` no processo, expira por TTL e é apagada em logout / troca de
 * empresa / fim de sessão.
 *
 * Guarda somente REFERÊNCIAS leves — IDs, nomes, timestamps — não DTOs
 * completos, para minimizar superfície de vazamento e evitar
 * "cache" acidental de dados de domínio.
 */
import { z } from "zod";

export const SESSION_CONTEXT_VERSION = "SessionContext.v1" as const;

/** Tipos de referência que o ReferenceResolver pode identificar. */
export const REFERENCE_TYPES = [
  "product",
  "category",
  "policy",
  "dashboard",
  "simulation",
  "action",
  "workflow",
  "repeat",
  "confirm",
  "cancel",
  "none",
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

/** Slot leve — apenas ID + rótulo + timestamp. */
export const sessionRefSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  at: z.string().min(1), // ISO timestamp de quando foi registrado
});
export type SessionRef = z.infer<typeof sessionRefSchema>;

/**
 * Referência a ação/workflow — inclui `executed` para bloquear
 * re-execução silenciosa (guardrail obrigatório).
 */
export const sessionActionRefSchema = sessionRefSchema.extend({
  proposalId: z.string().min(1),
  executed: z.boolean(),
});
export type SessionActionRef = z.infer<typeof sessionActionRefSchema>;

export const sessionContextSchema = z.object({
  version: z.literal(SESSION_CONTEXT_VERSION),
  sessionId: z.string().min(1),
  companyId: z.string().min(1),
  userId: z.string().optional(),
  createdAt: z.string().min(1),
  lastUsedAt: z.string().min(1),
  lastProduct: sessionRefSchema.optional(),
  lastCategory: sessionRefSchema.optional(),
  lastPolicy: sessionRefSchema.optional(),
  lastDashboard: sessionRefSchema.optional(),
  lastSimulation: sessionRefSchema.optional(),
  lastAction: sessionActionRefSchema.optional(),
  lastWorkflow: sessionActionRefSchema.optional(),
});
export type SessionContext = z.infer<typeof sessionContextSchema>;

/** Patch aceito por `remember` — sempre parcial e opcional. */
export type SessionContextPatch = Partial<
  Pick<
    SessionContext,
    | "lastProduct"
    | "lastCategory"
    | "lastPolicy"
    | "lastDashboard"
    | "lastSimulation"
    | "lastAction"
    | "lastWorkflow"
  >
>;

/** Auditoria de resolução — emitida no AIInteractionEvent. */
export interface SessionResolutionAudit {
  readonly contextResolved: boolean;
  readonly referenceType: ReferenceType;
  readonly sessionId: string;
  readonly contextAgeMs: number;
  readonly reason?: string;
}
