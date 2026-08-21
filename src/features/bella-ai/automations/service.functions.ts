/**
 * Automations — server functions.
 *
 * Todas as leituras/mutations passam por `requireSupabaseAuth`, então a
 * RLS de `bella_automations` continua sendo a fonte da verdade sobre
 * quem pode ver o quê.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import { z } from "zod";
import { AUTOMATION_TEMPLATES, getTemplate } from "./templates";
import { AutomationValidator } from "./AutomationValidator";
import { mapAutomationRow, type AutomationRow } from "./AutomationRegistry";
import { AutomationEngine } from "./AutomationEngine";
import type { Automation, AutomationEvent, AutomationRun, AutomationTriggerType } from "./types";

const uuid = z.string().uuid();

/* -------------------- LIST -------------------- */

export const listAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<Automation[]> => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: rows, error } = await db
      .from("bella_automations")
      .select("*")
      .eq("company_id", data.companyId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as AutomationRow[]).map(mapAutomationRow);
  });

/* -------------------- LIST RUNS -------------------- */

export const listAutomationRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        companyId: uuid,
        automationId: uuid.optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AutomationRun[]> => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    let q = db
      .from("bella_automation_runs")
      .select("*")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.automationId) q = q.eq("automation_id", data.automationId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      automationId: r.automation_id,
      companyId: r.company_id,
      triggerType: r.trigger_type,
      triggerPayload: r.trigger_payload ?? {},
      status: r.status,
      durationMs: r.duration_ms,
      actionsSummary: Array.isArray(r.actions_summary) ? r.actions_summary : [],
      error: r.error,
      createdAt: r.created_at,
    }));
  });

/* -------------------- CREATE FROM TEMPLATE -------------------- */

export const createAutomationFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ companyId: uuid, templateId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // 1. Resolve internal dependencies within handler to avoid client leak
    const { BellaSkillRegistry } = await import("../skills/registry" + "");
    
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.create", {
      companyId: data.companyId,
      action: "bella.automation.create",
      module: "bella_ia",
    });
    const tpl = getTemplate(data.templateId);
    if (!tpl) throw new Error(`Template "${data.templateId}" não encontrado.`);
    const issues = AutomationValidator.validate(
      {
        name: tpl.name,
        triggerType: tpl.triggerType,
        actions: tpl.actions,
        conditions: tpl.conditions,
      },
      { skills: BellaSkillRegistry }
    );
    // Sem falhar hard: um template pode referenciar Skill ainda não registrada;
    // ainda assim persiste como desabilitada para o usuário editar depois.
    const enabled = issues.length === 0;
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: row, error } = await db
      .from("bella_automations")
      .insert({
        company_id: data.companyId,
        name: tpl.name,
        description: tpl.description,
        enabled,
        trigger_type: tpl.triggerType,
        trigger_config: {},
        conditions: tpl.conditions,
        actions: tpl.actions,
        template_id: tpl.id,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { automation: mapAutomationRow(row as AutomationRow), issues };
  });

/* -------------------- TOGGLE / DELETE -------------------- */

export const setAutomationEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: uuid, enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.update", {
      action: "bella.automation.toggle",
      module: "bella_ia",
    });
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { error } = await db
      .from("bella_automations")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.delete", {
      action: "bella.automation.delete",
      module: "bella_ia",
    });
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { error } = await db.from("bella_automations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- DRY RUN / TEST -------------------- */

const testInput = z.object({
  automationId: uuid,
  companyId: uuid,
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const runAutomationTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: row, error } = await db
      .from("bella_automations")
      .select("*")
      .eq("id", data.automationId)
      .eq("company_id", data.companyId)
      .single();
    if (error) throw new Error(error.message);
    const automation = mapAutomationRow(row as AutomationRow);
    const event: AutomationEvent = {
      companyId: data.companyId,
      triggerType: automation.triggerType as AutomationTriggerType,
      payload: data.payload,
      source: "manual-test",
    };
    return AutomationEngine.dispatch(db, event);
  });

/* -------------------- STATIC TEMPLATES -------------------- */

export const listAutomationTemplates = createServerFn({ method: "GET" }).handler(async () => {
  return AUTOMATION_TEMPLATES;
});
