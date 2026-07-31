
-- =========================
-- SPRINT 13: CRM Avançado (Pipeline/Oportunidades) + Marketing (Campanhas/Segmentação/Timeline)
-- =========================

-- Adicionar campos de CRM aos clientes
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID;

-- ============ PIPELINE STAGES ============
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#64748B',
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_stages by owner" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_company ON public.pipeline_stages(company_id, position);

CREATE TRIGGER trg_pipeline_stages_updated
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ OPPORTUNITIES ============
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  lead_source TEXT,
  estimated_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  expected_close_date DATE,
  assignee TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost')),
  won_reason TEXT,
  lost_reason TEXT,
  closed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunities by owner" ON public.opportunities
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX IF NOT EXISTS idx_opportunities_company ON public.opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage_id, position);
CREATE INDEX IF NOT EXISTS idx_opportunities_customer ON public.opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(company_id, status);

CREATE TRIGGER trg_opportunities_updated
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MARKETING CAMPAIGNS ============
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email','instagram','facebook','google','other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','completed','paused','cancelled')),
  objective TEXT,
  message TEXT,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(14,2) NOT NULL DEFAULT 0,
  leads_count INTEGER NOT NULL DEFAULT 0,
  conversions_count INTEGER NOT NULL DEFAULT 0,
  segment_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing_campaigns by owner" ON public.marketing_campaigns
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_company ON public.marketing_campaigns(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(company_id, status);

CREATE TRIGGER trg_marketing_campaigns_updated
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRM TIMELINE (eventos: funil, campanhas, observações) ============
CREATE TABLE IF NOT EXISTS public.crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_events TO authenticated;
GRANT ALL ON public.crm_events TO service_role;

ALTER TABLE public.crm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_events by owner" ON public.crm_events
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX IF NOT EXISTS idx_crm_events_company ON public.crm_events(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_events_customer ON public.crm_events(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_events_opportunity ON public.crm_events(opportunity_id, occurred_at DESC);

-- ============ TRIGGER: log opportunity lifecycle ============
CREATE OR REPLACE FUNCTION public.log_opportunity_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_events(company_id, customer_id, opportunity_id, event_type, description, user_id)
    VALUES (NEW.company_id, NEW.customer_id, NEW.id, 'opportunity_created',
            'Oportunidade criada: ' || NEW.title, NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      INSERT INTO public.crm_events(company_id, customer_id, opportunity_id, event_type, description, metadata)
      VALUES (NEW.company_id, NEW.customer_id, NEW.id, 'stage_changed',
              'Etapa alterada',
              jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.crm_events(company_id, customer_id, opportunity_id, event_type, description, metadata)
      VALUES (NEW.company_id, NEW.customer_id, NEW.id,
              CASE NEW.status WHEN 'won' THEN 'opportunity_won'
                              WHEN 'lost' THEN 'opportunity_lost'
                              ELSE 'opportunity_reopened' END,
              CASE NEW.status WHEN 'won' THEN 'Oportunidade ganha'
                              WHEN 'lost' THEN 'Oportunidade perdida'
                              ELSE 'Oportunidade reaberta' END,
              jsonb_build_object('reason', COALESCE(NEW.won_reason, NEW.lost_reason)));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_opportunity_event ON public.opportunities;
CREATE TRIGGER trg_log_opportunity_event
  AFTER INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.log_opportunity_event();
