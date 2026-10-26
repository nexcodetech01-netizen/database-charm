-- Módulos ligados/desligados por empresa (26/10/2026).
-- {} = tudo ligado. Ex.: {"fiscal": false, "bella": false}. Só esconde do menu.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS enabled_modules jsonb NOT NULL DEFAULT '{}'::jsonb;
