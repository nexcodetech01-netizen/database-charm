import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AIProviderId } from "./types";

export interface BellaAIConfig {
  provider: AIProviderId;
}

export const getBellaAIConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<BellaAIConfig> => {
    const provider = (process.env.BELLA_AI_PROVIDER as AIProviderId) || "gemini";
    return { provider };
  });
