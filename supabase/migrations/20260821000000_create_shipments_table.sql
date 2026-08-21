-- Tabela de rastreio de envios — guarda o código de rastreio e dados da
-- etiqueta gerados na Calculadora de Frete, ligados à venda de origem.
-- Antes disso, o `tracking_code` da SuperFrete só existia na tela na
-- hora da emissão e nunca era salvo em lugar nenhum — sem essa tabela
-- não tem como ter uma página de rastreio pro cliente depois.

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  order_source text,
  order_reference text,
  carrier text,
  service_name text,
  tracking_code text,
  label_url text,
  order_id_superfrete text,
  status text NOT NULL DEFAULT 'label_created',
  recipient_name text,
  recipient_city text,
  recipient_state text,
  estimated_delivery_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_company_id ON public.shipments (company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_sale_id ON public.shipments (sale_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_code ON public.shipments (tracking_code);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Acesso interno: só o dono da empresa vê/gerencia os envios dela.
CREATE POLICY "shipments_owner_all" ON public.shipments FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));

-- IMPORTANTE: NÃO existe policy pública direta de leitura nessa tabela.
-- A página de rastreio do cliente (sem login) busca os dados através
-- de uma server function (`getShipmentByTrackingCode`, usando
-- supabaseAdmin no servidor) — o mesmo padrão já usado nas páginas
-- públicas do catálogo (load-product-page.server.ts). Uma policy RLS
-- pública de SELECT direta seria arriscada: com a chave anônima (que é
-- pública por natureza), qualquer pessoa poderia listar TODOS os
-- envios de TODAS as empresas, não só o específico buscado — a
-- filtragem "só o resultado exato" só é garantida fazendo a consulta
-- no servidor, não deixando a tabela toda visível via RLS.

-- Realtime: pra status atualizar sozinho na página de rastreio, se um
-- dia isso for automatizado via webhook da SuperFrete.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shipments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
  END IF;
END $$;

COMMENT ON TABLE public.shipments IS 'Rastreio de envios gerados via SuperFrete (ou outra transportadora futura), ligados a uma venda. Alimenta a página pública de rastreio do cliente.';
