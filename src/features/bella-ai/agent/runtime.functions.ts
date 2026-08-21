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
    // Note: TanStack Start v1 middleware context is accessible via context.auth or injected keys
    // For this project, userId is typically injected by attachSupabaseAuth or similar
    const userId = (context as any).userId;
    
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 2. Validate multi-tenant access using the dedicated server-side resolver
    // Note: assertCompanyAccess in this project usually takes (supabase, userId, companyId)
    await assertCompanyAccess(supabaseAdmin, userId, data.ctx.companyId);

    // 3. Fetch permissions server-side (do not trust client-sent permissions)
    const perms = await fetchUserPermissions(userId, data.ctx.companyId);

    // 4. Execute runtime with server-side context
    // This is safe because this handler only runs on the server
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

    // Ensure the result is serializable for the transport layer
    return JSON.parse(JSON.stringify(result));
  });
