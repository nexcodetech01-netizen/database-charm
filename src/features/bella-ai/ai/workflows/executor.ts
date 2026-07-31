/**
 * Workflow Executor — orquestra `propose` / `confirm` / `cancel`.
 *
 * - `propose` faz UMA leitura ao dashboard comercial (Application Layer),
 *   monta a `WorkflowProposal.v1` e devolve para a UI. Nenhuma mutação.
 * - `confirm` só executa após `confirmed=true`. Itera item-a-item chamando
 *   `applyProductSuggestedPrice` (SAFE ACTION mutating). Falha em 1 item
 *   nunca aborta — captura em `WorkflowReport.items[].error` e prossegue.
 * - Toda etapa emite `AIInteractionEvent` com o campo `workflow` para
 *   auditoria. Como cada UC já persiste auditoria fiscal
 *   (`RegisterPricingDecision`), o event marca `alreadyAudited=true` e não
 *   duplica o registro.
 * - Guardrails determinísticos rodam ANTES de qualquer chamada de tool.
 */
import {
  EVENT_VERSION,
  noopAuditSink,
  type AIIntent,
  type AIInteractionEvent,
  type AIInteractionWorkflow,
  type AIResponse,
  type AuditSink,
} from "../contracts";
import { INTENT_VERSION } from "../contracts";
import type { OrchestratorClock } from "../orchestrator";
import { systemOrchestratorClock } from "../orchestrator";
import { refusalMissingData, refusalToolError } from "../formatter";
import type { ToolExecutors } from "../tools/executors";
import type { PricingStrategy } from "@/features/pricing/lib/product-pricing.functions";
import {
  WORKFLOW_PROPOSAL_VERSION,
  WORKFLOW_REPORT_VERSION,
  workflowProposalSchema,
  type WorkflowId,
  type WorkflowImpact,
  type WorkflowItemResult,
  type WorkflowProposal,
  type WorkflowReport,
  type WorkflowRisk,
} from "./contracts";
import {
  guardWorkflowConfirmation,
  guardWorkflowRequest,
  guardWorkflowTenant,
  type WorkflowGuardResult,
} from "./guardrails";
import type { WorkflowRegistry } from "./registry";

const brl = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export interface WorkflowExecutorDeps {
  readonly registry: WorkflowRegistry;
  readonly executors: ToolExecutors;
  readonly audit?: AuditSink;
  readonly clock?: OrchestratorClock;
}

export interface WorkflowSessionCtx {
  readonly companyId: string;
  readonly userId?: string;
}

export interface WorkflowProposeInput {
  readonly workflowId: string;
  readonly payload: Record<string, unknown>;
  readonly strategy?: PricingStrategy;
}

export interface WorkflowConfirmInput {
  readonly proposal: WorkflowProposal;
  readonly confirmed: boolean;
  readonly onItem?: (result: WorkflowItemResult, index: number) => void;
}

export interface WorkflowProposeOutput {
  readonly proposal?: WorkflowProposal;
  readonly refusal?: AIResponse;
  readonly event: AIInteractionEvent;
  readonly guard: WorkflowGuardResult;
}

export interface WorkflowConfirmOutput {
  readonly report: WorkflowReport;
  readonly refusal?: AIResponse;
  readonly event: AIInteractionEvent;
  readonly guard: WorkflowGuardResult;
}

function workflowIntent(workflowId: string): AIIntent {
  return {
    version: INTENT_VERSION,
    intent: "unknown",
    domain: "commercial",
    action: `workflow.${workflowId}`,
    slots: {},
    confidence: 1,
    source: "deterministic",
    raw: `workflow:${workflowId}`,
  };
}

function makeEvent(args: {
  clock: OrchestratorClock;
  session: WorkflowSessionCtx;
  workflowId: string;
  response: AIResponse;
  workflow: AIInteractionWorkflow;
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
    intent: workflowIntent(args.workflowId),
    toolCalls: [],
    response: args.response,
    guardrails: [
      {
        rule: "workflows.safe_workflow_allow_list",
        status: args.guardStatus,
        detail: args.guardDetail,
      },
    ],
    workflow: args.workflow,
  };
}

