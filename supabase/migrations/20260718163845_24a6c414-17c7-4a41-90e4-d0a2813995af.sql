-- Backfill pontual: aplica a promoção server-side que o PAYMENT_CONFIRMED
-- corrigido faria, para a única charge de cartão travada em 'CONFIRMED'
-- sem paid_at / sem sale.paid. Idempotente por causa dos filtros.

DO $$
DECLARE
  v_charge RECORD;
BEGIN
  FOR v_charge IN
    SELECT id, sale_id
      FROM public.bella_pay_charges
     WHERE asaas_id = 'pay_d9vriud8n3ndxtz8'
       AND status = 'CONFIRMED'
       AND paid_at IS NULL
  LOOP
    UPDATE public.bella_pay_charges
       SET paid_at = now()
     WHERE id = v_charge.id;

    IF v_charge.sale_id IS NOT NULL THEN
      -- Triggers apply_sale_to_finance / apply_sale_to_inventory cuidam
      -- de finanças e estoque uma única vez.
      UPDATE public.sales
         SET status = 'paid',
             paid_at = now(),
             payment_confirmed_at = now()
       WHERE id = v_charge.sale_id
         AND status <> 'paid';
    END IF;
  END LOOP;
END $$;