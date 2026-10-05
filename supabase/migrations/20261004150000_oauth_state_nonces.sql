-- =====================================================================
-- Auditoria 04/10/2026 — achado 05: state OAuth de uso único.
-- Só o servidor (service role) lê/grava; RLS ligada sem políticas.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.oauth_state_nonces (
  nonce text PRIMARY KEY,
  user_id uuid,
  provider text NOT NULL DEFAULT 'mercadolivre',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_nonces_created
  ON public.oauth_state_nonces(created_at);

ALTER TABLE public.oauth_state_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_state_nonces FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.oauth_state_nonces TO service_role;
