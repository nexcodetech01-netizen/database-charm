/**
 * Guard de disponibilidade do cliente administrativo nos jobs (server-only).
 *
 * Todos os jobs de `/api/public/jobs/*` dependem do service role
 * (`MY_SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`). Sem a chave, o
 * job antes estourava HTTP 500 genérico — impossível de diagnosticar.
 * Agora devolve 503 `service_key_missing`, que é um estado de configuração,
 * não um erro de execução.
 */

export interface JobAdminGuardResult {
  /** Resposta pronta quando o job NÃO pode rodar; `null` quando pode. */
  response: Response | null;
}

export function serviceKeyConfigured(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return Boolean(env.MY_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Retorna `null` quando o job pode prosseguir, ou a `Response` 503 a devolver.
 */
export function requireServiceKey(
  jobName: string,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Response | null {
  if (serviceKeyConfigured(env)) return null;
  console.error(
    `[jobs] ${jobName}: MY_SUPABASE_SERVICE_KEY ausente — job não executado (503, sem retentativa útil)`,
  );
  return new Response(
    JSON.stringify({
      ok: false,
      error: "service_key_missing",
      detail:
        "Configure o segredo MY_SUPABASE_SERVICE_KEY (service role do Supabase) para habilitar os jobs.",
    }),
    { status: 503, headers: { "content-type": "application/json" } },
  );
}
