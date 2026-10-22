/**
 * Credenciais do Bella Pay (Asaas) — SOMENTE servidor.
 *
 * As chaves da API do Asaas (`api_key_sandbox` / `api_key_production`) nunca
 * são lidas pelo navegador: o banco revoga o acesso a essas colunas para o
 * papel `authenticated`. Toda leitura passa por aqui, com service role, depois
 * de validar que o usuário logado pertence à empresa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertCompanyAccess } from "@/lib/company-resolver.server";

export type BellaPayConfigRow = Database["public"]["Tables"]["bella_pay_config"]["Row"];

export interface BellaPayAuthedContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

/**
 * Lê a configuração completa (inclusive chaves) de uma empresa, depois de
 * confirmar que o usuário tem vínculo com ela. Retorna `null` se não houver
 * configuração.
 */
export async function loadBellaPayConfigForUser(
  ctx: BellaPayAuthedContext,
  companyId: string,
): Promise<BellaPayConfigRow | null> {
  await assertCompanyAccess(ctx.supabase, ctx.userId, companyId);
  const { data, error } = await supabaseAdmin
    .from("bella_pay_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as BellaPayConfigRow | null) ?? null;
}

/**
 * Exige que o usuário seja dono da empresa ou tenha papel `admin`/`owner`.
 * Usado para salvar chaves e para o painel de testes do Asaas.
 */
export async function assertBellaPayAdmin(
  ctx: BellaPayAuthedContext,
  companyId: string,
): Promise<void> {
  const { supabase, userId } = ctx;
  const { data: owned } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) return;

  const { data: adminRow } = await supabase
    .from("user_roles")
    .select("role_id, roles!inner(name)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .in("roles.name", ["admin", "owner"])
    .maybeSingle();
  if (!adminRow) {
    throw new Error("Apenas administradores podem gerenciar as chaves do Asaas.");
  }
}

/** "•••• 1234" ou `null` quando não há chave. */
export function maskKey(key: string | null | undefined): string | null {
  const k = (key ?? "").trim();
  if (!k) return null;
  return `•••• ${k.slice(-4)}`;
}

export interface BellaPayKeyStatus {
  hasSandbox: boolean;
  hasProduction: boolean;
  sandboxMasked: string | null;
  productionMasked: string | null;
}

export function toKeyStatus(
  cfg: Pick<BellaPayConfigRow, "api_key_sandbox" | "api_key_production"> | null,
): BellaPayKeyStatus {
  return {
    hasSandbox: Boolean(cfg?.api_key_sandbox?.trim()),
    hasProduction: Boolean(cfg?.api_key_production?.trim()),
    sandboxMasked: maskKey(cfg?.api_key_sandbox),
    productionMasked: maskKey(cfg?.api_key_production),
  };
}

/**
 * Grava as chaves (undefined = não mexe; null/"" = remove). Chame só depois de
 * `assertBellaPayAdmin`.
 */
export async function writeBellaPayKeys(
  companyId: string,
  keys: { apiKeySandbox?: string | null; apiKeyProduction?: string | null },
): Promise<void> {
  const patch: {
    company_id: string;
    updated_at: string;
    api_key_sandbox?: string | null;
    api_key_production?: string | null;
  } = { company_id: companyId, updated_at: new Date().toISOString() };
  if (keys.apiKeySandbox !== undefined) patch.api_key_sandbox = keys.apiKeySandbox || null;
  if (keys.apiKeyProduction !== undefined) patch.api_key_production = keys.apiKeyProduction || null;

  const { error } = await supabaseAdmin
    .from("bella_pay_config")
    .upsert(patch, { onConflict: "company_id" });
  if (error) throw error;
}
