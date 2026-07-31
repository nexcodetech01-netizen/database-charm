/**
 * ExecutionLogger — persistência da auditoria em `public.bella_executions`.
 *
 * Falhas ao gravar o log NUNCA propagam para o pipeline principal.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AgentContext, AgentIntent, AgentPlanStep } from "./types";
import type { BellaSkillResult } from "../skills/types";

export interface ExecutionLogInput {
  ctx: AgentContext;
  intent: AgentIntent | null;
  step: AgentPlanStep | null;
  result: BellaSkillResult | null;
  confirmationRequired: boolean;
  confirmed: boolean;
  startedAt: Date;
  finishedAt: Date;
  errorMessage?: string | null;
}

export async function logAgentExecution(input: ExecutionLogInput): Promise<void> {
  try {
    const durationMs = input.finishedAt.getTime() - input.startedAt.getTime();
    await supabase.from("bella_executions").insert({
      company_id: input.ctx.companyId,
      user_id: input.ctx.userId ?? null,
      conversation_id: input.ctx.conversationId ?? null,
      intent: input.intent?.id ?? null,
      skill_id: input.step?.skillId ?? null,
      parameters: JSON.parse(JSON.stringify(input.step?.payload ?? {})),
      confirmation_required: input.confirmationRequired,
      confirmed: input.confirmed,
      success: input.result?.ok ?? false,
      result_code: input.result?.code ?? null,
      error_message: input.errorMessage ?? null,
      execution_time_ms: Math.max(0, durationMs),
      started_at: input.startedAt.toISOString(),
      finished_at: input.finishedAt.toISOString(),
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      // Auditoria nunca deve derrubar o agente.
      console.warn("[bella-agent] falha ao gravar bella_executions", err);
    }
  }
}
