/**
 * AgentRuntime — orquestra o pipeline canônico do Agente Operacional
 * com FALLBACK AUTOMÁTICO para o fluxo legado da Bella.
 *
 *   Conversation → BellaGateway → AgentRuntime → Intent Engine →
 *     Planner → Permission Engine → Skill Registry → Response
 *
 * Regras:
 *   - Se `isBellaAgentEnabled() === false` → retorna null (usar legado).
 *   - Se intent não for suportada nesta fase → retorna null (usar legado).
 *   - Se QUALQUER etapa lançar → registra fallback e retorna null (usar legado).
 *   - Nunca modifica caminhos existentes; é aditivo.
 */
import { isBellaAgentEnabled } from "./config";
import { detectDeterministicIntent, SUPPORTED_RUNTIME_INTENTS } from "./intent-engine";
import { logAgentExecution } from "./execution-log";
import { runAgent } from "./agent";
import { bellaAIGateway } from "../ai/gateway/BellaAIGateway";
import type { AgentContext, AgentIntent, AgentResponse } from "./types";

export interface AgentRuntimeInput {
  message: string;
  ctx: AgentContext;
  /** Confirmação humana já obtida (para ações destrutivas). */
  confirmed?: boolean;
}

export interface AgentRuntimeTrace {
  enabled: boolean;
  intent: AgentIntent | null;
  fallback: boolean;
  fallbackReason?: string;
  executionTimeMs: number;
  response?: AgentResponse;
}

export interface AgentRuntimeResult {
  /** null quando o consumidor deve usar o fluxo legado. */
  response: AgentResponse | null;
  trace: AgentRuntimeTrace;
}

const FALLBACK_ERR_PREFIX = "fallback:";

/**
 * Tenta responder via novo Runtime. Devolve null quando o legado deve
 * assumir. Todas as decisões ficam registradas em `trace` para debug.
 */
export async function handleWithAgentRuntime(
  input: AgentRuntimeInput,
): Promise<AgentRuntimeResult> {
  const startedAt = new Date();

  // Fase 1 — feature flag off → nada a fazer.
  if (!isBellaAgentEnabled()) {
    return {
      response: null,
      trace: {
        enabled: false,
        intent: null,
        fallback: true,
        fallbackReason: "disabled",
        executionTimeMs: 0,
      },
    };
  }

  // Fase 2 — Tentativa via LLM (Nova Ordem: LLM -> Determinístico)
  let intent: AgentIntent | null = null;
  try {
    const aiResult = await bellaAIGateway.interpret({
      userMessage: input.message,
      companyName: ctx.companyId, // Simplificação, ideally pass name if known
      context: { 
        userId: ctx.userId,
        companyId: ctx.companyId 
      }
    });

    if (aiResult.success && aiResult.intent && aiResult.intent !== "unknown") {
      intent = {
        id: aiResult.intent,
        confidence: aiResult.confidence,
        entities: aiResult.parameters,
        raw: input.message,
        confirmationRequired: false, // Será validado pelo Planner/PermissionEngine
        source: "llm"
      };
    } else {
      // Fallback para determinístico
      intent = detectDeterministicIntent(input.message);
    }
  } catch (err) {
    console.warn("[agent.runtime] LLM interpretation failed, falling back to deterministic", err);
    intent = detectDeterministicIntent(input.message);
  }

  if (
    !intent ||
    !SUPPORTED_RUNTIME_INTENTS.includes(intent.id as (typeof SUPPORTED_RUNTIME_INTENTS)[number])
  ) {
    // Não é intent nossa — legado responde. Nem loga fallback nesse caso
    // para evitar poluir a auditoria com toda mensagem que passa.
    return finalizeFallback(startedAt, intent, "intent_not_supported");
  }

  // Fase 3/4 — executa via runAgent com fallback em erro.
  try {
    const response = await runAgent({
      intent,
      ctx: input.ctx,
      confirmed: input.confirmed,
    });

    // Erros funcionais do próprio agente (not_allowed, unknown_intent, error)
    // NÃO são fallback — são respostas legítimas.
    return {
      response,
      trace: {
        enabled: true,
        intent,
        fallback: false,
        executionTimeMs: Date.now() - startedAt.getTime(),
        response,
      },
    };
  } catch (err) {
    await recordFallback(input.ctx, intent, startedAt, `runtime_error:${errMsg(err)}`);
    return finalizeFallback(startedAt, intent, "runtime_error");
  }
}

function finalizeFallback(
  startedAt: Date,
  intent: AgentIntent | null,
  reason: string,
): AgentRuntimeResult {
  return {
    response: null,
    trace: {
      enabled: true,
      intent,
      fallback: true,
      fallbackReason: reason,
      executionTimeMs: Date.now() - startedAt.getTime(),
    },
  };
}

async function recordFallback(
  ctx: AgentContext,
  intent: AgentIntent | null,
  startedAt: Date,
  reason: string,
): Promise<void> {
  const finishedAt = new Date();
  await logAgentExecution({
    ctx,
    intent,
    step: null,
    result: null,
    confirmationRequired: false,
    confirmed: false,
    startedAt,
    finishedAt,
    errorMessage: `${FALLBACK_ERR_PREFIX}${reason}`,
  });
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 240);
  return String(err).slice(0, 240);
}

export const FALLBACK_LOG_PREFIX = FALLBACK_ERR_PREFIX;
