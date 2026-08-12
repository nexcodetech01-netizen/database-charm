/**
 * System Diagnostics — Health Check server function.
 * Read-only checks: no external side effects (no messages, no charges).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // 6. Asaas
    try {
      const { data: asaasCfg } = await supabase
        .from("bella_pay_config")
        .select("api_key_production, api_key_sandbox, environment")
        .eq("company_id", claims?.company_id || "")
        .maybeSingle();

      const asaasKey = Boolean(asaasCfg?.api_key_production || asaasCfg?.api_key_sandbox);
      checks.push({
        id: "asaas-key",
        category: "Asaas",
        label: "API Key",
        status: asaasKey ? "ok" : "warning",
        message: asaasKey
          ? `API Key configurada no banco (${asaasCfg?.environment ?? "sandbox"}).`
          : "ASAAS_API_KEY ausente na tabela bella_pay_config.",
      });
    } catch (err) {
      checks.push({
        id: "asaas-key",
        category: "Asaas",
        label: "API Key",
        status: "error",
        message: "Erro ao consultar configuração do Asaas no banco.",
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
