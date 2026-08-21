-- Programa de Fidelidade — feature nova (2026-08-21).
--
-- Cliente ganha pontos automaticamente toda vez que uma venda é
-- marcada como paga (sales.status = 'paid'), calculado com base na
-- taxa configurada pela loja. Pontos podem ser resgatados depois como
-- desconto (o cálculo do valor do resgate fica na tela de venda —
-- essa migration só cuida do saldo/histórico de pontos).

-- 1. Configuração por empresa (uma linha por loja).
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  points_per_real numeric NOT NULL DEFAULT 1,
  redemption_value_per_point numeric NOT NULL DEFAULT 0.05,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Saldo de pontos por cliente (uma linha por cliente).
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  points_balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_company_id ON public.loyalty_accounts (company_id);

-- 3. Histórico de movimentações (ganho por venda, resgate, ajuste manual).
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  points integer NOT NULL,
  type text NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjustment')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id ON public.loyalty_transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_sale_id ON public.loyalty_transactions (sale_id);

-- 4. Função + trigger: credita pontos automaticamente quando uma
-- venda vira 'paid' (mesmo padrão de trigger automático já usado em
-- outras partes do sistema, ex.: apply_purchase_to_inventory).
CREATE OR REPLACE FUNCTION public.award_loyalty_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings RECORD;
  v_points integer;
BEGIN
  -- Só age quando a venda ACABOU de virar 'paid' (não estava paga antes)
  -- e tem um cliente vinculado — venda avulsa sem cliente não acumula.
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.customer_id IS NOT NULL THEN
    SELECT * INTO v_settings FROM public.loyalty_settings WHERE company_id = NEW.company_id;

    IF v_settings.enabled IS TRUE THEN
      v_points := FLOOR(NEW.grand_total * v_settings.points_per_real);

      IF v_points > 0 THEN
        INSERT INTO public.loyalty_accounts (customer_id, company_id, points_balance)
        VALUES (NEW.customer_id, NEW.company_id, v_points)
        ON CONFLICT (customer_id)
        DO UPDATE SET points_balance = public.loyalty_accounts.points_balance + v_points, updated_at = now();

        INSERT INTO public.loyalty_transactions (company_id, customer_id, sale_id, points, type, notes)
        VALUES (NEW.company_id, NEW.customer_id, NEW.id, v_points, 'earned', 'Venda #' || NEW.number);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_loyalty_points ON public.sales;
CREATE TRIGGER trg_award_loyalty_points
  AFTER UPDATE OF status ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.award_loyalty_points();

-- RLS
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_settings_owner_all" ON public.loyalty_settings FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));

CREATE POLICY "loyalty_accounts_owner_all" ON public.loyalty_accounts FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));

CREATE POLICY "loyalty_transactions_owner_all" ON public.loyalty_transactions FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));

-- IMPORTANTE: sem policy pública direta — a consulta de saldo pelo
-- cliente (via telefone, sem login) passa por server function, mesmo
-- padrão já usado em `shipments` e `product_reviews`.

COMMENT ON TABLE public.loyalty_settings IS 'Configuração do programa de fidelidade por empresa (taxa de pontos, valor de resgate).';
COMMENT ON TABLE public.loyalty_accounts IS 'Saldo atual de pontos por cliente.';
COMMENT ON TABLE public.loyalty_transactions IS 'Histórico de pontos ganhos/resgatados/ajustados por cliente.';
