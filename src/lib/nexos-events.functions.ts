/**
 * Server Functions do Bella Event Engine.
 *
 * Persistência auditável na tabela `nexos_event_log`, com RLS por empresa.
 * A execução das reações continua sendo feita pelo runtime do cliente
 * (via `NexosEventEngine`) e pelas engines já existentes (Workflow,
 * Automation, Skills) — este arquivo apenas grava/consulta o rastro.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const priorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
const statusEnum = z.enum(["pending", "processing", "success", "error", "skipped"]);

const persistSchema = z.object({
  companyId: z.string().uuid(),
  type: z.string().min(1),
  module: z.string().min(1),
  priority: priorityEnum.default("NORMAL"),
  source: z.string().optional(),
  dedupeKey: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
});

export const persistNexosEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => persistSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("nexos_event_log")
      .upsert(
        {
          company_id: data.companyId,
          user_id: userId,
          type: data.type,
          module: data.module,
          priority: data.priority,
          source: data.source ?? null,
          dedupe_key: data.dedupeKey ?? null,
          payload: data.payload as never,
          status: "pending",
        },
        { onConflict: "company_id,type,dedupe_key", ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id ?? null, deduped: !row };
  });

const listSchema = z.object({
  companyId: z.string().uuid(),
  status: statusEnum.optional(),
  type: z.string().optional(),
  module: z.string().optional(),
  priority: priorityEnum.optional(),
  since: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const listNexosEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSchema.parse(data))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("nexos_event_log")
      .select("*")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.type) q = q.eq("type", data.type);
    if (data.module) q = q.eq("module", data.module);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.since) q = q.gte("created_at", data.since);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const metricsSchema = z.object({ companyId: z.string().uuid() });

export const getNexosEventMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => metricsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("nexos_event_log")
      .select("status,created_at")
      .eq("company_id", data.companyId)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    return {
      perHour: list.length,
      processed: list.filter((r) => r.status === "success" || r.status === "skipped").length,
      failures: list.filter((r) => r.status === "error").length,
      pending: list.filter((r) => r.status === "pending" || r.status === "processing").length,
    };
  });

const reprocessSchema = z.object({ companyId: z.string().uuid(), eventId: z.string().uuid() });

export const reprocessNexosEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reprocessSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("nexos_event_log")
      .update({ status: "pending", error: null, processed_at: null })
      .eq("company_id", data.companyId)
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
