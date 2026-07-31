ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS default_csosn text,
  ADD COLUMN IF NOT EXISTS default_origem smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cnae_principal text,
  ADD COLUMN IF NOT EXISTS crt smallint,
  ADD COLUMN IF NOT EXISTS email_fiscal text,
  ADD COLUMN IF NOT EXISTS phone_fiscal text,
  ADD COLUMN IF NOT EXISTS ie_st text;

ALTER TABLE public.fiscal_certificates
  ADD COLUMN IF NOT EXISTS serial_number text;

COMMENT ON COLUMN public.fiscal_settings.default_csosn IS 'CSOSN padrão para Simples Nacional (ex.: 102, 500).';
COMMENT ON COLUMN public.fiscal_settings.default_origem IS 'Origem da mercadoria (SEFAZ): 0=Nacional, 1=Estrangeira - Import. direta, etc.';
COMMENT ON COLUMN public.fiscal_settings.crt IS 'Código de Regime Tributário: 1=Simples, 2=Simples-excesso, 3=Regime Normal, 4=MEI.';
COMMENT ON COLUMN public.fiscal_certificates.serial_number IS 'Número de série do certificado A1 (extraído do .pfx).';