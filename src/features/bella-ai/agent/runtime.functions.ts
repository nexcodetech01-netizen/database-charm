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
      confirmed: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    // 1. Authenticate using TanStack context (provided by middleware)
    const userId = (context as any).userId;
    
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 2. Resolve internal dependencies within handler to avoid client leak
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 3. Validate multi-tenant access
    await assertCompanyAccess(supabaseAdmin, userId, data.ctx.companyId);

    // 4. Fetch permissions server-side
    const perms = await fetchUserPermissions(userId, data.ctx.companyId);

    // 5. Build ExecutionContext with the user's Supabase client
    const { buildExecutionContext } = await import("./infrastructure/context");
    // Note: We need a way to pass the user's session supabase client here.
    // TanStack Start middleware usually adds it to context.
    const userSupabase = (context as any).supabase;

    // 6. Execute runtime
    const result = await handleWithAgentRuntime({
      message: data.message,
      ctx: {
        companyId: data.ctx.companyId,
        userId,
        permissions: perms.permissions,
        isOwner: perms.isOwner,
        conversationId: data.ctx.conversationId,
        supabase: userSupabase, // Inject the authenticated client
      },
      confirmed: data.confirmed,
    });

    // Recursively sanitize to ensure pure serializability (Set to Array, etc.)
    const sanitize = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Set) return Array.from(obj);
      if (Array.isArray(obj)) return obj.map(sanitize);
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, sanitize(v)])
      );
    };

    return sanitize(result);
  });
