import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { handleWithAgentRuntime } from "./runtime";
import { assertCompanyAccess } from "@/features/auth/utils.server";
import { fetchUserPermissions } from "@/features/rbac/lib/fetch-permissions";

export const handleAgentRuntimeFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      message: z.string(),
      ctx: z.object({
        companyId: z.string(),
        conversationId: z.string().optional().nullable(),
      }),
      confirmed: z.boolean().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    // 1. Authenticate and authorize using Supabase context from middleware
    const { userId } = context;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 2. Validate multi-tenant access
    await assertCompanyAccess(data.ctx.companyId, userId);

    // 3. Fetch permissions server-side (do not trust client)
    const perms = await fetchUserPermissions(userId, data.ctx.companyId);

    // 4. Execute runtime with server-side context
    return await handleWithAgentRuntime({
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
  });
