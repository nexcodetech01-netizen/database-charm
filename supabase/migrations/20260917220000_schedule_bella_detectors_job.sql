-- Liga o job de detecção da Bella IA (estoque crítico/esgotado, contas
-- vencidas, e agora também possíveis produtos duplicados) no agendador.
--
-- O endpoint /api/public/jobs/bella-detectors já existe, já tem
-- autenticação, rate limit e testes (event-engine.test.ts) — mas nunca
-- fez parte da lista de jobs que schedule_nexos_jobs() efetivamente
-- agenda no pg_cron. Só rodava se alguém chamasse manualmente. Os
-- outros 4 jobs (mercadolivre-refresh, dlq-reprocess,
-- mercadolivre-reconcile, health) sempre estiveram na lista — este
-- ficou de fora desde que foi criado.
--
-- Consequência prática: a tela "Automações" e o sino de notificação no
-- topo nunca recebiam os alertas de estoque crítico/esgotado/conta
-- vencida automaticamente, só se alguém chamasse o endpoint na mão.
--
-- Esta migration só ATUALIZA A DEFINIÇÃO da função (adiciona uma linha
-- na lista) — como schedule_nexos_jobs() precisa ser CHAMADA (com a URL
-- base e o CRON_JOB_SECRET) pra realmente registrar os jobs no pg_cron,
-- ainda é necessário rodar
--   SELECT schedule_nexos_jobs('<url base do app em produção>', '<CRON_JOB_SECRET>');
-- uma vez no SQL Editor depois desta migration — é seguro rodar de
-- novo mesmo pros jobs que já existem (ela reagenda todos de forma
-- idempotente).
CREATE OR REPLACE FUNCTION public.schedule_nexos_jobs(_base_url text, _secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  v_headers jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_def record;
BEGIN
  IF _base_url IS NULL OR _base_url = '' THEN
    RAISE EXCEPTION 'base_url obrigatória';
  END IF;
  IF _secret IS NULL OR length(_secret) < 16 THEN
    RAISE EXCEPTION 'secret ausente ou fraco (mínimo 16 caracteres)';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || _secret
  );

  FOR v_def IN
    SELECT * FROM (VALUES
      ('nexos-mercadolivre-refresh', '0 */6 * * *',  '/api/public/jobs/mercadolivre-refresh'),
      ('nexos-dlq-reprocess',        '*/15 * * * *', '/api/public/jobs/dlq-reprocess'),
      ('nexos-mercadolivre-reconcile','*/30 * * * *','/api/public/jobs/mercadolivre-reconcile'),
      ('nexos-health',               '*/10 * * * *', '/api/public/jobs/health'),
      ('nexos-bella-detectors',      '*/30 * * * *', '/api/public/jobs/bella-detectors')
    ) AS t(job_name, schedule, path)
  LOOP
    PERFORM cron.unschedule(v_def.job_name)
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_def.job_name);

    PERFORM cron.schedule(
      v_def.job_name,
      v_def.schedule,
      format(
        $cmd$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb) AS request_id;$cmd$,
        rtrim(_base_url, '/') || v_def.path,
        v_headers::text
      )
    );

    v_jobs := v_jobs || jsonb_build_object('job', v_def.job_name, 'schedule', v_def.schedule);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'scheduled', v_jobs);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_nexos_jobs(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_nexos_jobs(text, text) TO service_role;
