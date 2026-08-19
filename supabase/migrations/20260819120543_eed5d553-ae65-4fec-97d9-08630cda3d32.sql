-- Habilitar pg_cron se disponível (Supabase Cloud já tem, mas garantimos)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar execução do job a cada 1 hora para estoque e financeiro
-- Nota: Usamos o segredo CRON_JOB_SECRET que deve estar configurado no Supabase
SELECT cron.schedule(
  'bella-ai-detectors-hourly',
  '0 * * * *', -- A cada hora
  $$
  SELECT net.http_post(
    url := 'https://' || (SELECT value FROM auth.secrets WHERE name = 'PROJECT_DOMAIN') || '/api/public/jobs/bella-detectors',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM auth.secrets WHERE name = 'CRON_JOB_SECRET')
    ),
    body := '{}'
  );
  $$
);
