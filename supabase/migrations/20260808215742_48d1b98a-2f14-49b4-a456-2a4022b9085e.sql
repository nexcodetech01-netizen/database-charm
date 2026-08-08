CREATE TABLE IF NOT EXISTS public.sales_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    sale_id uuid NOT NULL,
    action text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    sale_data jsonb,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.sales_audit_logs TO authenticated;
GRANT ALL ON public.sales_audit_logs TO service_role;

ALTER TABLE public.sales_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company audit logs" 
ON public.sales_audit_logs FOR SELECT TO authenticated 
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.sales ADD COLUMN deleted_at timestamptz;
    END IF;
END $$;