function auditResponse(summary: string, traceId: string): AIResponse {
  return {
    version: "AIResponse.v1",
    summary,
    confidence: "high",
    sources: [],
    actions: [],
    warnings: [],
    suggestedQuestions: [],
    traceId,
  };
}

export function createWorkflowExecutor(deps: WorkflowExecutorDeps) {
  const audit = deps.audit ?? noopAuditSink;
  const clock = deps.clock ?? systemOrchestratorClock;

  return {
    async propose(
      input: WorkflowProposeInput,
      session: WorkflowSessionCtx,
    ): Promise<WorkflowProposeOutput> {
      const traceId = clock.traceId();
      const guard = guardWorkflowRequest(
        input.workflowId,
        input.payload ?? {},
      );
      if (!guard.ok) {
        const refusal = refusalMissingData(
          "guardrail_triggered",
          guard.message ?? "Workflow bloqueado por guardrail.",
          traceId,
        );
        const event = makeEvent({
          clock,
          session,
          workflowId: input.workflowId,
          response: refusal,
          workflow: {
            workflowId: input.workflowId,
            steps: 0,
            productsProcessed: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            productsFailed: 0,
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

      const def = deps.registry.get(input.workflowId);
      if (!def) {
        const refusal = refusalMissingData(
          "intent_not_supported",
          `Workflow "${input.workflowId}" não registrado.`,
          traceId,
        );
        const event = makeEvent({
          clock,
          session,
          workflowId: input.workflowId,
          response: refusal,
          workflow: {
            workflowId: input.workflowId,
            steps: 0,
            productsProcessed: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            productsFailed: 0,
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
        const dashboard = await deps.executors.getCommercialDashboard({
          companyId: session.companyId,
        });
        const discovery = def.discover(
          {
            companyId: session.companyId,
            categoryId: input.payload?.categoryId as string | undefined,
          },
          dashboard,
        );
        const targets = discovery.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          currentPriceCents: i.currentPriceCents,
          recommendedPriceCents: i.recommendedPriceCents,
          differenceCents: i.differenceCents,
          primaryReason: i.primaryReason,
        }));
        const risks: WorkflowRisk[] = [];
        if (targets.length === 0) {
          risks.push({
            code: "no_targets",
            message: "Nenhum produto elegível encontrado para este workflow.",
          });
        }
        if (targets.some((t) => t.differenceCents < 0)) {
          risks.push({
            code: "some_decreases",
            message: "Alguns produtos terão redução de preço.",
          });
        }

        const impact: WorkflowImpact[] = [
          { label: "Produtos elegíveis", value: String(targets.length) },
          {
            label: "Impacto estimado",
            value: `${discovery.estimatedRevenueDeltaCents >= 0 ? "+" : ""}${brl(
              discovery.estimatedRevenueDeltaCents,
            )}`,
            tone:
              discovery.estimatedRevenueDeltaCents >= 0 ? "positive" : "warning",
          },
        ];
        if (discovery.categoryName) {
          impact.unshift({ label: "Categoria", value: discovery.categoryName });
        }

        const proposal: WorkflowProposal = {
          version: WORKFLOW_PROPOSAL_VERSION,
          proposalId: `${traceId}-wf`,
          workflowId: def.id,
          title: def.title,
          summary: `${def.baseSummary} ${targets.length} produto(s) elegível(is).`,
          impact,
          risks,
          scopes: [...def.scopes],
          targets,
          totalItems: targets.length,
          estimatedRevenueDeltaCents: discovery.estimatedRevenueDeltaCents,
          payload: {
            ...input.payload,
            strategy: input.strategy ?? "final",
          },
          requiresConfirmation: true,
          createdAt: clock.nowIso(),
          companyId: session.companyId,
        };
        const parsed = workflowProposalSchema.parse(proposal);
        const event = makeEvent({
          clock,
          session,
          workflowId: def.id,
          response: auditResponse(
            `Workflow ${def.id} proposto (${targets.length} itens).`,
            traceId,
          ),
          workflow: {
            workflowId: def.id,
            steps: 1,
            productsProcessed: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            productsFailed: 0,
            executionTimeMs: 0,
            alreadyAudited: false,
          },
          guardStatus: "pass",
          traceId,
        });
        audit.emit(event);
        return { proposal: parsed, event, guard };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const refusal = refusalToolError(input.workflowId, msg, traceId);
        const event = makeEvent({
          clock,
          session,
          workflowId: input.workflowId,
          response: refusal,
          workflow: {
            workflowId: input.workflowId,
            steps: 0,
            productsProcessed: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            productsFailed: 0,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: msg,
          },
          guardStatus: "block",
          guardDetail: "discovery_error",
          traceId,
        });
        audit.emit(event);
        return { refusal, event, guard };
      }
    },

    async confirm(
      input: WorkflowConfirmInput,
      session: WorkflowSessionCtx,
    ): Promise<WorkflowConfirmOutput> {
      const traceId = clock.traceId();
      const proposal = workflowProposalSchema.parse(input.proposal);

      const tenantGuard = guardWorkflowTenant(proposal, session.companyId);
      if (!tenantGuard.ok) {
        const refusal = refusalToolError(
          proposal.workflowId,
          tenantGuard.message ?? "tenant_mismatch",
          traceId,
        );
        const report: WorkflowReport = {
          version: WORKFLOW_REPORT_VERSION,
          proposalId: proposal.proposalId,
          workflowId: proposal.workflowId,
          status: "failed",
          companyId: session.companyId,
          productsProcessed: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          productsFailed: 0,
          executionTimeMs: 0,
          appliedRevenueDeltaCents: 0,
          items: [],
          alreadyAudited: false,
        };
        const event = makeEvent({
          clock,
          session,
          workflowId: proposal.workflowId,
          response: refusal,
          workflow: {
            workflowId: proposal.workflowId,
            steps: 0,
            productsProcessed: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            productsFailed: 0,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: "tenant_mismatch",
          },
          guardStatus: "block",
          guardDetail: tenantGuard.code,
          traceId,
        });
        audit.emit(event);
        return { report, refusal, event, guard: tenantGuard };
      }

      const guard = guardWorkflowConfirmation(
        proposal.workflowId,
        input.confirmed,
      );
      if (!guard.ok) {
        const refusal = refusalMissingData(
          "guardrail_triggered",
          guard.message ?? "Confirmação ausente.",
          traceId,
        );
        const report: WorkflowReport = {
          version: WORKFLOW_REPORT_VERSION,
          proposalId: proposal.proposalId,
          workflowId: proposal.workflowId,
          status: "cancelled",
          companyId: session.companyId,
          productsProcessed: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          productsFailed: 0,
          executionTimeMs: 0,
          appliedRevenueDeltaCents: 0,
          items: [],
          alreadyAudited: false,
        };
        const event = makeEvent({
          clock,
          session,
          workflowId: proposal.workflowId,
          response: refusal,
          workflow: {
            workflowId: proposal.workflowId,
            steps: 0,
            productsProcessed: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            productsFailed: 0,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: guard.message,
          },
          guardStatus: "block",
          guardDetail: guard.code,
          traceId,
        });
        audit.emit(event);
        return { report, refusal, event, guard };
      }

      const def = deps.registry.get(proposal.workflowId);
      if (!def) {
        const refusal = refusalMissingData(
          "intent_not_supported",
          `Workflow "${proposal.workflowId}" não registrado.`,
          traceId,
        );
        const report: WorkflowReport = {
          version: WORKFLOW_REPORT_VERSION,
          proposalId: proposal.proposalId,
          workflowId: proposal.workflowId,
          status: "failed",
          companyId: session.companyId,
          productsProcessed: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          productsFailed: 0,
          executionTimeMs: 0,
          appliedRevenueDeltaCents: 0,
          items: [],
          alreadyAudited: false,
        };
        const event = makeEvent({
          clock,
          session,
          workflowId: proposal.workflowId,
          response: refusal,
          workflow: {
            workflowId: proposal.workflowId,
            steps: 0,
            productsProcessed: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            productsFailed: 0,
            executionTimeMs: 0,
            alreadyAudited: false,
            error: "not_registered",
          },
          guardStatus: "block",
          guardDetail: "not_registered",
          traceId,
        });
        audit.emit(event);
        return { report, refusal, event, guard };
      }

      const strategy = (proposal.payload?.strategy as PricingStrategy) ?? "final";
      const started = Date.now();
      const items: WorkflowItemResult[] = [];
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      let appliedDelta = 0;

      for (let i = 0; i < proposal.targets.length; i++) {
        const target = proposal.targets[i];
        const t0 = Date.now();
        // Skip determinístico: nada a fazer se recomendado == atual.
        if (target.differenceCents === 0) {
          const result: WorkflowItemResult = {
            productId: target.productId,
            name: target.name,
            status: "skipped",
            previousPriceCents: target.currentPriceCents,
            appliedPriceCents: target.currentPriceCents,
            reason: "no_change_needed",
            durationMs: 0,
          };
          items.push(result);
          skipped++;
          input.onItem?.(result, i);
          continue;
        }
        try {
          const out = await deps.executors.applyProductSuggestedPrice({
            companyId: session.companyId,
            productId: target.productId,
            strategy,
          });
          const applied = out.appliedPriceCents ?? target.recommendedPriceCents;
          const result: WorkflowItemResult = {
            productId: target.productId,
            name: target.name,
            status: "updated",
            previousPriceCents: target.currentPriceCents,
            appliedPriceCents: applied,
            explainId: out.explainId,
            decisionId: out.decisionId,
            durationMs: Date.now() - t0,
          };
          items.push(result);
          updated++;
          appliedDelta += applied - target.currentPriceCents;
          input.onItem?.(result, i);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const result: WorkflowItemResult = {
            productId: target.productId,
            name: target.name,
            status: "failed",
            previousPriceCents: target.currentPriceCents,
            error: msg,
            durationMs: Date.now() - t0,
          };
          items.push(result);
          failed++;
          input.onItem?.(result, i);
          // §Erros: nunca abortar workflow inteiro.
        }
      }

      const executionTimeMs = Date.now() - started;
      const report: WorkflowReport = {
        version: WORKFLOW_REPORT_VERSION,
        proposalId: proposal.proposalId,
        workflowId: proposal.workflowId,
        status: "executed",
        companyId: session.companyId,
        productsProcessed: items.length,
        productsUpdated: updated,
        productsSkipped: skipped,
        productsFailed: failed,
        executionTimeMs,
        appliedRevenueDeltaCents: appliedDelta,
        items,
        alreadyAudited: def.alreadyAudited,
      };
      const event = makeEvent({
        clock,
        session,
        workflowId: def.id,
        response: auditResponse(
          `Workflow ${def.id} executado: ${updated} atualizados, ${skipped} ignorados, ${failed} falhas.`,
          traceId,
        ),
        workflow: {
          workflowId: def.id,
          steps: items.length,
          productsProcessed: items.length,
          productsUpdated: updated,
          productsSkipped: skipped,
          productsFailed: failed,
          executionTimeMs,
          useCase: def.useCase,
          alreadyAudited: def.alreadyAudited,
        },
        guardStatus: "pass",
        traceId,
      });
      audit.emit(event);
      return { report, event, guard };
    },

    cancel(
      proposal: WorkflowProposal,
      session: WorkflowSessionCtx,
    ): AIInteractionEvent {
      const traceId = clock.traceId();
      const event = makeEvent({
        clock,
        session,
        workflowId: proposal.workflowId,
        response: auditResponse(
          `Workflow ${proposal.workflowId} cancelado pelo usuário.`,
          traceId,
        ),
        workflow: {
          workflowId: proposal.workflowId,
          steps: 0,
          productsProcessed: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          productsFailed: 0,
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
