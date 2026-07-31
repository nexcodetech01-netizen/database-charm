
ALTER TABLE public.product_suppliers
  ADD COLUMN IF NOT EXISTS municipal_registration text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text;

COMMENT ON COLUMN public.product_suppliers.address IS 'Rua / logradouro';
COMMENT ON COLUMN public.product_suppliers.number IS 'Número do endereço';
COMMENT ON COLUMN public.product_suppliers.complement IS 'Complemento (sala, andar, etc.)';
COMMENT ON COLUMN public.product_suppliers.neighborhood IS 'Bairro';
COMMENT ON COLUMN public.product_suppliers.municipal_registration IS 'Inscrição municipal';
