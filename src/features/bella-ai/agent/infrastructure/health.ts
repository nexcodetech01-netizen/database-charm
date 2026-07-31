/**
 * Health Providers.
 *
 * - `getPublicHealth()`  → resposta mínima, sem RBAC. Só status/ts.
 * - `getInternalHealth()` → detalhada. Consumidor DEVE gate-ar por
 *   permissão (`settings.view` ou owner) antes de expor.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PublicHealth {
  status: "ok";
  ts: string;
}

export interface InternalHealth {
  status: "ok" | "degraded";
  ts: string;
  checks: {
    supabase: { ok: boolean; latencyMs: number | null; error?: string };
  };
}

export function getPublicHealth(): PublicHealth {
  return { status: "ok", ts: new Date().toISOString() };
}

export async function getInternalHealth(): Promise<InternalHealth> {
  const startedAt = Date.now();
  let ok = true;
  let error: string | undefined;
  try {
    // Ping leve — respeitando RLS. Uma tabela pública mínima.
    const { error: err } = await supabase.from("permissions").select("code").limit(1);
    if (err) {
      ok = false;
      error = err.message;
    }
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
  }

  const latencyMs = Date.now() - startedAt;
  return {
    status: ok ? "ok" : "degraded",
    ts: new Date().toISOString(),
    checks: {
      supabase: { ok, latencyMs, error },
    },
  };
}
