-- =====================================================================
-- Auditoria técnica 04/10/2026 — P0
--
-- 04) Categorias: a política "Public can view product categories" liberava
--     as categorias de TODAS as empresas para visitantes (USING true). O
--     catálogo público lê pelo servidor (service role) e não usa isso.
-- 06) Saldo inicial da conta: ajuste atômico (antes: ler + gravar em duas
--     requisições, perdendo baixas simultâneas).
-- =====================================================================

-- 04
DROP POLICY IF EXISTS "Public can view product categories" ON public.product_categories;
REVOKE SELECT ON public.product_categories FROM anon;

-- 06
CREATE OR REPLACE FUNCTION public.set_account_initial_balance(
  _account_id uuid,
  _initial_balance numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM financial_accounts WHERE id = _account_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada.';
  END IF;
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(v_company) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;

  -- Uma instrução só: o saldo atual recebe a diferença, sem janela para
  -- uma baixa simultânea se perder.
  UPDATE financial_accounts
     SET current_balance = coalesce(current_balance, 0)
                           + (round(coalesce(_initial_balance, 0), 2) - coalesce(initial_balance, 0)),
         initial_balance = round(coalesce(_initial_balance, 0), 2),
         updated_at = now()
   WHERE id = _account_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_account_initial_balance(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_account_initial_balance(uuid, numeric) TO authenticated;
