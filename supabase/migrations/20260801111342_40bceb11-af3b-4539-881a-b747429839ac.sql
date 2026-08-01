ALTER TABLE public.whatsapp_commercial_inbox
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wci_sale_id ON public.whatsapp_commercial_inbox(sale_id);