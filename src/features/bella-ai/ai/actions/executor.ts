/**
 * Action Executor + Confirmation Flow.
 *
 * Fluxo:
 *   1. `propose(actionId, input, sessionCtx)`
 *      → aplica guardrails de request
 *      → chama `ActionDefinition.buildProposal`
 *      → devolve `ActionProposal`
 *      → emite `AIInteractionEvent` (actionExecuted=false)
 *
 *   2. `confirm(proposal, input, sessionCtx, { confirmed: true })`
 *      → aplica guardrails de confirmação
 *      → chama `ActionDefinition.execute` (via Application Layer)
 *      → devolve `ActionExecutionResult`
 *      → emite `AIInteractionEvent` (actionExecuted=true) — respeitando
 *        `alreadyAudited` para não duplicar registros (RegisterPricingDecision).
 *
 *   3. `cancel(proposal, sessionCtx)`
 *      → nenhuma execução, apenas audit trail.
 *
 * Nenhuma etapa toca Supabase, engine ou repositories diretamente — tudo passa
 * pelo `ActionRegistry` → `ToolExecutors` → Application Layer.
 */
import {
  EVENT_VERSION,
  noopAuditSink,
  type AIInteractionAction,
  type AIInteractionEvent,
  type AuditSink,
} from "../contracts";
import type { OrchestratorClock } from "../orchestrator";
import { systemOrchestratorClock } from "../orchestrator";
import {
  ACTION_RESULT_VERSION,
  actionProposalSchema,
  type ActionExecutionResult,
  type ActionProposal,
  type SafeActionId,
} from "./contracts";
import {
  guardActionConfirmation,
  guardActionRequest,
  type ActionGuardResult,
} from "./guardrails";
import type { ActionRegistry } from "./registry";
import { refusalMissingData, refusalToolError } from "../formatter";
import type { AIIntent, AIResponse } from "../contracts";
import { INTENT_VERSION } from "../contracts";

export interface ActionExecutorDeps {
  readonly registry: ActionRegistry;
  readonly audit?: AuditSink;
  readonly clock?: OrchestratorClock;
}

export interface ActionSessionCtx {
  readonly companyId: string;
  readonly userId?: string;
}

export interface ProposeInput {
  readonly actionId: string;
  readonly payload: Record<string, unknown>;
}

export interface ConfirmInput {
  readonly proposal: ActionProposal;
  readonly confirmed: boolean;
}

export interface ProposeOutput {
  readonly proposal?: ActionProposal;
  readonly refusal?: AIResponse;
  readonly event: AIInteractionEvent;
  readonly guard: ActionGuardResult;
}

export interface ExecuteOutput {
  readonly result: ActionExecutionResult;
  readonly refusal?: AIResponse;
  readonly event: AIInteractionEvent;
  readonly guard: ActionGuardResult;
}

function actionIntent(actionId: string): AIIntent {
  return {
    version: INTENT_VERSION,
    intent: "unknown",
    domain: "commercial",
    action: `action.${actionId}`,
    slots: {},
    confidence: 1,
    source: "deterministic",
    raw: `action:${actionId}`,
  };
}

function makeEvent(args: {
  clock: OrchestratorClock;
  session: ActionSessionCtx;
  actionId: string;
  response: AIResponse;
  action: AIInteractionAction;
  guardStatus: "pass" | "block";
  guardDetail?: string;
  traceId: string;
}): AIInteractionEvent {
  return {
    version: EVENT_VERSION,
    traceId: args.traceId,
    occurredAt: args.clock.nowIso(),
    userId: args.session.userId,
    companyId: args.session.companyId,
    intent: actionIntent(args.actionId),
    toolCalls: [],
    response: args.response,
    guardrails: [
      {
        rule: "actions.safe_action_allow_list",
        status: args.guardStatus,
        detail: args.guardDetail,
      },
    ],
    action: args.action,
  };
}

