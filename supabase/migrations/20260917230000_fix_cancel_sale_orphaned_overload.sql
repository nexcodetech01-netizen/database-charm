-- Achado numa varredura preventiva (mesmo padrão do bug que já causou o
-- "is not unique" no Crediário hoje): a migration 20260722010419 criou
-- DE PROPÓSITO um segundo overload de public.cancel_sale — um "shim" de
-- 1 argumento (cancel_sale(uuid)) que delega pro de 2 argumentos
-- (cancel_sale(uuid, text DEFAULT NULL)), "pra compatibilidade com
-- callers que ainda não passam o motivo" (comentário original). Só que
-- esse shim de 1 argumento NUNCA foi removido depois — e como o 2º
-- parâmetro do de 2 argumentos tem valor padrão, uma chamada com
-- exatamente 1 argumento posicional bate nos dois candidatos ao mesmo
-- tempo. É o MESMO formato de bug do settle_financial_transaction
-- corrigido hoje mais cedo.
--
-- Não está quebrado agora por sorte: os dois lugares que chamam essa
-- RPC hoje (sales.service.ts e sales.repository.ts) sempre passam
-- `_sale_id` E `_reason` nomeados (mesmo que `_reason` seja null), então
-- sempre batem só no de 2 argumentos. Mas qualquer chamada futura só
-- com o id (uma function nova, uma skill da Bella, um script) reproduz
-- o mesmo erro "is not unique" — e ninguém saberia por quê, do mesmo
-- jeito que hoje.
--
-- Correção preventiva: descobre dinamicamente todas as versões
-- realmente presentes no banco (sem confiar no histórico de migrations
-- — a mesma lição de hoje) e apaga todas, deixando só a versão de 2
-- argumentos (que já é a única realmente usada). O shim de 1 argumento
-- não tem nenhum caller real hoje, então não faz falta.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cancel_sale'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL::text)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_sale public.sales%ROWTYPE;
  updated_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO current_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;

  IF current_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_company_access(current_sale.company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para cancelar esta venda.' USING ERRCODE = '42501';
  END IF;

  IF current_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Esta venda já está cancelada.' USING ERRCODE = 'check_violation';
  END IF;

  IF current_sale.status NOT IN ('draft', 'pending', 'partially_paid', 'paid') THEN
    RAISE EXCEPTION 'Apenas vendas em rascunho, pendentes, parcialmente pagas ou pagas podem ser canceladas.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.sales
     SET status = 'cancelled',
         notes = CASE
           WHEN NULLIF(BTRIM(COALESCE(_reason, '')), '') IS NULL THEN notes
           WHEN NULLIF(BTRIM(COALESCE(notes, '')), '') IS NULL THEN 'Cancelamento: ' || BTRIM(_reason)
           ELSE notes || E'\nCancelamento: ' || BTRIM(_reason)
         END,
         updated_at = now()
   WHERE id = _sale_id
   RETURNING * INTO updated_sale;

  INSERT INTO public.sale_events(sale_id, company_id, user_id, event_type, reason, payload)
  VALUES (
    updated_sale.id,
    updated_sale.company_id,
    auth.uid(),
    'cancelled',
    NULLIF(BTRIM(COALESCE(_reason, '')), ''),
    jsonb_build_object('previous_status', current_sale.status, 'new_status', 'cancelled')
  );

  RETURN updated_sale;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO service_role;
