-- Sprint 15 (RC1) — Hardening: revoke public EXECUTE on trigger-only SECURITY DEFINER functions.
-- Trigger functions run via the trigger context and don't need direct EXECUTE grants.
-- user_owns_company is intentionally kept executable (referenced by RLS policies).

REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_customer_last_interaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_purchase_to_inventory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sale_to_inventory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_appointment_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_opportunity_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Document intent for internal webhook/event log tables (RLS on, no policy = default deny for anon/authenticated,
-- service_role bypasses RLS and is the only accessor from the webhook edge function).
COMMENT ON TABLE public.payment_events IS 'Internal webhook/event log. RLS on, no policy: accessible only via service_role from Bella Pay edge function.';
COMMENT ON TABLE public.bella_pay_webhook_events IS 'Internal Asaas webhook idempotency log. RLS on, no policy: accessible only via service_role.';