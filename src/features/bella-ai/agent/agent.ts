/**
 * runAgent — Pipeline canônico do Agente Operacional Bella.
 *
 *   Intent Engine → Planner → Permission Engine → Skill Registry
 *     → Business Services → Response → Execution Log
 *
 * Aditivo: coexiste com o Orchestrator antigo (pricing) e com o Action
 * Engine legado. Consumidores novos devem preferir este pipeline.
 */
import { BellaSkillRegistry } from "../skills";
import { canExecuteSkill } from "./permission-engine";
import { planFromIntent } from "./planner";
import { logAgentExecution } from "./execution-log";
import type { AgentContext, AgentIntent, AgentResponse, AgentStepResult } from "./types";

export interface RunAgentInput {
  intent: AgentIntent;
  ctx: AgentContext;
  /** true quando o usuário já confirmou uma operação destrutiva. */
  confirmed?: boolean;
}

export async function runAgent(input: RunAgentInput): Promise<AgentResponse> {
  const { intent, ctx, confirmed = false } = input;
  const startedAt = new Date();

  // 1) Planejamento
  const plan = planFromIntent(intent);
  if (!plan) {
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
      errorMessage: `Intent "${intent.id}" sem plano.`,
    });
    return {
      code: "unknown_intent",
      message: `Ainda não sei executar "${intent.id}". Posso te ajudar de outra forma?`,
      intent,
      plan: undefined,
      steps: [],
    };
  }

  // 2) Planejamento ok. A confirmação agora é tratada dentro do loop de execução 
  // para permitir que as Skills gerem resumos ricos com dados reais.


  // 3) Permissão + execução passo-a-passo
  const steps: AgentStepResult[] = [];
  for (const step of plan.steps) {
    const check = canExecuteSkill(ctx, step.skillId);
    if (!check.allowed) {
      const finishedAt = new Date();
      await logAgentExecution({
        ctx,
        intent,
        step,
        result: null,
        confirmationRequired: plan.requiresConfirmation,
        confirmed,
        startedAt,
        finishedAt,
        errorMessage: check.reason ?? "sem permissão",
      });
      return {
        code: "not_allowed",
        message: check.reason ?? "Sem permissão para essa operação.",
        intent,
        plan,
        steps,
      };
    }

    const skill = BellaSkillRegistry.get(step.skillId);
    
    const result = await BellaSkillRegistry.execute(step.skillId, step.payload, {
      companyId: ctx.companyId,
      userId: ctx.userId ?? null,
    });
    steps.push({ step, result });

    if (result.code === "missing_fields") {
      const finishedAt = new Date();
      await logAgentExecution({
        ctx,
        intent,
        step,
        result,
        confirmationRequired: plan.requiresConfirmation,
        confirmed,
        startedAt,
        finishedAt,
      });
      return {
        code: "needs_more_info",
        message: result.message,
        intent,
        plan,
        steps,
        missingFields: result.missingFields,
      };
    }

    if (!result.ok && step.critical) {
      const finishedAt = new Date();
      await logAgentExecution({
        ctx,
        intent,
        step,
        result,
        confirmationRequired: plan.requiresConfirmation,
        confirmed,
        startedAt,
        finishedAt,
        errorMessage: result.message,
      });
      return {
        code: "error",
        message: result.message,
        intent,
        plan,
        steps,
      };
    }
  }

  const last = steps[steps.length - 1]?.result;
  const finishedAt = new Date();
  await logAgentExecution({
    ctx,
    intent,
    step: steps[steps.length - 1]?.step ?? null,
    result: last ?? null,
    confirmationRequired: plan.requiresConfirmation,
    confirmed,
    startedAt,
    finishedAt,
  });

  return {
    code: "executed",
    message: last?.message ?? "Operação concluída.",
    intent,
    plan,
    steps,
    suggestions: last?.suggestions?.map((s) => ({
      id: s.id,
      title: s.title,
      actionLabel: s.actionLabel,
    })),
  };
}
