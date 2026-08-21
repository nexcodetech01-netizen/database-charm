/**
 * ExecutionContext / RequestContext / SecurityContext
 *
 * Contexto padronizado propagado por toda a stack do Agente Operacional
 * (Runtime → BaseSkill → BaseService). Nunca carrega credenciais brutas;
 * apenas identificadores e o cliente Supabase autenticado.
 *
 * SEGURANÇA:
 *  - `supabase` é SEMPRE o cliente autenticado do usuário (RLS ativa).
 *  - `supabaseAdmin` é proibido nesta camada — operações privilegiadas
 *    vivem em arquivos `*.server.ts` dedicados.
 *  - `companyId` DEVE vir de fonte confiável (perfil autenticado /
 *    conversation lookup), nunca de payload do usuário.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionCode } from "@/features/rbac/lib/permission-codes";
import { supabase } from "@/integrations/supabase/client";

export interface RequestContext {
  /** Trace id propagado ponta-a-ponta (WhatsApp/Web/Debug). */
  requestId: string;
  /** Origem da requisição — usada em métricas e auditoria. */
  channel: "whatsapp" | "web" | "debug" | "automation" | "system";
  /** Momento em que a requisição entrou no runtime. */
  startedAt: Date;
  /** Locale efetivo (default pt-BR). */
  locale?: string;
}

export interface SecurityContext {
  /** Permissões efetivas resolvidas para o usuário (owner recebe {"*"}). */
  permissions: ReadonlySet<string>;
  isOwner: boolean;
  /**
   * Retorna true quando o contexto satisfaz UMA das permissões requeridas.
   * Owner ("*") sempre passa.
   */
  can(codes: readonly PermissionCode[]): boolean;
}

export interface ExecutionContext {
  companyId: string;
  userId: string | null;
  conversationId: string | null;
  request: RequestContext;
  security: SecurityContext;
  /** Cliente Supabase autenticado — RLS aplicada como o usuário. */
  supabase: SupabaseClient;
}

export function makeSecurityContext(
  permissions: Set<string> | ReadonlySet<string>,
  isOwner: boolean,
): SecurityContext {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return {
    permissions: set,
    isOwner,
    can(codes) {
      if (isOwner) return true;
      if (set.has("*")) return true;
      for (const c of codes) if (set.has(c)) return true;
      return false;
    },
  };
}

export interface BuildExecutionContextInput {
  companyId: string;
  userId: string | null;
  conversationId?: string | null;
  permissions: Set<string> | ReadonlySet<string>;
  isOwner: boolean;
  channel: RequestContext["channel"];
  requestId?: string;
  locale?: string;
  supabase?: SupabaseClient; // Added optional supabase override
}

export function buildExecutionContext(input: BuildExecutionContextInput): ExecutionContext {
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
    supabase: input.supabase ?? (typeof window !== 'undefined' ? supabase : undefined) as any,
  };
}

function cryptoRandomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* noop */
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
