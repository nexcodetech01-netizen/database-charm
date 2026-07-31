/**
 * Bella Adapter — Sprint 002
 *
 * Ponte entre a BaseSkill (nova infraestrutura) e o `BellaSkillRegistry`
 * legado consumido pelo runtime atual do agente. Constrói um
 * ExecutionContext mínimo a partir do BellaSkillContext + cliente
 * Supabase autenticado do navegador (RLS aplicada como o usuário).
 *
 * As permissões efetivas do usuário não estão neste ponto — a checagem
 * já é feita pelo `PermissionEngine` de `runAgent` antes de chamar o
 * Registry. Injetamos um SecurityContext permissivo aqui apenas para
 * satisfazer a interface; a barreira real permanece a RLS + a
 * checagem prévia do PermissionEngine.
 */
import type {
  BellaSkill,
  BellaSkillContext,
  BellaSkillPayload,
  BellaSkillResult,
} from "@/features/bella-ai/skills/types";
import type { ZodObject, ZodRawShape } from "zod";
import type { BaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import {
  buildExecutionContext,
  type ExecutionContext,
} from "@/features/bella-ai/agent/infrastructure/context";
import { supabase } from "@/integrations/supabase/client";

function buildCtx(bellaCtx: BellaSkillContext): ExecutionContext {
  const ctx = buildExecutionContext({
    companyId: bellaCtx.companyId,
    userId: bellaCtx.userId ?? null,
    permissions: new Set<string>(["*"]),
    isOwner: true,
    channel: "system",
  });
  // Garante o cliente autenticado do navegador (RLS aplicada como usuário).
  return { ...ctx, supabase };
}

export function adaptBaseSkillToBella<S extends ZodObject<ZodRawShape>, TData>(
  base: BaseSkill<S, TData>,
): BellaSkill<BellaSkillPayload, TData> {
  return {
    id: base.spec.id,
    name: base.spec.name,
    module: base.spec.module,
    description: base.spec.description,
    requiresConfirmation: base.spec.destructive ?? false,
    canExecute: (ctx) => Boolean(ctx.companyId),
    confirmationSummary: base.spec.confirmationSummary
      ? (payload) => base.spec.confirmationSummary!(payload as never)
      : undefined,
    async execute(payload: BellaSkillPayload, ctx: BellaSkillContext): Promise<BellaSkillResult<TData>> {
      const execCtx = buildCtx(ctx);
      // Consumidor já passa "confirmed:true" nas destrutivas (runAgent).
      // Como não temos esse sinal aqui, autorizamos — o PermissionEngine
      // e o pipeline de runAgent já mediaram a confirmação anteriormente.
      return base.run({ payload, ctx: execCtx, confirmed: true });
    },
  };
}
