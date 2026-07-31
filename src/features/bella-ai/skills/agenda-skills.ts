/**
 * Skills do módulo Agenda.
 * Reutiliza agendaService.create.
 */

import { agendaService } from "@/features/agenda/services/agenda.service";
import type { BellaSkill } from "./types";
import { skillResult } from "./types";

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function asIsoDateTime(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const createAppointmentSkill: BellaSkill = {
  id: "agenda.create_appointment",
  name: "Criar agendamento",
  module: "sales", // agenda ainda não é um BellaModuleKey próprio; mapeamos para o módulo comercial.
  description: "Cria um novo agendamento no calendário.",
  canExecute: (ctx) => Boolean(ctx.companyId),
  async execute(payload, ctx) {
    const title = asString(payload.title);
    const startsAt = asIsoDateTime(payload.startsAt);
    const endsAt = asIsoDateTime(payload.endsAt);

    const missing = [];
    if (!title) missing.push({ field: "title", label: "Título", type: "text" as const, required: true as const });
    if (!startsAt) missing.push({ field: "startsAt", label: "Início", type: "datetime" as const, required: true as const });
    if (!endsAt) missing.push({ field: "endsAt", label: "Término", type: "datetime" as const, required: true as const });
    if (missing.length) return skillResult.missing("Informe os dados do agendamento.", missing);

    const appointment = await agendaService.create({
      company_id: ctx.companyId,
      title: title!,
      starts_at: startsAt!,
      ends_at: endsAt!,
      customer_id: asString(payload.customerId),
      assignee: asString(payload.assignee) ?? ctx.userId ?? null,
      notes: asString(payload.notes),
      location: asString(payload.location),
      created_by: ctx.userId ?? null,
    });

    return skillResult.success(
      `Agendamento "${title}" criado.`,
      appointment,
      [{ id: "open_agenda", title: "Abrir agenda", actionLabel: "Ver" }],
    );
  },
};

export const agendaSkills: BellaSkill[] = [createAppointmentSkill];
