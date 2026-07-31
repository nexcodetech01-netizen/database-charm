/**
 * AI Orchestrator (Fase 1 — determinístico, sem LLM).
 *
 * Pipeline:
 *   1. IntentRouter.detect(message)                   → AIIntent
 *   2. ToolRegistry.getByIntent(intent)               → ToolDefinition | undefined
 *   3. Tool.inputSchema.parse(slots + companyId)      → Zod
 *   4. Tool.execute(input, ctx)                        → DTO da Application Layer
 *   5. Formatter.for(intent)(dto, ctx)                → AIResponse.v1
 *   6. Guardrails.applyOutputGuardrails(response)     → response validada
 *   7. AuditSink.emit(AIInteractionEvent.v1)          → telemetria
 *
 * Nenhuma etapa acessa banco, engine ou repositories.
 */
import {
  EVENT_VERSION,
  noopAuditSink,
  type AIIntent,
  type AIInteractionEvent,
  type AIResponse,
  type AuditSink,
  type ToolDefinition,
} from "../contracts";
import type { IntentRouter } from "../intents";
import type { ToolRegistry } from "../tools";
import {
  formatCategoryPolicies,
  formatCompanyPolicy,
  formatDashboard,
  formatProductExplain,
  formatSimulation,
  refusalIntentNotSupported,
  refusalMissingData,
  refusalToolError,
} from "../formatter";
import { applyOutputGuardrails } from "../guardrails";

export interface OrchestratorClock {
  nowIso(): string;
  traceId(): string;
}

export const systemOrchestratorClock: OrchestratorClock = {
  nowIso: () => new Date().toISOString(),
  traceId: () =>
    `bella-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
};

export interface OrchestratorDeps {
  readonly router: IntentRouter;
  readonly tools: ToolRegistry;
  readonly audit?: AuditSink;
  readonly clock?: OrchestratorClock;
}

export interface HandleInput {
  readonly message: string;
  readonly companyId: string;
  readonly userId?: string;
}

export interface HandleOutput {
  readonly response: AIResponse;
  readonly intent: AIIntent;
  readonly event: AIInteractionEvent;
}

const PRICING_INTENTS = new Set([
  "commercial.product.explain",
  "commercial.pricing.simulate",
]);

export function createOrchestrator(deps: OrchestratorDeps) {
  const audit = deps.audit ?? noopAuditSink;
  const clock = deps.clock ?? systemOrchestratorClock;

  return {
    async handle(input: HandleInput): Promise<HandleOutput> {
      const traceId = clock.traceId();
      const intent = deps.router.detect(input.message);

      // Intent não suportada → refusal padrão.
      if (intent.intent === "unknown") {
        const response = refusalIntentNotSupported(input.message, traceId);
        const guarded = applyOutputGuardrails(response, {
          usedPricingTool: false,
        });
        const event: AIInteractionEvent = {
          version: EVENT_VERSION,
          traceId,
          occurredAt: clock.nowIso(),
          userId: input.userId,
          companyId: input.companyId,
          intent,
          toolCalls: [],
          response: guarded.response,
          guardrails: guarded.checks,
        };
        audit.emit(event);
        return { response: guarded.response, intent, event };
      }

      const tool = deps.tools.getByIntent(intent.intent);
      if (!tool) {
        const response = refusalIntentNotSupported(input.message, traceId);
        const guarded = applyOutputGuardrails(response, {
          usedPricingTool: false,
        });
        const event: AIInteractionEvent = {
          version: EVENT_VERSION,
          traceId,
          occurredAt: clock.nowIso(),
          userId: input.userId,
          companyId: input.companyId,
          intent,
          toolCalls: [],
          response: guarded.response,
          guardrails: guarded.checks,
        };
        audit.emit(event);
        return { response: guarded.response, intent, event };
      }

      // Monta input do tool (companyId injetado do session, jamais do LLM/slots).
      const toolInput: Record<string, unknown> = {
        companyId: input.companyId,
        ...intent.slots,
      };

      const parsed = tool.inputSchema.safeParse(toolInput);
      if (!parsed.success) {
        // Slot obrigatório ausente — refusal explícito, não estima.
        const detail =
          intent.intent === "commercial.product.explain"
            ? "Preciso do identificador do produto para explicar o preço."
            : intent.intent === "commercial.pricing.simulate"
              ? "Simulação exige custo, quantidade e (opcional) margem — abra o Simulador para preencher."
              : `Parâmetros insuficientes para ${tool.name}.`;
        const response = refusalMissingData(
          "insufficient_context",
          detail,
          traceId,
        );
        const guarded = applyOutputGuardrails(response, {
          usedPricingTool: false,
        });
        const event: AIInteractionEvent = {
          version: EVENT_VERSION,
          traceId,
          occurredAt: clock.nowIso(),
          userId: input.userId,
          companyId: input.companyId,
          intent,
          toolCalls: [],
          response: guarded.response,
          guardrails: guarded.checks,
        };
        audit.emit(event);
        return { response: guarded.response, intent, event };
      }

      const started = Date.now();
      let output: unknown;
      let toolError: string | undefined;
      try {
        output = await tool.execute(parsed.data, {
          companyId: input.companyId,
          userId: input.userId,
          traceId,
        });
      } catch (err) {
        toolError = err instanceof Error ? err.message : String(err);
      }
      const durationMs = Date.now() - started;

      if (toolError) {
        const response = refusalToolError(tool.name, toolError, traceId);
        const guarded = applyOutputGuardrails(response, {
          usedPricingTool: PRICING_INTENTS.has(tool.intent),
        });
        const event: AIInteractionEvent = {
          version: EVENT_VERSION,
          traceId,
          occurredAt: clock.nowIso(),
          userId: input.userId,
          companyId: input.companyId,
          intent,
          toolCalls: [
            {
              tool: tool.name,
              useCase: tool.useCase,
              durationMs,
              error: toolError,
            },
          ],
          response: guarded.response,
          guardrails: guarded.checks,
        };
        audit.emit(event);
        return { response: guarded.response, intent, event };
      }

      const formatCtx = {
        traceId,
        toolCall: tool.name,
        useCase: tool.useCase,
      };
      const response = dispatchFormatter(tool, output, formatCtx);

      const guarded = applyOutputGuardrails(response, {
        usedPricingTool: PRICING_INTENTS.has(tool.intent),
      });

      const event: AIInteractionEvent = {
        version: EVENT_VERSION,
        traceId,
        occurredAt: clock.nowIso(),
        userId: input.userId,
        companyId: input.companyId,
        intent,
        toolCalls: [
          { tool: tool.name, useCase: tool.useCase, durationMs },
        ],
        response: guarded.response,
        guardrails: guarded.checks,
      };
      audit.emit(event);
      return { response: guarded.response, intent, event };
    },
  };
}

function dispatchFormatter(
  tool: ToolDefinition,
  output: unknown,
  ctx: { traceId: string; toolCall: string; useCase: string },
): AIResponse {
  switch (tool.intent) {
    case "commercial.dashboard":
      return formatDashboard(output, ctx);
    case "commercial.company":
      return formatCompanyPolicy(output, ctx);
    case "commercial.category":
      return formatCategoryPolicies(output, ctx);
    case "commercial.product.explain":
      return formatProductExplain(output, ctx);
    case "commercial.pricing.simulate":
      return formatSimulation(output, ctx);
    default:
      return refusalIntentNotSupported("", ctx.traceId);
  }
}
