import { supabase } from "@/integrations/supabase/client";
export function makeSecurityContext(permissions, isOwner) {
    const set = permissions instanceof Set ? permissions : new Set(permissions);
    return {
        permissions: set,
        isOwner,
        can(codes) {
            if (isOwner)
                return true;
            if (set.has("*"))
                return true;
            for (const c of codes)
                if (set.has(c))
                    return true;
            return false;
        },
    };
}
export function buildExecutionContext(input) {
    return {
        companyId: input.companyId,
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        request: {
            requestId: input.requestId ?? cryptoRandomId(),
            channel: input.channel,
            startedAt: new Date(),
            locale: input.locale ?? "pt-BR",
        },
        security: makeSecurityContext(input.permissions, input.isOwner),
        supabase,
    };
}
function cryptoRandomId() {
    try {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
            return crypto.randomUUID();
        }
    }
    catch {
        /* noop */
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
