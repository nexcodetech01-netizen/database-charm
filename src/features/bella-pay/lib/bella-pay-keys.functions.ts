/**
 * Chaves da API do Asaas — leitura mascarada e gravação, sempre no servidor.
 * O navegador nunca recebe a chave completa.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const companyInput = z.object({ companyId: z.string().uuid() });

const keyField = z.string().trim().max(300, "Chave muito longa.").nullable().optional();

const saveInput = z.object({
  companyId: z.string().uuid(),
  apiKeySandbox: keyField,
  apiKeyProduction: keyField,
});

export const getBellaPayKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => companyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { loadBellaPayConfigForUser, toKeyStatus } = await import("./credentials.server");
    const cfg = await loadBellaPayConfigForUser(context, data.companyId);
    return toKeyStatus(cfg);
  });

export const saveBellaPayApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertBellaPayAdmin, loadBellaPayConfigForUser, toKeyStatus, writeBellaPayKeys } =
      await import("./credentials.server");

    await assertBellaPayAdmin(context, data.companyId);
    await writeBellaPayKeys(data.companyId, {
      apiKeySandbox: data.apiKeySandbox,
      apiKeyProduction: data.apiKeyProduction,
    });

    const cfg = await loadBellaPayConfigForUser(context, data.companyId);
    return toKeyStatus(cfg);
  });
