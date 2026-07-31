ALTER TABLE public.fiscal_documents DROP CONSTRAINT IF EXISTS fiscal_documents_environment_check;
ALTER TABLE public.fiscal_documents ALTER COLUMN environment DROP DEFAULT;
UPDATE public.fiscal_documents SET environment = 'homologation' WHERE environment IN ('homolog', 'homologacao', 'sandbox', 'test');
ALTER TABLE public.fiscal_documents ALTER COLUMN environment SET DEFAULT 'homologation';
ALTER TABLE public.fiscal_documents ADD CONSTRAINT fiscal_documents_environment_check CHECK (environment = ANY (ARRAY['homologation'::text, 'production'::text]));