/**
 * Política de expiração da SessionContext (AI-004).
 *
 * Contexto expira por:
 *   - TTL absoluto (default 30 min)
 *   - Ociosidade (default 15 min sem uso)
 *   - Eventos externos: logout, troca de empresa (chamadores usam
 *     `SessionMemory.clearByCompany` / `clearByUser`).
 *
 * Nunca há renovação silenciosa em contexto de outra empresa — o
 * `SessionMemory` já rejeita leitura cross-tenant.
 */
export interface ExpirationPolicy {
  readonly maxAgeMs: number;
  readonly maxIdleMs: number;
}

export const DEFAULT_EXPIRATION: ExpirationPolicy = {
  maxAgeMs: 30 * 60 * 1000,
  maxIdleMs: 15 * 60 * 1000,
};

export function contextAgeMs(ctx: { createdAt: string }, nowIso: string): number {
  return Math.max(0, Date.parse(nowIso) - Date.parse(ctx.createdAt));
}

export function contextIdleMs(
  ctx: { lastUsedAt: string },
  nowIso: string,
): number {
  return Math.max(0, Date.parse(nowIso) - Date.parse(ctx.lastUsedAt));
}

export function isExpired(
  ctx: { createdAt: string; lastUsedAt: string },
  nowIso: string,
  policy: ExpirationPolicy = DEFAULT_EXPIRATION,
): boolean {
  return (
    contextAgeMs(ctx, nowIso) >= policy.maxAgeMs ||
    contextIdleMs(ctx, nowIso) >= policy.maxIdleMs
  );
}
