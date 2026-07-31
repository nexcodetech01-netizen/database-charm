CREATE OR REPLACE FUNCTION public.prevent_paid_sale_delete_before_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' AND NOT COALESCE(OLD.stock_reversed, false) THEN
    RAISE EXCEPTION 'Venda paga não pode ser excluída. Cancele a venda para reverter o estoque antes da exclusão.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paid_sale_delete_before_reversal ON public.sales;
CREATE TRIGGER trg_prevent_paid_sale_delete_before_reversal
BEFORE DELETE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_sale_delete_before_reversal();