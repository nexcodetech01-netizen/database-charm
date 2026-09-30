-- =====================================================================
-- Tempo real para produtos e movimentações de estoque.
--
-- O app escuta essas tabelas (hook useInventoryRealtime) para que o
-- estoque mostrado seja o mesmo para todas as pessoas da empresa, sem F5.
-- O Realtime respeita as policies de RLS: cada usuário só recebe eventos
-- das linhas que já pode ler.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
  END IF;
END $$;
