/**
 * System Diagnostics — Health Check server function.
 * Read-only checks: no external side effects (no messages, no charges).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";

export type CheckStatus = "ok" | "warning" | "error";

export interface DiagnosticCheck {
  id: string;
  category: string;
  label: string;
  status: CheckStatus;
  message: string;
}

export interface DiagnosticsResult {
  checks: DiagnosticCheck[];
  overall: CheckStatus;
  ranAt: string;
}

export const runSystemDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticsResult> => {
    const checks: DiagnosticCheck[] = [];
    const { supabase, userId, claims } = context;

    // 1. Database
    try {
      const { error } = await supabase.from("companies").select("id").limit(1);
      checks.push({
        id: "db-connection",
        category: "Banco de Dados",
        label: "Conexão com Supabase",
        status: error ? "error" : "ok",
        message: error ? error.message : "Conexão estabelecida.",
      });
      checks.push({
        id: "db-access",
        category: "Banco de Dados",
        label: "Acesso via RLS",
        status: error ? "error" : "ok",
        message: error
          ? "Falha ao consultar tabela protegida."
          : "Leitura autorizada.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      checks.push({
        id: "db-connection",
        category: "Banco de Dados",
        label: "Conexão com Supabase",
        status: "error",
        message: msg,
      });
      checks.push({
        id: "db-access",
        category: "Banco de Dados",
        label: "Acesso via RLS",
        status: "error",
        message: "Não foi possível validar acesso.",
      });
    }

    // 2. Auth
    checks.push({
      id: "auth-session",
      category: "Autenticação",
      label: "Sessão do usuário",
      status: userId ? "ok" : "error",
      message: userId
        ? `Sessão válida (${claims?.email ?? userId}).`
        : "Sem sessão ativa.",
    });

    // 3. Edge Functions / Server runtime
    checks.push({
      id: "edge-runtime",
      category: "Edge Functions",
      label: "Runtime disponível",
      status: "ok",
      message: "Server functions respondendo normalmente.",
    });

    // 4. Storage
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        checks.push({
          id: "storage-access",
          category: "Storage",
          label: "Acesso ao bucket",
          status: "error",
          message: error.message,
        });
      } else {
        const hasProductImages = data?.some((b) => b.name === "product-images");
        checks.push({
          id: "storage-access",
          category: "Storage",
          label: "Acesso ao bucket",
          status: hasProductImages ? "ok" : "warning",
          message: hasProductImages
            ? `Bucket "product-images" acessível (${data.length} bucket(s)).`
            : "Bucket 'product-images' não encontrado.",
        });
      }
    } catch (err) {
      checks.push({
        id: "storage-access",
        category: "Storage",
        label: "Acesso ao bucket",
        status: "error",
        message: err instanceof Error ? err.message : "Erro ao listar buckets.",
      });
    }

    // 5. WhatsApp Cloud API
    const waToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
    const waPhone = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
    const waWaba = Boolean(process.env.WHATSAPP_WABA_ID);
    checks.push({
      id: "wa-token",
      category: "WhatsApp",
      label: "Access Token",
      status: waToken ? "ok" : "warning",
      message: waToken ? "Token configurado." : "WHATSAPP_ACCESS_TOKEN ausente.",
    });
    checks.push({
      id: "wa-phone",
      category: "WhatsApp",
      label: "Phone Number ID",
      status: waPhone ? "ok" : "warning",
      message: waPhone
        ? "Phone Number ID configurado."
        : "WHATSAPP_PHONE_NUMBER_ID ausente.",
    });
    checks.push({
      id: "wa-waba",
      category: "WhatsApp",
      label: "WABA ID",
      status: waWaba ? "ok" : "warning",
      message: waWaba ? "WABA ID configurado." : "WHATSAPP_WABA_ID ausente.",
    });

    // 6. Asaas (Bella Pay)
    const asaasWebhookToken = Boolean(process.env.ASAAS_WEBHOOK_ACCESS_TOKEN);
    checks.push({
      id: "asaas-webhook-token",
      category: "Asaas",
      label: "Webhook Access Token",
      status: asaasWebhookToken ? "ok" : "error",
      message: asaasWebhookToken
        ? "Token de autenticação do webhook configurado."
        : "ASAAS_WEBHOOK_ACCESS_TOKEN ausente — o webhook do Asaas responde 503 (fail-closed) enquanto isso não for configurado, e nenhum evento de pagamento é sincronizado.",
    });
    try {
      // `claims` (o JWT do Supabase Auth) nunca teve `company_id` como campo
      // — esse projeto não usa um Auth Hook de custom claims. O jeito
      // correto de resolver a empresa do usuário, usado em todo o resto do
      // código (mercadolivre, knowledge, external-orders, meta...), é
      // resolveCompanyId(supabase, userId), que consulta profiles/user_roles.
      let companyId: string | null = null;
      try {
        companyId = await resolveCompanyId(supabase, userId);
      } catch {
        companyId = null;
      }

      if (!companyId) {
        checks.push({
          id: "asaas-key",
          category: "Asaas",
          label: "API Key",
          status: "warning",
          message: "Nenhuma empresa associada a este usuário — não foi possível validar a configuração do Bella Pay.",
        });
      } else {
        // Buscamos EXATAMENTE nas colunas api_key_sandbox e api_key_production da tabela bella_pay_config
        const { data: asaasCfg, error: cfgError } = await supabase
          .from("bella_pay_config")
          .select("api_key_production, api_key_sandbox, environment")
          .eq("company_id", companyId)
          .maybeSingle();

        if (cfgError) {
          console.error("[Diagnostics] Error querying bella_pay_config:", cfgError);
          checks.push({
            id: "asaas-key",
            category: "Asaas",
            label: "API Key",
            status: "error",
            message: `Erro de banco/RLS ao consultar configuração: ${cfgError.message}`,
          });
        } else {
          // Se qualquer uma das chaves estiver presente e não for vazia, status OK.
          // Consideramos OK mesmo se for apenas uma delas, pois o usuário pode usar apenas um ambiente.
          const hasKey = Boolean(asaasCfg?.api_key_production || asaasCfg?.api_key_sandbox);
          
          checks.push({
            id: "asaas-key",
            category: "Asaas",
            label: "API Key",
            status: hasKey ? "ok" : "warning",
            message: hasKey
              ? `API Key configurada no banco (ambiente ativo: ${asaasCfg?.environment ?? "sandbox"}).`
              : "Chave do Asaas não configurada (Configurações → Bella Pay).",
          });
        }
      }
    } catch (err) {
      console.error("[Diagnostics] Unexpected error in Asaas check:", err);
      checks.push({
        id: "asaas-key",
        category: "Asaas",
        label: "API Key",
        status: "error",
        message: "Erro inesperado ao consultar diagnóstico do Asaas.",
      });
    }

    // 7. Bella IA
    const lovableKey = Boolean(process.env.LOVABLE_API_KEY);
    checks.push({
      id: "bella-ai",
      category: "Bella IA",
      label: "Configuração de IA",
      status: lovableKey ? "ok" : "warning",
      message: lovableKey
        ? "Lovable AI Gateway configurado."
        : "LOVABLE_API_KEY ausente.",
    });

    const hasError = checks.some((c) => c.status === "error");
    const hasWarning = checks.some((c) => c.status === "warning");
    const overall: CheckStatus = hasError
      ? "error"
      : hasWarning
        ? "warning"
        : "ok";

    return {
      checks,
      overall,
      ranAt: new Date().toISOString(),
    };
  });
