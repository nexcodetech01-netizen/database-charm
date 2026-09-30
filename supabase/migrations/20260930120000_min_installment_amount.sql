-- =====================================================================
-- Valor mínimo para parcelar no cartão (company_card_price_config).
--
-- Antes o sistema oferecia "até Nx" para qualquer valor. Agora cada
-- empresa define a partir de quanto a venda pode ser parcelada; abaixo
-- disso o crédito é 1x (ainda com o preço de cartão).
-- Padrão 0 = sem mínimo (comportamento anterior para quem não configurar).
-- =====================================================================

ALTER TABLE public.company_card_price_config
  ADD COLUMN IF NOT EXISTS min_installment_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.company_card_price_config
  DROP CONSTRAINT IF EXISTS company_card_price_config_min_installment_range;
ALTER TABLE public.company_card_price_config
  ADD CONSTRAINT company_card_price_config_min_installment_range
  CHECK (min_installment_amount >= 0);

-- T&G: parcela a partir de R$ 100,00.
INSERT INTO public.company_card_price_config (company_id, min_installment_amount)
VALUES ('78bfccca-f3a5-4110-9983-13e073f3ba77', 100)
ON CONFLICT (company_id) DO UPDATE SET min_installment_amount = EXCLUDED.min_installment_amount;

-- A RPC do PDV passa a respeitar o mínimo (servidor é a fonte da verdade).
CREATE OR REPLACE FUNCTION public.apply_pdv_payment_pricing(
  _sale_id uuid,
  _payment_method text,
  _installments integer,
  _cash_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_fee numeric := 2.88;
  v_max_installments integer := 3;
  v_active boolean := true;
    v_installments integer := 1;
  v_min_installment_amount numeric := 0;
  v_items_total numeric := 0;
  v_grand_total numeric := 0;
  v_expected integer := 0;
  v_updated integer := 0;
BEGIN
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = _sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;
  IF NOT public.user_has_company_access(v_sale.company_id) THEN
    RAISE EXCEPTION 'Sem acesso à empresa desta venda.';
  END IF;
  IF v_sale.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'A forma de pagamento não pode ser alterada após a confirmação da venda.';
  END IF;
  IF jsonb_typeof(_cash_items) <> 'array' OR jsonb_array_length(_cash_items) = 0 THEN
    RAISE EXCEPTION 'Informe os itens da venda.';
  END IF;

    SELECT card_fee_percent, max_installments, active, min_installment_amount
  INTO v_fee, v_max_installments, v_active, v_min_installment_amount
  FROM public.company_card_price_config
  WHERE company_id = v_sale.company_id;

  v_fee := COALESCE(v_fee, 2.88);
  v_max_installments := COALESCE(v_max_installments, 3);
    v_active := COALESCE(v_active, true);
  v_min_installment_amount := COALESCE(v_min_installment_amount, 0);
  v_installments := CASE
    WHEN _payment_method = 'credit_card' THEN LEAST(GREATEST(COALESCE(_installments, 1), 1), v_max_installments)
    ELSE 1
  END;

  SELECT count(*) INTO v_expected
  FROM public.sale_items
  WHERE sale_id = _sale_id;

  WITH cash_prices AS (
    SELECT
      COALESCE((item->>'position')::integer, ordinality::integer - 1) AS position,
      GREATEST(0, (item->>'unit_price')::numeric) AS cash_unit_price
    FROM jsonb_array_elements(_cash_items) WITH ORDINALITY AS input(item, ordinality)
    WHERE item ? 'unit_price'
  ), changed AS (
    UPDATE public.sale_items si
    SET unit_price = CASE
          WHEN _payment_method = 'credit_card' AND v_active AND v_fee > 0
            THEN ceil((cp.cash_unit_price / (1 - v_fee / 100)) * 100) / 100
          ELSE cp.cash_unit_price
        END,
        total = GREATEST(
          0,
          si.quantity * CASE
            WHEN _payment_method = 'credit_card' AND v_active AND v_fee > 0
              THEN ceil((cp.cash_unit_price / (1 - v_fee / 100)) * 100) / 100
            ELSE cp.cash_unit_price
          END - COALESCE(si.discount, 0)
        )
    FROM cash_prices cp
    WHERE si.sale_id = _sale_id
      AND si.position = cp.position
    RETURNING si.id
  )
  SELECT count(*) INTO v_updated FROM changed;

  IF v_updated <> v_expected OR v_expected <> jsonb_array_length(_cash_items) THEN
    RAISE EXCEPTION 'Não foi possível atualizar todos os itens da venda.';
  END IF;

  SELECT COALESCE(sum(total), 0) INTO v_items_total
  FROM public.sale_items
  WHERE sale_id = _sale_id;
  v_grand_total := GREATEST(0, v_items_total - COALESCE(v_sale.discount, 0) + COALESCE(v_sale.shipping, 0));

    -- Abaixo do valor mínimo para parcelar, crédito é sempre 1x (com o
  -- preço de cartão). O mínimo vale sobre o total cobrado no cartão.
  IF _payment_method = 'credit_card' AND v_grand_total < v_min_installment_amount THEN
    v_installments := 1;
  END IF;

  UPDATE public.sales
  SET payment_method = CASE WHEN _payment_method = 'pending_payment' THEN NULL ELSE _payment_method END,
      installments = v_installments,
      items_total = v_items_total,
      grand_total = v_grand_total,
      updated_at = now()
  WHERE id = _sale_id;

  RETURN jsonb_build_object(
    'sale_id', _sale_id,
    'items_total', v_items_total,
    'grand_total', v_grand_total,
    'payment_method', _payment_method,
    'installments', v_installments
  );
END;
$function$;
