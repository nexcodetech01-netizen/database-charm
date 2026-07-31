
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bella_pay_charge_id UUID REFERENCES public.bella_pay_charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_priority ON public.appointments(priority);
CREATE INDEX IF NOT EXISTS idx_appointments_financial_tx ON public.appointments(financial_transaction_id);
CREATE INDEX IF NOT EXISTS idx_appointments_bella_charge ON public.appointments(bella_pay_charge_id);

CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage reminders"
ON public.appointment_reminders
FOR ALL
USING (public.user_owns_company(company_id))
WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appt ON public.appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_scheduled ON public.appointment_reminders(scheduled_for) WHERE status = 'pending';

CREATE TRIGGER trg_appointment_reminders_updated_at
BEFORE UPDATE ON public.appointment_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
