-- Tabela Mestre de Classificação Fiscal (NCM)
CREATE TABLE public.ncm_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    material TEXT,
    ncm TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Revisar' CHECK (status IN ('Confirmado', 'Revisar')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncm_master TO authenticated;
GRANT ALL ON public.ncm_master TO service_role;

-- RLS
ALTER TABLE public.ncm_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select ncm_master"
ON public.ncm_master FOR SELECT
TO authenticated
USING (true);

-- Índices para performance na busca de sugestões
CREATE INDEX idx_ncm_master_lookup ON public.ncm_master (category, material);
