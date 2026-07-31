
-- Sprint 11: Agenda module

CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'atendimento',
  status TEXT NOT NULL DEFAULT 'agendado',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  assignee TEXT,
  location TEXT,
  notes TEXT,
  color TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_company_starts ON public.appointments(company_id, starts_at);
CREATE INDEX idx_appointments_customer ON public.appointments(customer_id);
CREATE INDEX idx_appointments_status ON public.appointments(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage appointments of their companies"
  ON public.appointments FOR ALL
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Timeline events
CREATE TABLE public.appointment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- created | updated | status_changed | cancelled | completed
  description TEXT,
  metadata JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_events_appt ON public.appointment_events(appointment_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_events TO authenticated;
GRANT ALL ON public.appointment_events TO service_role;

ALTER TABLE public.appointment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage appointment events of their companies"
  ON public.appointment_events FOR ALL
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

-- Auto-log timeline events
CREATE OR REPLACE FUNCTION public.log_appointment_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_type TEXT;
  desc_text TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_events(appointment_id, company_id, event_type, description, user_id)
    VALUES (NEW.id, NEW.company_id, 'created', 'Agendamento criado', NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'cancelado' THEN
        ev_type := 'cancelled';
        desc_text := 'Agendamento cancelado';
      ELSIF NEW.status = 'concluido' THEN
        ev_type := 'completed';
        desc_text := 'Agendamento concluído';
      ELSE
        ev_type := 'status_changed';
        desc_text := 'Status alterado para ' || NEW.status;
      END IF;
      INSERT INTO public.appointment_events(appointment_id, company_id, event_type, description, metadata)
      VALUES (NEW.id, NEW.company_id, ev_type, desc_text,
              jsonb_build_object('from', OLD.status, 'to', NEW.status));
    ELSIF NEW.starts_at IS DISTINCT FROM OLD.starts_at
       OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.assignee IS DISTINCT FROM OLD.assignee
       OR NEW.location IS DISTINCT FROM OLD.location THEN
      INSERT INTO public.appointment_events(appointment_id, company_id, event_type, description)
      VALUES (NEW.id, NEW.company_id, 'updated', 'Agendamento atualizado');
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_log_event
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_appointment_event();
