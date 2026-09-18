-- Gera as contas a pagar da compra conforme a condição de pagamento.
-- Compras parceladas mantêm o mesmo reference_id em todas as parcelas para
-- preservar a idempotência e permitir que a reversão alcance o conjunto todo.
CREATE OR REPLACE FUNCTION public.apply_purchase_to_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_purchase_date date := COALESCE(NEW.purchase_date, CURRENT_DATE);
  v_total numeric := COALESCE(NEW.grand_total, 0);
  v_installment_count integer := 1;
  v_installment_number integer;
  v_installment_amount numeric;
  v_regular_amount numeric;
  v_due_days integer := 0;
  v_description text := 'Compra Nº ' || COALESCE(NEW.number, NEW.id::text);
BEGIN
  IF NEW.status = 'received'
     AND OLD.status IS DISTINCT FROM 'received' THEN

    -- Uma única parcela existente bloqueia a recriação do conjunto inteiro.
    IF EXISTS (
      SELECT 1
      FROM public.financial_transactions
      WHERE source = 'purchase'
        AND reference_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    CASE COALESCE(NULLIF(btrim(NEW.payment_terms), ''), 'a_vista')
      WHEN '7d' THEN v_due_days := 7;
      WHEN '14d' THEN v_due_days := 14;
      WHEN '28d' THEN v_due_days := 28;
      WHEN '30d' THEN v_due_days := 30;
      WHEN '30_60' THEN v_installment_count := 2;
      WHEN '30_60_90' THEN v_installment_count := 3;
      ELSE v_due_days := 0;
    END CASE;

    v_regular_amount := round(v_total / v_installment_count, 2);

    FOR v_installment_number IN 1..v_installment_count LOOP
      -- A última parcela absorve os centavos do arredondamento.
      IF v_installment_number = v_installment_count THEN
        v_installment_amount := v_total - (v_regular_amount * (v_installment_count - 1));
      ELSE
        v_installment_amount := v_regular_amount;
      END IF;

      IF v_installment_count > 1 THEN
        v_due_days := v_installment_number * 30;
      END IF;

      INSERT INTO public.financial_transactions (
        company_id,
        type,
        description,
        amount,
        transaction_date,
        due_date,
        status,
        source,
        reference_id,
        reference_number,
        created_by
      ) VALUES (
        NEW.company_id,
        'expense',
        v_description || CASE
          WHEN v_installment_count > 1
            THEN format(' (parcela %s/%s)', v_installment_number, v_installment_count)
          ELSE ''
        END,
        v_installment_amount,
        v_purchase_date,
        v_purchase_date + v_due_days,
        'pending',
        'purchase',
        NEW.id,
        NEW.number,
        NEW.created_by
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Mantém a função de gatilho inacessível para chamadas diretas da API.
REVOKE EXECUTE ON FUNCTION public.apply_purchase_to_finance()
  FROM PUBLIC, anon, authenticated;