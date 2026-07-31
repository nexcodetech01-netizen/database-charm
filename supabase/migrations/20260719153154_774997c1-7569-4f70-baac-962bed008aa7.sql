CREATE OR REPLACE FUNCTION public.enforce_movement_open_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.cash_sessions WHERE id = NEW.session_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Sessão de caixa não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Não é possível registrar movimentações em um caixa fechado.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_movement_open_session_ins ON public.cash_movements;
CREATE TRIGGER trg_enforce_movement_open_session_ins
  BEFORE INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_movement_open_session();

DROP TRIGGER IF EXISTS trg_enforce_movement_open_session_upd ON public.cash_movements;
CREATE TRIGGER trg_enforce_movement_open_session_upd
  BEFORE UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_movement_open_session();