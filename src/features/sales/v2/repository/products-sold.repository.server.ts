import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Consulta de produtos vendidos (RPC products_sold_summary) pelo cliente
 * administrativo.
 *
 * Por quê: no runtime da Bella, o `ctx.supabase` chega sem a sessão do
 * usuário (papel "anon") — o mesmo problema contornado em
 * sales.repository.ts —, e a função recusa "anon" ("permission denied").
 * O acesso à empresa já é validado antes (assertCompanyAccess em
 * runtime.functions.ts), e a função só aceita service_role ou um usuário
 * com acesso à empresa.
 */
export async function fetchProductsSoldSummary(params: {
  companyId: string;
  term: string;
  start: string;
  end: string;
}): Promise<unknown[]> {
  const { data, error } = await (supabaseAdmin.rpc as any)("products_sold_summary", {
    _company_id: params.companyId,
    _term: params.term,
    _start: params.start,
    _end: params.end,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown[];
}
