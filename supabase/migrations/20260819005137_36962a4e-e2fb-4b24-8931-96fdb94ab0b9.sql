-- Habilita realtime para whatsapp_message_events
BEGIN;
  -- Verifica se a tabela já está na publicação para evitar erro
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_message_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_events;
    END IF;
  END $$;
COMMIT;