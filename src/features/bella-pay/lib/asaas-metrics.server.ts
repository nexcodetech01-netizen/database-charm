/**
 * Métricas e alertas de chamadas ao Asaas (server-side).
 *
 * - `recordAsaasApiCall`: grava um evento em `bella_pay_api_metrics`. Toda
 *   escrita é best-effort — falhas de log NUNCA quebram a operação de negócio.
 * - `raiseAsaasFailureAlert`: em produção, emite um alerta em
 *   `assistant_alerts` (severity=critical) quando POST /customers ou
 *   POST /payments falham, com rate-limit de 15 min por subtipo/empresa.
 *
 * Recebe um cliente Supabase autenticado (RLS aplica) — não use o admin
 * client. As leituras e escritas são escopadas por `company_id`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AsaasEnv = "sandbox" | "production";

export interface AsaasApiCallEvent {
  companyId: string;
  environment: AsaasEnv;
  endpoint: string;
  method: string;
  ok: boolean;
  status?: number;
  durationMs?: number;
  errorMessage?: string;
  errorBody?: unknown;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAsaasApiCall(
  supabase: SupabaseClient,
  event: AsaasApiCallEvent,
): Promise<void> {
  try {
    await supabase.from("bella_pay_api_metrics").insert({
      company_id: event.companyId,
      environment: event.environment,
      endpoint: event.endpoint,
      method: event.method,
      ok: event.ok,
      status: event.status ?? null,
      duration_ms: event.durationMs ?? null,
      error_message: event.errorMessage ?? null,
      error_body: (event.errorBody as object | null) ?? null,
      correlation_id: event.correlationId ?? null,
      metadata: event.metadata ?? {},
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        scope: "asaas-metrics",
        level: "warn",
        msg: "failed to record metric",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

const RATE_LIMIT_MINUTES = 15;

/** Emite alerta crítico em `assistant_alerts` (rate-limited por subtipo/empresa). */
export async function raiseAsaasFailureAlert(
  supabase: SupabaseClient,
  args: {
    companyId: string;
    environment: AsaasEnv;
    endpoint: "/customers" | "/payments" | string;
    errorMessage: string;
    status?: number;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  // Alertas críticos apenas em produção — sandbox gera muito ruído.
  if (args.environment !== "production") return;

  const subtype = `asaas_${args.endpoint.replace(/^\//, "")}_failure`;

  try {
    // Rate-limit: se já existe alerta aberto do mesmo subtipo nos últimos 15 min, pula.
    const since = new Date(
      Date.now() - RATE_LIMIT_MINUTES * 60_000,
    ).toISOString();
    const { data: recent } = await supabase
      .from("assistant_alerts")
      .select("id")
      .eq("company_id", args.companyId)
      .eq("status", "open")
      .contains("metadata", { subtype })
      .gte("triggered_at", since)
      .limit(1);
    if (recent && recent.length > 0) return;

    const title =
      args.endpoint === "/customers"
        ? "Falha ao criar cliente no Asaas (Produção)"
        : args.endpoint === "/payments"
          ? "Falha ao gerar cobrança no Asaas (Produção)"
          : `Falha em ${args.endpoint} no Asaas (Produção)`;

    await supabase.from("assistant_alerts").insert({
      company_id: args.companyId,
      alert_type: "custom",
      severity: "critical",
      title,
      message: args.errorMessage.slice(0, 500),
      status: "open",
      metadata: {
        subtype,
        environment: args.environment,
        endpoint: args.endpoint,
        status: args.status ?? null,
        ...(args.context ?? {}),
      },
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        scope: "asaas-metrics",
        level: "warn",
        msg: "failed to raise alert",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
