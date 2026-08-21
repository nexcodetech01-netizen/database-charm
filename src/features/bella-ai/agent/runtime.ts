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
import { BellaSkillRegistry } from "../skills/registry";
import { bellaAIGateway, BellaAIGateway } from "../ai/gateway/BellaAIGateway";
import type { AgentContext, AgentIntent, AgentResponse } from "./types";
import type { AIResult } from "../ai/gateway/types";

export interface AgentRuntimeInput {
  message: string;
  ctx: AgentContext;
  /** Confirmação humana já obtida (para ações destrutivas). */
  confirmed?: boolean;
  /**
   * Gateway de IA opcional, com provider configurado usando server
   * functions já vinculadas via `useServerFn()` — necessário quando
   * chamado a partir de um componente cliente. Sem isso, usa o
   * singleton padrão (seguro só server-side).
   */
  gateway?: BellaAIGateway;
}

export interface AgentRuntimeTrace {
  enabled: boolean;
  intent: AgentIntent | null;
  fallback: boolean;
  fallbackReason?: string;
  executionTimeMs: number;
  response?: AgentResponse;
  telemetry?: {
    provider: string;
    model?: string;
    latencyMs?: number;
    fallbackUsed?: boolean;
  };
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
  // SEGURANÇA: Bloqueia execução acidental no navegador
  if (typeof window !== 'undefined') {
    throw new Error("Agente Operacional só pode ser executado no servidor.");
  }

  const gateway = input.gateway ?? bellaAIGateway;
  const startedAt = new Date();

  // Garante inicialização das Skills antes de processar
  await BellaSkillRegistry.ensureInitialized();


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
  let aiResult: AIResult | null = null;
  
  try {
    aiResult = await gateway.interpret({
      userMessage: input.message,
      // BUG CORRIGIDO: `companyName` estava recebendo o valor de
      // `companyId` (um UUID, não o nome da empresa) — a IA via um
      // código aleatório no lugar do nome do negócio no prompt.
      // `AgentContext` não tem campo de nome de empresa ainda; até
      // isso ser adicionado, não inventamos um valor errado — melhor
      // deixar undefined (o prompt já lida com ausência) do que mandar
      // o UUID disfarçado de nome.
      companyName: input.ctx.companyName,
      context: { 
        userId: input.ctx.userId,
        companyId: input.ctx.companyId,
        conversationId: input.ctx.conversationId,
        // Injetar memória de curto prazo no contexto para continuidade (Fase 2)
        lastIntent: (intent as any)?.id,
        lastParameters: (intent as any)?.entities,
      }
    });

    if (aiResult.success && aiResult.intent && aiResult.intent !== "unknown") {
      
      const detIntent = detectDeterministicIntent(input.message);
      
      intent = {
        id: aiResult.intent,
        confidence: aiResult.confidence,
        entities: aiResult.parameters,
        raw: input.message,
        confirmationRequired: false,
        source: "llm"
      };
    } else {
      intent = detectDeterministicIntent(input.message);
    }
    
    
    if (intent && !SUPPORTED_RUNTIME_INTENTS.includes(intent.id as any)) {
    } else if (!intent) {
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

    // Se for uma operação que requer confirmação e ainda não foi confirmada,
    // o código do AgentOutcomeCode será "needs_confirmation".
    // Isso deve ser tratado pela UI (BellaAskPanel).

    const telemetry = aiResult?.raw && typeof aiResult.raw === 'object' && 'telemetry' in aiResult.raw 
      ? (aiResult.raw as any).telemetry 
      : { provider: aiResult?.provider || 'unknown', fallbackUsed: aiResult?.error?.fallbackUsed };

    return {
      response,
      trace: {
        enabled: true,
        intent,
        fallback: false,
        executionTimeMs: Date.now() - startedAt.getTime(),
        response,
        telemetry
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
      telemetry: { provider: 'unknown', fallbackUsed: true }
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