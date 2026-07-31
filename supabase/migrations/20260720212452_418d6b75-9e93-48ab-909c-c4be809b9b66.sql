CREATE OR REPLACE FUNCTION public.prevent_paid_sale_delete_before_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Vendas finalizadas não podem ser excluídas. Utilize a opção ''Cancelar venda'' para reverter estoque e manter o histórico.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Vendas canceladas não podem ser excluídas para preservar o histórico.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;