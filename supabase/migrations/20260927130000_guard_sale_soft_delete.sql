-- =====================================================================
-- Proteção da exclusão (soft delete) de vendas
--
-- O botão "Excluir" da lista de vendas apenas preenche `sales.deleted_at`
-- (lixeira com "Desfazer"). Isso escondia vendas pagas sem estornar
-- financeiro, caixa e estoque — o valor continuava em "Recebido" e em
-- "Caixa disponível" no dashboard.
--
-- Esta trigger aplica ao soft delete as mesmas regras da RPC `delete_sale`:
-- só podem ir para a lixeira vendas sem pagamento, sem baixa financeira,
-- sem movimento de caixa e sem crediário. Para as demais, o caminho é o
-- cancelamento, cujas triggers estornam financeiro, estoque e crediário.
--
-- Vendas já canceladas podem ir para a lixeira: os estornos já ocorreram.
-- Restaurar (deleted_at -> NULL) continua sempre permitido.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.guard_sale_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_payment boolean;
  v_has_cash boolean;
  v_has_credit boolean;
BEGIN
  -- Só interessa a transição "visível" -> "na lixeira".
  IF NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('paid', 'partially_paid') THEN
    RAISE EXCEPTION 'Esta venda já foi paga e não pode ser excluída. Use "Cancelar venda" para estornar financeiro, caixa e estoque.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.credit_accounts ca WHERE ca.sale_id = OLD.id
  ) INTO v_has_credit;
  IF v_has_credit THEN
    RAISE EXCEPTION 'Esta venda possui crediário e não pode ser excluída. Use "Cancelar venda".'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.financial_transactions ft
     WHERE (ft.id = OLD.finance_ref OR (ft.source = 'sale' AND ft.reference_id = OLD.id))
       AND (ft.status IN ('paid', 'refunded') OR ft.paid_at IS NOT NULL)
  ) INTO v_has_payment;
  IF v_has_payment THEN
    RAISE EXCEPTION 'Esta venda já tem baixa no financeiro e não pode ser excluída. Use "Cancelar venda".'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.cash_movements cm
     WHERE cm.transaction_id IN (
       SELECT ft.id FROM public.financial_transactions ft
        WHERE ft.id = OLD.finance_ref OR (ft.source = 'sale' AND ft.reference_id = OLD.id)
     )
  ) INTO v_has_cash;
  IF v_has_cash THEN
    RAISE EXCEPTION 'Esta venda já movimentou o caixa e não pode ser excluída. Use "Cancelar venda".'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_sale_soft_delete ON public.sales;
CREATE TRIGGER trg_guard_sale_soft_delete
  BEFORE UPDATE OF deleted_at ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sale_soft_delete();
