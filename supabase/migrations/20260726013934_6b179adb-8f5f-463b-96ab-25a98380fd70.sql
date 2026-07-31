CREATE OR REPLACE FUNCTION public.delete_sale(_sale_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_blocked int;
  v_cash int;
  v_credit boolean;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_company_access(v_sale.company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para excluir esta venda.' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status IN ('paid', 'partially_paid', 'cancelled') THEN
    RAISE EXCEPTION 'Vendas finalizadas ou canceladas não podem ser excluídas. Utilize o cancelamento de venda.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = _sale_id) INTO v_credit;
  IF v_credit THEN
    RAISE EXCEPTION 'Esta venda possui crediário e não pode ser excluída. Utilize o cancelamento de venda.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Liquidação já ocorrida em qualquer título da venda
  SELECT count(*) INTO v_blocked
    FROM public.financial_transactions ft
   WHERE (ft.id = v_sale.finance_ref OR (ft.source = 'sale' AND ft.reference_id = _sale_id))
     AND (ft.status IN ('paid', 'refunded') OR ft.paid_at IS NOT NULL);

  IF v_blocked > 0 THEN
    RAISE EXCEPTION 'Esta venda já possui movimentação financeira (baixa realizada) e não pode ser excluída. Utilize o cancelamento de venda.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Movimentação de caixa vinculada aos títulos da venda
  SELECT count(*) INTO v_cash
    FROM public.cash_movements cm
   WHERE cm.transaction_id IN (
     SELECT ft.id FROM public.financial_transactions ft
      WHERE ft.id = v_sale.finance_ref OR (ft.source = 'sale' AND ft.reference_id = _sale_id)
   );

  IF v_cash > 0 THEN
    RAISE EXCEPTION 'Esta venda já possui movimentação de caixa e não pode ser excluída. Utilize o cancelamento de venda.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Títulos em aberto: cancelar e desvincular a referência da venda
  UPDATE public.financial_transactions ft
     SET status = 'cancelled',
         reference_id = NULL,
         notes = COALESCE(NULLIF(BTRIM(ft.notes), '') || E'\n', '')
                 || 'Cancelado automaticamente: venda ' || COALESCE(v_sale.number, _sale_id::text) || ' excluída.',
         updated_at = now()
   WHERE (ft.id = v_sale.finance_ref OR (ft.source = 'sale' AND ft.reference_id = _sale_id))
     AND ft.status NOT IN ('paid', 'refunded');

  UPDATE public.sales SET finance_ref = NULL WHERE id = _sale_id;

  DELETE FROM public.sales WHERE id = _sale_id;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_sale(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_sale(uuid) TO service_role;

-- Saneamento: títulos apontando para vendas inexistentes
UPDATE public.financial_transactions ft
   SET status = 'cancelled',
       reference_id = NULL,
       notes = COALESCE(NULLIF(BTRIM(ft.notes), '') || E'\n', '')
               || 'Cancelado automaticamente: venda de origem inexistente.',
       updated_at = now()
 WHERE ft.source = 'sale'
   AND ft.reference_id IS NOT NULL
   AND ft.status NOT IN ('paid', 'refunded')
   AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.id = ft.reference_id);