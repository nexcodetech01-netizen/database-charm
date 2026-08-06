CREATE TABLE IF NOT EXISTS public.ncm_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    material TEXT,
    ncm TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Revisar' CHECK (status IN ('Confirmado', 'Revisar')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncm_master TO authenticated;
GRANT ALL ON public.ncm_master TO service_role;
ALTER TABLE public.ncm_master ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can select ncm_master' AND tablename = 'ncm_master') THEN
        CREATE POLICY "Authenticated users can select ncm_master"
        ON public.ncm_master FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

INSERT INTO public.ncm_master (category, material, ncm, description, status)
VALUES 
    ('Bolsa', 'Couro', '42022100', 'Bolsas com superfície exterior de couro natural ou reconstituído', 'Confirmado'),
    ('Bolsa', 'Sintético', '42022210', 'Bolsas com superfície exterior de folhas de plástico', 'Confirmado'),
    ('Bolsa', 'Têxtil', '42022220', 'Bolsas com superfície exterior de matérias têxteis', 'Confirmado'),
    ('Carteira', 'Couro', '42023100', 'Carteiras com superfície exterior de couro natural ou reconstituído', 'Confirmado'),
    ('Carteira', 'Sintético', '42023200', 'Carteiras com superfície exterior de folhas de plástico ou de matérias têxteis', 'Confirmado'),
    ('Mochila', NULL, '42029200', 'Mochilas com superfície exterior de folhas de plástico ou de matérias têxteis', 'Confirmado'),
    ('Calçado', 'Couro', '64039990', 'Calçados com sola exterior de borracha ou plástico e parte superior de couro natural', 'Confirmado'),
    ('Calçado', 'Sintético', '64029990', 'Outros calçados com sola exterior e parte superior de borracha ou plástico', 'Confirmado'),
    ('Vestuário', 'Algodão', '61091000', 'Camisetas (t-shirts) de malha, de algodão', 'Confirmado'),
    ('Bijuteria', NULL, '71171900', 'Bijuterias de metais comuns, mesmo prateados, dourados ou platinados', 'Confirmado'),
    ('Acessórios', NULL, '71179000', 'Outras bijuterias', 'Confirmado'),
    ('Eletrônicos', 'Celular', '85171300', 'Smartphones', 'Confirmado'),
    ('Eletrônicos', 'Som', '85182100', 'Alto-falantes (altifalantes) simples', 'Confirmado'),
    ('Utilidades', 'Plástico', '39241000', 'Serviços de mesa e outros artigos de uso doméstico, de plásticos', 'Confirmado'),
    ('Óculos', 'Sol', '90041000', 'Óculos de sol', 'Confirmado'),
    ('Relógio', 'Pulso', '91021110', 'Relógios de pulso, elétricos, com mostrador mecânico', 'Confirmado'),
    ('Cinto', 'Couro', '42033000', 'Cintos, cinturões e bandoleiras ou talabartes, de couro natural ou reconstituído', 'Confirmado')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ncm_master_lookup ON public.ncm_master (category, material);
