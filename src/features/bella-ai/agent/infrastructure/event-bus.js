/**
 * Event Bus — wrapper fino em cima do BellaEventEngine existente.
 * Padroniza payloads (apenas IDs + contexto pré-validado; nunca
 * credenciais) e propaga requestId para correlação.
 */
import { bellaEventEngine } from "../../events";
import { sanitizeForAudit } from "./sanitizer";
import { logger } from "./logger";
export async function emitAgentEvent(input) {
    try {
        const safePayload = sanitizeForAudit({
            ...input.payload,
            requestId: input.ctx.request.requestId,
            event_id: input.ctx.request.requestId, // Injeta event_id explicitamente
            company_id: input.ctx.companyId, // Injeta company_id explicitamente
            channel: input.ctx.request.channel,
            userId: input.ctx.userId,
        });
        bellaEventEngine.emit({
            type: input.type,
            tenantId: input.ctx.companyId,
            payload: safePayload,
            severity: input.severity,
            title: input.title,
            description: input.description,
            source: `agent:${input.ctx.request.channel}`,
        });
    }
    catch (err) {
        logger.warn("event.emit_failed", {
            requestId: input.ctx.request.requestId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
