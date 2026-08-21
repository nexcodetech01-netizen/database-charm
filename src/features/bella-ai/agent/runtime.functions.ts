import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { handleWithAgentRuntime } from "./runtime";
import { assertCompanyAccess } from "@/lib/company-resolver.server";
import { fetchUserPermissions } from "@/features/rbac/lib/fetch-permissions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    // 1. Authenticate and authorize using Supabase context from middleware
    // Note: TanStack Start v1 middleware context is accessible via context
    const userId = (context as any).userId;
    
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 2. Validate multi-tenant access using the dedicated server-side resolver
    await assertCompanyAccess(supabaseAdmin, userId, data.ctx.companyId);

    // 3. Fetch permissions server-side (do not trust client-sent permissions)
    const perms = await fetchUserPermissions(userId, data.ctx.companyId);

    // 4. Execute runtime with server-side context
    const result = await handleWithAgentRuntime({
      message: data.message,
      ctx: {
        companyId: data.ctx.companyId,
        userId,
        permissions: perms.permissions,
        isOwner: perms.isOwner,
        conversationId: data.ctx.conversationId,
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
