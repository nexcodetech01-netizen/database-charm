/**
 * Server Functions — Bella Process Studio.
 *
 * A camada Studio persiste em memória (mesmo padrão do BellaSkillRegistry,
 * BellaWorkflowRegistry, AutomationRegistry). Estas server functions
 * expõem os verbos essenciais autenticados para clientes que preferirem
 * chamar via RPC (ex.: futuros consumidores externos ou testes).
 *
 * Regra: nenhum efeito real acontece aqui — a publicação apenas registra
 * a definição compilada no BellaWorkflowRegistry existente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ProcessStudio } from "@/features/bella-ai/process-studio/ProcessStudio";
import type { FlowNode } from "@/features/bella-ai/process-studio/types";

// TanStack Start valida serialização estrutural das respostas. Como o Studio
// utiliza `Record<string, unknown>` em `config`, fazemos um round-trip JSON
// (segurança de serialização) e devolvemos como `unknown` — a UI consome via
// hooks locais tipados, não via server function.
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
const toJson = <T,>(v: T): JsonValue => JSON.parse(JSON.stringify(v)) as JsonValue;


const flowIdInput = z.object({ companyId: z.string().min(1), flowId: z.string().min(1) });

export const createProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        companyId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) =>
    toJson(
      ProcessStudio.create({
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        authorId: context.userId,
      }),
    ),
  );

export const validateProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => flowIdInput.parse(raw))
  .handler(async ({ data }) => toJson(ProcessStudio.validate(data.companyId, data.flowId)));

export const simulateProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => flowIdInput.parse(raw))
  .handler(async ({ data }) => toJson(ProcessStudio.simulate(data.companyId, data.flowId)));

export const publishProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => flowIdInput.parse(raw))
  .handler(async ({ data, context }) =>
    toJson(ProcessStudio.publish(data.companyId, data.flowId, context.userId)),
  );

export const rollbackProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    flowIdInput.extend({ targetVersion: z.number().int().min(1) }).parse(raw),
  )
  .handler(async ({ data, context }) =>
    toJson(
      ProcessStudio.rollback(data.companyId, data.flowId, data.targetVersion, context.userId),
    ),
  );

export const listProcessVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => flowIdInput.parse(raw))
  .handler(async ({ data }) => toJson(ProcessStudio.listVersions(data.companyId, data.flowId)));

export const updateProcessFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    flowIdInput.extend({
      name: z.string().optional(),
      description: z.string().optional(),
      nodes: z.array(z.custom<FlowNode>()).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) =>
    toJson(
      ProcessStudio.update(data.companyId, data.flowId, {
        name: data.name,
        description: data.description,
        nodes: data.nodes,
        actorId: context.userId,
      }),
    ),
  );

