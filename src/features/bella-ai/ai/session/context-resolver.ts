/**
 * ContextResolver — junta ReferenceResolver + SessionMemory e devolve:
 *   - `enrichedSlots`: slots a serem mesclados na Intent detectada
 *   - `audit`: metadados (contextResolved, referenceType, sessionId,
 *     contextAgeMs) para o AIInteractionEvent
 *   - `guard`: resultado do guardrail (tenant + ação já executada)
 *
 * Não modifica Intent original nem toca em Use Cases — só entrega
 * um envelope. O caller (orchestrator ou wrappers de action/workflow)
 * decide como usar os slots enriquecidos.
 */
import type { SessionContext, SessionResolutionAudit } from "./contracts";
import {
  guardActionReuse,
  guardTenant,
  guardWorkflowReuse,
  type SessionGuardResult,
} from "./guardrails";
import type { SessionMemory, SessionScope } from "./memory";
import { resolveReference } from "./reference-resolver";

export interface ContextResolveInput {
  readonly text: string;
  readonly scope: SessionScope;
}

export interface ContextResolveOutput {
  readonly enrichedSlots: Record<string, unknown>;
  readonly audit: SessionResolutionAudit;
  readonly guard: SessionGuardResult;
  readonly context?: SessionContext;
}

export interface ContextResolver {
  resolve(input: ContextResolveInput): ContextResolveOutput;
}

export function createContextResolver(memory: SessionMemory): ContextResolver {
  return {
    resolve({ text, scope }) {
      const referenceType = resolveReference(text);
      const ctx = memory.get(scope);
      const contextAgeMs = ctx ? memory.ageMs(ctx) : 0;

      if (!ctx) {
        return {
          enrichedSlots: {},
          audit: {
            contextResolved: false,
            referenceType,
            sessionId: scope.sessionId,
            contextAgeMs: 0,
            reason: "no_context",
          },
          guard: { ok: true, code: "ok" },
          context: undefined,
        };
      }

      // Defesa em profundidade — memory.get já isola, mas re-checamos.
      const tenant = guardTenant(ctx, scope.companyId);
      if (!tenant.ok) {
        return {
          enrichedSlots: {},
          audit: {
            contextResolved: false,
            referenceType,
            sessionId: scope.sessionId,
            contextAgeMs,
            reason: tenant.code,
          },
          guard: tenant,
          context: undefined,
        };
      }

      const slots: Record<string, unknown> = {};
      let resolved = false;

      switch (referenceType) {
        case "product":
          if (ctx.lastProduct) {
            slots.productId = ctx.lastProduct.id;
            resolved = true;
          }
          break;
        case "category":
          if (ctx.lastCategory) {
            slots.categoryId = ctx.lastCategory.id;
            resolved = true;
          }
          break;
        case "policy":
          if (ctx.lastPolicy) {
            slots.policyId = ctx.lastPolicy.id;
            resolved = true;
          }
          break;
        case "dashboard":
          if (ctx.lastDashboard) resolved = true;
          break;
        case "simulation":
          if (ctx.lastSimulation) {
            slots.simulationId = ctx.lastSimulation.id;
            resolved = true;
          }
          break;
        case "action":
        case "confirm": {
          const g = guardActionReuse(ctx);
          if (!g.ok) {
            return {
              enrichedSlots: {},
              audit: {
                contextResolved: false,
                referenceType,
                sessionId: scope.sessionId,
                contextAgeMs,
                reason: g.code,
              },
              guard: g,
              context: ctx,
            };
          }
          slots.actionProposalId = ctx.lastAction!.proposalId;
          slots.actionId = ctx.lastAction!.id;
          resolved = true;
          break;
        }
        case "workflow": {
          const g = guardWorkflowReuse(ctx);
          if (!g.ok) {
            return {
              enrichedSlots: {},
              audit: {
                contextResolved: false,
                referenceType,
                sessionId: scope.sessionId,
                contextAgeMs,
                reason: g.code,
              },
              guard: g,
              context: ctx,
            };
          }
          slots.workflowProposalId = ctx.lastWorkflow!.proposalId;
          slots.workflowId = ctx.lastWorkflow!.id;
          resolved = true;
          break;
        }
        case "cancel":
          // Cancel não enriquece slots — só marca intenção. Executor
          // de action/workflow trata "cancelar" com o proposalId
          // fornecido pela UI, não pela memória (evita cancelar
          // proposta errada).
          resolved = Boolean(ctx.lastAction || ctx.lastWorkflow);
          break;
        case "repeat":
          // "Repete" mantém intent original — apenas sinaliza reuso
          // de contexto, sem executar mutação.
          resolved = true;
          break;
        case "none":
        default:
          resolved = false;
          break;
      }

      return {
        enrichedSlots: slots,
        audit: {
          contextResolved: resolved,
          referenceType,
          sessionId: scope.sessionId,
          contextAgeMs,
        },
        guard: { ok: true, code: "ok" },
        context: ctx,
      };
    },
  };
}
