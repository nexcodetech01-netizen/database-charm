/**
 * Skill de Orçamento.
 *
 * Orçamento é modelado como Opportunity no NexOS (CRM). Reutilizamos
 * crmService.createOpportunity para não duplicar regra de negócio.
 */

import { crmService } from "@/features/crm/services/crm.service";
import type { BellaSkill } from "./types";
import { skillResult } from "./types";

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function asAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

export const createQuoteSkill: BellaSkill = {
  id: "quote.create",
  name: "Criar orçamento",
  module: "customer",
  description: "Cria um novo orçamento (oportunidade) no CRM.",
  canExecute: (ctx) => Boolean(ctx.companyId),
  async execute(payload, ctx) {
    const title = asString(payload.title);
    if (!title) {
      return skillResult.missing("Informe os dados do orçamento.", [
        { field: "title", label: "Título do orçamento", type: "text", required: true },
      ]);
    }

    const opportunity = await crmService.createOpportunity({
      company_id: ctx.companyId,
      title,
      customer_id: asString(payload.customerId),
      estimated_value: asAmount(payload.estimatedValue) ?? 0,
      description: asString(payload.description),
      expected_close_date: asString(payload.expectedCloseDate),
      lead_source: asString(payload.leadSource),
      stage_id: asString(payload.stageId),
      assignee: asString(payload.assignee) ?? ctx.userId ?? null,
      created_by: ctx.userId ?? null,
    });

    return skillResult.success(
      `Orçamento "${title}" criado.`,
      opportunity,
      [{ id: "open_crm", title: "Abrir CRM", actionLabel: "Ver" }],
    );
  },
};

export const quoteSkills: BellaSkill[] = [createQuoteSkill];
