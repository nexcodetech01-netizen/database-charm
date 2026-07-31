ALTER PUBLICATION supabase_realtime ADD TABLE public.bella_pay_charges;
ALTER TABLE public.bella_pay_charges REPLICA IDENTITY FULL;