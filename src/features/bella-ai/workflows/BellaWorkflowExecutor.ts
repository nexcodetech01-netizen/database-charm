/**
 * BellaWorkflowExecutor — executa exatamente UM Step por vez.
 *
 * Responsabilidades:
 *  - Chamar a Skill correspondente via BellaSkillRegistry.
 *  - Interpretar o BellaSkillResult (success / missing_fields / error / ...).
 *  - Atualizar o instance (status, progresso, histórico, mensagens).
 *  - Nunca decidir avançar para o próximo Step — quem coordena é o Engine.
 */

import type { BellaSkillResult } from "../skills/types";
import type { BellaWorkflowContext } from "./BellaWorkflowContext";
import { buildProgress, computeProgressPercent, transition } from "./BellaWorkflowState";
import type {
  BellaWorkflowDefinition,
  BellaWorkflowExecutionResult,
  BellaWorkflowInstance,
  BellaWorkflowStep,
} from "./BellaWorkflowTypes";

export interface BellaWorkflowExecutorHooks {
  onLog?(event: string, detail?: string): void;
}

export class BellaWorkflowExecutor {
  constructor(private readonly hooks: BellaWorkflowExecutorHooks = {}) {}

  async runStep(params: {
    definition: BellaWorkflowDefinition;
    instance: BellaWorkflowInstance;
    context: BellaWorkflowContext;
    confirmed?: boolean;
  }): Promise<BellaWorkflowExecutionResult> {
    const { definition, instance, context, confirmed = false } = params;
    const idx = instance.currentStep;
    const step = definition.steps[idx];

    if (!step) {
      return {
        ok: instance.status === "COMPLETED",
        instance,
        progress: buildProgress(instance, definition),
        message: "Nenhum Step pendente.",
      };
    }

    // Confirmação exigida?
    const skill = context.skills.get(step.skillId);
    const skillRequiresConfirmation = skill?.requiresConfirmation === true;
    const requiresConfirmation =
      step.requiresConfirmation ?? skillRequiresConfirmation ?? false;

    if (requiresConfirmation && !confirmed) {
      transition(instance, "WAITING_USER");
      instance.lastMessage = `Confirmação necessária para: ${step.name}`;
      this.hooks.onLog?.("step_waiting_user", `${instance.id}#${step.id}`);
      return {
        ok: false,
        instance,
        progress: buildProgress(instance, definition),
        message: instance.lastMessage,
      };
    }

    const startedAt = Date.now();
    transition(instance, "RUNNING");
    this.hooks.onLog?.("step_started", `${instance.id}#${step.id}`);

    // Monta payload (puro) — falha aqui é erro estrutural do template.
    let payload;
    try {
      payload = step.buildPayload({
        collectedParameters: instance.collectedParameters,
        previousOutputs: instance.stepOutputs,
        tenantId: context.tenantId,
        userId: context.userId,
      });
    } catch (err) {
      return this.finishStepWithError(
        definition,
        instance,
        step,
        idx,
        startedAt,
        err instanceof Error ? err.message : "Falha ao construir payload do Step.",
      );
    }

    // Executa a Skill via Registry — sem duplicar regra de negócio.
    let result: BellaSkillResult;
    try {
      result = await context.skills.execute(step.skillId, payload, {
        companyId: context.tenantId,
        userId: context.userId,
      });
    } catch (err) {
      return this.finishStepWithError(
        definition,
        instance,
        step,
        idx,
        startedAt,
        err instanceof Error ? err.message : "Falha inesperada na execução da Skill.",
      );
    }

    return this.applySkillResult(definition, instance, step, idx, startedAt, result);
  }

  private applySkillResult(
    definition: BellaWorkflowDefinition,
    instance: BellaWorkflowInstance,
    step: BellaWorkflowStep,
    idx: number,
    startedAt: number,
    result: BellaSkillResult,
  ): BellaWorkflowExecutionResult {
    const finishedAt = Date.now();

    if (result.code === "missing_fields") {
      instance.history.push({
        stepId: step.id,
        stepIndex: idx,
        status: "waiting_user",
        startedAt,
        finishedAt,
        skillResultCode: result.code,
      });
      transition(instance, "WAITING_USER");
      instance.lastMessage = result.message;
      instance.lastError = null;
      this.hooks.onLog?.("step_waiting_user", `${instance.id}#${step.id}`);
      return {
        ok: false,
        instance,
        progress: buildProgress(instance, definition),
        stepResult: result,
        message: result.message,
      };
    }

    if (!result.ok) {
      return this.finishStepWithError(
        definition,
        instance,
        step,
        idx,
        startedAt,
        result.message,
        result.code,
      );
    }

    // Sucesso: captura outputs, avança currentStep, recalcula progresso.
    const outputs = step.extractOutputs?.(result) ?? {};
    instance.stepOutputs = { ...instance.stepOutputs, ...outputs };
    instance.history.push({
      stepId: step.id,
      stepIndex: idx,
      status: "completed",
      startedAt,
      finishedAt,
      outputs,
      skillResultCode: result.code,
    });
    instance.currentStep = idx + 1;
    instance.progress = computeProgressPercent(instance.currentStep, definition.steps.length);
    instance.lastMessage = result.message;
    instance.lastError = null;

    const isLast = instance.currentStep >= definition.steps.length;
    transition(instance, isLast ? "COMPLETED" : "RUNNING");
    this.hooks.onLog?.("step_completed", `${instance.id}#${step.id}`);
    if (isLast) this.hooks.onLog?.("workflow_completed", instance.id);

    return {
      ok: true,
      instance,
      progress: buildProgress(instance, definition),
      stepResult: result,
      message: result.message,
    };
  }

  private finishStepWithError(
    definition: BellaWorkflowDefinition,
    instance: BellaWorkflowInstance,
    step: BellaWorkflowStep,
    idx: number,
    startedAt: number,
    errorMessage: string,
    skillResultCode?: string,
  ): BellaWorkflowExecutionResult {
    instance.history.push({
      stepId: step.id,
      stepIndex: idx,
      status: "failed",
      startedAt,
      finishedAt: Date.now(),
      error: errorMessage,
      skillResultCode,
    });
    transition(instance, "FAILED");
    instance.lastError = errorMessage;
    instance.lastMessage = `Falha em "${step.name}": ${errorMessage}`;
    this.hooks.onLog?.("step_failed", `${instance.id}#${step.id}: ${errorMessage}`);
    return {
      ok: false,
      instance,
      progress: buildProgress(instance, definition),
      message: instance.lastMessage,
    };
  }
}
