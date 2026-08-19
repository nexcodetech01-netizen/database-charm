-- Migration 1: Campos de follow-up
alter table public.bella_pay_charges
  add column if not exists buyer_name text,
  add column if not exists buyer_phone text,
  add column if not exists followup_sent_at timestamptz;

comment on column public.bella_pay_charges.buyer_name is
  'Nome do comprador, capturado no checkout de entrada do catálogo público.';
comment on column public.bella_pay_charges.buyer_phone is
  'WhatsApp do comprador, capturado no checkout de entrada do catálogo público.';
comment on column public.bella_pay_charges.followup_sent_at is
  'Quando o lembrete automático foi enviado.';

create index if not exists idx_bella_pay_charges_followup
  on public.bella_pay_charges (company_id, status, followup_sent_at)
  where buyer_phone is not null;

-- Migration 2: Agendamento cron
SELECT cron.schedule(
  'entrada-followup-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://' || (SELECT value FROM auth.secrets WHERE name = 'PROJECT_DOMAIN') || '/api/public/jobs/entrada-followup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM auth.secrets WHERE name = 'CRON_JOB_SECRET')
    ),
    body := '{}'
  );
  $$
);