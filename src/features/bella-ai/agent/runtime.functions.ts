import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { handleWithAgentRuntime } from "./runtime";
import { assertCompanyAccess } from "@/lib/company-resolver.server";
import { fetchUserPermissions } from "@/features/rbac/lib/fetch-permissions";

export const handleAgentRuntimeFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      message: z.string(),
      ctx: z.object({
        companyId: z.string(),
        conversationId: z.string().optional().nullable(),
      }),
    })
  )
  .handler(async ({ data, context }) => {
    // 1. Authenticate using TanStack context
    const userId = (context as any).userId;
    if (!userId) throw new Error("Unauthorized");

    // 2. Resolve dependencies
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { handleWithAgentRuntime } = await import("./runtime");
    const { fetchUserPermissions } = await import("@/features/rbac/lib/fetch-permissions");

    // 3. Validate access
    await assertCompanyAccess(supabaseAdmin, userId, data.ctx.companyId);

    // 4. Fetch permissions
    const perms = await fetchUserPermissions(userId, data.ctx.companyId);
    const userSupabase = (context as any).supabase;

    // 5. Execute planning
    const result = await handleWithAgentRuntime({
      message: data.message,
      ctx: {
        companyId: data.ctx.companyId,
        userId,
        permissions: perms.permissions,
        isOwner: perms.isOwner,
        conversationId: data.ctx.conversationId,
        supabase: userSupabase,
      },
      confirmed: false, // Força planejamento
    });

    return sanitize(result);
  });

export const executeAgentActionFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      intent: z.any(),
      ctx: z.object({
        companyId: z.string(),
        conversationId: z.string().optional().nullable(),
      }),
    })
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    if (!userId) throw new Error("Unauthorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAgent } = await import("./agent");
    const { fetchUserPermissions } = await import("@/features/rbac/lib/fetch-permissions");

    await assertCompanyAccess(supabaseAdmin, userId, data.ctx.companyId);

    const perms = await fetchUserPermissions(userId, data.ctx.companyId);
    const userSupabase = (context as any).supabase;

    // EXECUÇÃO REAL
    const response = await runAgent({
      intent: data.intent,
      ctx: {
        companyId: data.ctx.companyId,
        userId,
        permissions: perms.permissions,
        isOwner: perms.isOwner,
        conversationId: data.ctx.conversationId,
        supabase: userSupabase,
      },
      confirmed: true,
    });

    return sanitize(response);
  });

// Recursively sanitize to ensure pure serializability
const sanitize = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Set) return Array.from(obj);
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj instanceof Date) return obj.toISOString();
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, sanitize(v)])
  );
};
