-- Backfill: promover venda VD-20260718-1343 (cartão 3x) que ficou pendente
-- por causa do bug de value_mismatch em parcelas.
UPDATE public.sales
   SET status = 'paid',
       paid_at = COALESCE(paid_at, now()),
       payment_confirmed_at = COALESCE(payment_confirmed_at, now())
 WHERE id = 'fe2d7e7d-e8b7-4ae2-8e67-bb8244c6f499'
   AND status <> 'paid';