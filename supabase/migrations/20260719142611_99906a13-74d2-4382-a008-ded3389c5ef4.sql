-- Guard: nenhuma venda pode ser criada (ou re-vinculada) sem sessão de caixa ABERTA
CREATE OR REPLACE FUNCTION public.enforce_sale_open_cash_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess public.cash_sessions%ROWTYPE;
BEGIN
  IF NEW.cash_session_id IS NULL THEN
    RAISE EXCEPTION 'É necessário abrir o caixa antes de realizar vendas.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO sess
  FROM public.cash_sessions
  WHERE id = NEW.cash_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão de caixa inexistente.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF sess.status <> 'open' THEN
    RAISE EXCEPTION 'O caixa vinculado está fechado. Abra um caixa antes de realizar vendas.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF sess.company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'A sessão de caixa pertence a outra empresa.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sale_open_cash_ins ON public.sales;
CREATE TRIGGER trg_enforce_sale_open_cash_ins
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sale_open_cash_session();

DROP TRIGGER IF EXISTS trg_enforce_sale_open_cash_upd ON public.sales;
CREATE TRIGGER trg_enforce_sale_open_cash_upd
BEFORE UPDATE OF cash_session_id ON public.sales
FOR EACH ROW
WHEN (NEW.cash_session_id IS DISTINCT FROM OLD.cash_session_id)
EXECUTE FUNCTION public.enforce_sale_open_cash_session();