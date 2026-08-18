CREATE INDEX IF NOT EXISTS idx_consignment_items_consignment_id ON public.consignment_items(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_settlements_consignment_id ON public.consignment_settlements(consignment_id);

GRANT SELECT ON public.consignment_items TO authenticated;
GRANT SELECT ON public.consignment_settlements TO authenticated;
GRANT ALL ON public.consignment_items TO service_role;
GRANT ALL ON public.consignment_settlements TO service_role;