export function createActionExecutor(deps: ActionExecutorDeps) {
  const audit = deps.audit ?? noopAuditSink;
  const clock = deps.clock ?? systemOrchestratorClock;

  return {
    async propose(
      input: ProposeInput,
      session: ActionSessionCtx,
    ): Promise<ProposeOutput> {
      const traceId = clock.traceId();
      const guard = guardActionRequest(input.actionId, input.payload ?? {});
      if (!guard.ok) {
        const refusal = refusalMissingData(
          "guardrail_triggered",
          guard.message ?? "Action bloqueada por guardrail.",
          traceId,
        );
        const event = makeEvent({
          clock,
          session,
          actionId: input.actionId,
          response: refusal,
          action: {
            actionId: input.actionId,
            actionExecuted: false,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: guard.message,
          },
          guardStatus: "block",
          guardDetail: guard.code,
          traceId,
        });
        audit.emit(event);
        return { refusal, event, guard };
      }

      const def = deps.registry.get(input.actionId);
      if (!def) {
        const refusal = refusalMissingData(
          "intent_not_supported",
          `Action "${input.actionId}" não registrada.`,
          traceId,
        );
        const event = makeEvent({
          clock,
          session,
          actionId: input.actionId,
          response: refusal,
          action: {
            actionId: input.actionId,
            actionExecuted: false,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: "not_registered",
          },
          guardStatus: "block",
          guardDetail: "not_registered",
          traceId,
        });
        audit.emit(event);
        return { refusal, event, guard };
      }

      try {
        const proposal = await def.buildProposal(input.payload, {
          companyId: session.companyId,
          userId: session.userId,
          traceId,
          proposalId: `${traceId}-proposal`,
        });
        const parsed = actionProposalSchema.parse(proposal);
        // proposta ainda NÃO executa nada — apenas registra para auditoria.
        const auditResponse: AIResponse = {
          version: "AIResponse.v1",
          summary: proposal.title,
          confidence: "high",
          sources: [],
          actions: [
            {
              id: proposal.proposalId,
              label: "Confirmar",
              intent: `action.${proposal.actionId}`,
              payload: proposal.payload,
              requiresApproval: true,
              scopes: [...proposal.scopes],
            },
          ],
          warnings: [],
          suggestedQuestions: [],
          traceId,
        };
        const event = makeEvent({
          clock,
          session,
          actionId: proposal.actionId,
          response: auditResponse,
          action: {
            actionId: proposal.actionId,
            actionExecuted: false,
            executionTimeMs: 0,
            useCase: def.useCase,
            alreadyAudited: false,
          },
          guardStatus: "pass",
          traceId,
        });
        audit.emit(event);
        return { proposal: parsed, event, guard };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const refusal = refusalToolError(input.actionId, msg, traceId);
        const event = makeEvent({
          clock,
          session,
          actionId: input.actionId,
          response: refusal,
          action: {
            actionId: input.actionId,
            actionExecuted: false,
            executionTimeMs: 0,
            useCase: def.useCase,
            alreadyAudited: false,
            error: msg,
          },
          guardStatus: "block",
          guardDetail: "proposal_error",
          traceId,
        });
        audit.emit(event);
        return { refusal, event, guard };
      }
    },

    async confirm(
      input: ConfirmInput,
      session: ActionSessionCtx,
    ): Promise<ExecuteOutput> {
      const traceId = clock.traceId();
      const proposal = actionProposalSchema.parse(input.proposal);
      // reforço multi-tenant: proposta não pode mudar de tenant no confirm.
      if (proposal.companyId !== session.companyId) {
        const refusal = refusalToolError(
          proposal.actionId,
          "tenant_mismatch",
          traceId,
        );
        const result: ActionExecutionResult = {
          version: ACTION_RESULT_VERSION,
          proposalId: proposal.proposalId,
          actionId: proposal.actionId,
          status: "failed",
          executionTimeMs: 0,
          alreadyAudited: false,
          error: "tenant_mismatch",
        };
        const event = makeEvent({
          clock,
          session,
          actionId: proposal.actionId,
          response: refusal,
          action: {
            actionId: proposal.actionId,
            actionExecuted: false,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: "tenant_mismatch",
          },
          guardStatus: "block",
          guardDetail: "tenant_mismatch",
          traceId,
        });
        audit.emit(event);
        return { result, refusal, event, guard: { ok: false } };
      }

      const guard = guardActionConfirmation(
        proposal.actionId as SafeActionId,
        input.confirmed,
      );
      if (!guard.ok) {
        const refusal = refusalMissingData(
          "guardrail_triggered",
          guard.message ?? "Confirmação ausente.",
          traceId,
        );
        const result: ActionExecutionResult = {
          version: ACTION_RESULT_VERSION,
          proposalId: proposal.proposalId,
          actionId: proposal.actionId,
          status: "cancelled",
          executionTimeMs: 0,
          alreadyAudited: false,
          error: guard.message,
        };
        const event = makeEvent({
          clock,
          session,
          actionId: proposal.actionId,
          response: refusal,
          action: {
            actionId: proposal.actionId,
            actionExecuted: false,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: guard.message,
          },
          guardStatus: "block",
          guardDetail: guard.code,
          traceId,
        });
        audit.emit(event);
        return { result, refusal, event, guard };
      }

      const def = deps.registry.get(proposal.actionId);
      if (!def) {
        const refusal = refusalMissingData(
          "intent_not_supported",
          `Action "${proposal.actionId}" não registrada.`,
          traceId,
        );
        const result: ActionExecutionResult = {
          version: ACTION_RESULT_VERSION,
          proposalId: proposal.proposalId,
          actionId: proposal.actionId,
          status: "failed",
          executionTimeMs: 0,
          alreadyAudited: false,
          error: "not_registered",
        };
        const event = makeEvent({
          clock,
          session,
          actionId: proposal.actionId,
          response: refusal,
          action: {
            actionId: proposal.actionId,
            actionExecuted: false,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: "not_registered",
          },
          guardStatus: "block",
          guardDetail: "not_registered",
          traceId,
        });
        audit.emit(event);
        return { result, refusal, event, guard };
      }

      const started = Date.now();
      try {
        const { output, alreadyAudited } = await def.execute(proposal.payload, {
          companyId: session.companyId,
          userId: session.userId,
          traceId,
          proposalId: proposal.proposalId,
        });
        const executionTimeMs = Date.now() - started;
        const result: ActionExecutionResult = {
          version: ACTION_RESULT_VERSION,
          proposalId: proposal.proposalId,
          actionId: proposal.actionId,
          status: "executed",
          executionTimeMs,
          useCase: def.useCase,
          alreadyAudited,
          output,
        };
        // Response de resultado é gerada externamente pelo formatter — aqui
        // registramos apenas o audit event enxuto.
        const auditResponse: AIResponse = {
          version: "AIResponse.v1",
          summary: `Action ${proposal.actionId} executada.`,
          confidence: "high",
          sources: [],
          actions: [],
          warnings: [],
          suggestedQuestions: [],
          traceId,
        };
        const event = makeEvent({
          clock,
          session,
          actionId: proposal.actionId,
          response: auditResponse,
          action: {
            actionId: proposal.actionId,
            actionExecuted: true,
            executionTimeMs,
            useCase: def.useCase,
            alreadyAudited,
            // Se o UC já auditou (RegisterPricingDecision), não anexamos
            // `result` completo aqui para evitar duplicar dados sensíveis.
            result: alreadyAudited
              ? { proposalId: proposal.proposalId }
              : output,
          },
          guardStatus: "pass",
          traceId,
        });
        audit.emit(event);
        return { result, event, guard };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const executionTimeMs = Date.now() - started;
        const refusal = refusalToolError(proposal.actionId, msg, traceId);
        const result: ActionExecutionResult = {
          version: ACTION_RESULT_VERSION,
          proposalId: proposal.proposalId,
          actionId: proposal.actionId,
          status: "failed",
          executionTimeMs,
          useCase: def.useCase,
          alreadyAudited: false,
          error: msg,
        };
        const event = makeEvent({
          clock,
          session,
          actionId: proposal.actionId,
          response: refusal,
          action: {
            actionId: proposal.actionId,
            actionExecuted: false,
            executionTimeMs,
            useCase: def.useCase,
            alreadyAudited: false,
            error: msg,
          },
          guardStatus: "block",
          guardDetail: "execution_error",
          traceId,
        });
        audit.emit(event);
        return { result, refusal, event, guard };
      }
    },

    cancel(proposal: ActionProposal, session: ActionSessionCtx): AIInteractionEvent {
      const traceId = clock.traceId();
      const auditResponse: AIResponse = {
        version: "AIResponse.v1",
        summary: `Action ${proposal.actionId} cancelada pelo usuário.`,
        confidence: "high",
        sources: [],
        actions: [],
        warnings: [],
        suggestedQuestions: [],
        traceId,
      };
      const event = makeEvent({
        clock,
        session,
        actionId: proposal.actionId,
        response: auditResponse,
        action: {
          actionId: proposal.actionId,
          actionExecuted: false,
          executionTimeMs: 0,
          alreadyAudited: false,
        },
        guardStatus: "pass",
        traceId,
      });
      audit.emit(event);
      return event;
    },
  };
}
