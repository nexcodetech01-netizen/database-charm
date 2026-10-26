-- Tema do catálogo público por loja (26/10/2026): claro (padrão) ou escuro.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS catalog_theme text NOT NULL DEFAULT 'light';

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_catalog_theme_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_catalog_theme_check CHECK (catalog_theme IN ('light', 'dark'));
