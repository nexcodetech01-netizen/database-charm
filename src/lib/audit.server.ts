/**
 * Trilha de auditoria de segurança (server-only).
 *
 * Escreve em `public.security_audit_log` através da função
 * SECURITY DEFINER `public.log_security_audit`, que é append-only:
 * nem mesmo o dono da empresa pode alterar ou remover registros.
 *
 * Regras:
 *  - NUNCA lança. Auditoria não pode derrubar a operação de negócio.
 *  - Payloads passam pelo mascaramento de PII/segredos do observability.
 *  - IP / User-Agent / correlation-id são extraídos do Request quando
 *    disponíveis (Worker edge — `getRequest()` pode não existir em testes).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { maskDeep as maskSensitive, readOrCreateCorrelationId } from "@/lib/observability";

type SB = SupabaseClient<Database>;

export type AuditResult = "success" | "denied" | "error";

export interface AuditEntry {
  readonly companyId: string | null;
  readonly action: string;
  readonly module: string;
  readonly resourceTable?: string | null;
  readonly resourceId?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly result?: AuditResult;
  readonly error?: string | null;
}

interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  correlationId: string | null;
}

async function readRequestMeta(): Promise<RequestMeta> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const headers = request?.headers;
    if (!headers) return { ip: null, userAgent: null, correlationId: null };
    const xff = headers.get("x-forwarded-for");
    return {
      ip: headers.get("cf-connecting-ip") ?? (xff ? xff.split(",")[0]!.trim() : null),
      userAgent: headers.get("user-agent")?.slice(0, 512) ?? null,
      correlationId: readOrCreateCorrelationId(request),
    };
  } catch {
    return { ip: null, userAgent: null, correlationId: null };
  }
}

function toJson(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  const masked = maskSensitive(value);
  if (typeof masked === "object" && !Array.isArray(masked)) {
    return masked as Record<string, unknown>;
  }
  return { value: masked } as Record<string, unknown>;
}

/** Registra um evento de auditoria. Best-effort: erros são apenas logados. */
export async function recordAudit(supabase: SB, entry: AuditEntry): Promise<void> {
  try {
    const meta = await readRequestMeta();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("log_security_audit", {
      _company_id: entry.companyId,
      _action: entry.action,
      _module: entry.module,
      _resource_table: entry.resourceTable ?? null,
      _resource_id: entry.resourceId ?? null,
      _before: toJson(entry.before),
      _after: toJson(entry.after),
      _result: entry.result ?? "success",
      _error: entry.error ?? null,
      _ip: meta.ip,
      _user_agent: meta.userAgent,
      _correlation_id: meta.correlationId,
    });
    if (error) {
      console.warn("[audit] falha ao registrar", { action: entry.action, error: error.message });
    }
  } catch (err) {
    console.warn("[audit] exceção ao registrar", {
      action: entry.action,
      error: (err as Error).message,
    });
  }
}
