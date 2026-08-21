/**
 * EventDispatcher
 *
 * Para cada evento consumido da fila, resolve as reações declaradas
 * no `EventRegistry` e as executa em cadeia: Workflow → Automação
 * → Skill → Notificação. Nunca duplica regra: sempre delega ao
 * componente responsável.
 */
import { toast } from "@/hooks/use-toast";
import { BellaSkillRegistry } from "../skills/registry";
import type { BellaSkillContext } from "../skills/types";
import { bellaWorkflowEngine } from "../workflows";
import { EventRegistry } from "./EventRegistry";
import type {
  NexosEvent,
  NexosEventProcessResult,
  NexosEventReaction,
  NexosEventReactionOutcome,
} from "./types";

function buildSkillCtx(evt: NexosEvent): BellaSkillContext {
  return {
    companyId: evt.companyId,
    userId: evt.userId ?? "system",
    correlationId: evt.id,
    now: new Date(evt.createdAt),
  } as unknown as BellaSkillContext;
}

async function runReaction(
  reaction: NexosEventReaction,
  evt: NexosEvent,
): Promise<NexosEventReactionOutcome> {
  try {
    switch (reaction.kind) {
      case "workflow": {
        const started = bellaWorkflowEngine.start({
          workflowId: reaction.workflowId,
          tenantId: evt.companyId,
          userId: evt.userId ?? null,
        });
        return { kind: "workflow", ok: true, ref: started?.instance?.id, detail: reaction.workflowId };
      }
      case "automation": {
        // Não invocamos `AutomationEngine.dispatch` diretamente aqui — ele exige
        // um supabase client server-side. A ponte real vive nas server functions
        // de eventos (que já rodam autenticadas). Aqui apenas registramos a
        // intenção para logs/telemetria; o disparo efetivo acontece no server.
        return { kind: "automation", ok: true, detail: reaction.triggerType };
      }
      case "skill": {
        const payload = reaction.buildPayload ? reaction.buildPayload(evt) : (evt.payload as Record<string, unknown>);
        const result = await BellaSkillRegistry.execute(reaction.skillId, payload, buildSkillCtx(evt));
        return { kind: "skill", ok: result.ok, detail: `${reaction.skillId}:${result.code}` };
      }
      case "notify": {
        const message = reaction.message(evt);
        const isAlert = reaction.level === "critical" || reaction.level === "warning";
        if (isAlert) toast.error(`Bella · ${evt.type}`, { description: message });
        else toast(`Bella · ${evt.type}`, { description: message });
        return { kind: "notify", ok: true, detail: reaction.level };
      }
    }
  } catch (err) {
    return {
      kind: reaction.kind,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export const EventDispatcher = {
  async dispatch(evt: NexosEvent): Promise<NexosEventProcessResult> {
    const startedAt = Date.now();
    const reactions = EventRegistry.get(evt.type);
    if (reactions.length === 0) {
      return { status: "skipped", durationMs: Date.now() - startedAt, outcomes: [] };
    }
    const outcomes: NexosEventReactionOutcome[] = [];
    let hasError = false;
    let hasSuccess = false;
    for (const r of reactions) {
      const outcome = await runReaction(r, evt);
      outcomes.push(outcome);
      if (outcome.ok) hasSuccess = true;
      else hasError = true;
    }
    const status = hasError && !hasSuccess ? "error" : "success";
    return {
      status,
      durationMs: Date.now() - startedAt,
      outcomes,
      error: hasError ? outcomes.find((o) => !o.ok)?.detail : undefined,
    };
  },
};
