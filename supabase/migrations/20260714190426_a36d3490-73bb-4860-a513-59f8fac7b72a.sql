-- GO LIVE 2.0 — Hardening: revoke EXECUTE from trigger-only SECURITY DEFINER
-- functions. These are invoked by triggers only; they were never meant to be
-- callable from PostgREST. Functions used by RLS (has_permission,
-- user_owns_company) keep EXECUTE for `authenticated`.

REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sale_to_inventory()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_purchase_to_inventory()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sale_to_finance()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_purchase_to_finance()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_customer_last_interaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_appointment_event()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_opportunity_event()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                FROM PUBLIC, anon, authenticated;

-- Guarantee the RLS-support functions stay callable by signed-in users only.
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_company(uuid)          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.user_owns_company(uuid)          TO authenticated;