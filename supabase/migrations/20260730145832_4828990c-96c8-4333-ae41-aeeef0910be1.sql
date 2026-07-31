
-- =========================================================
-- PARTE 1 — MOVIMENTO DE ABERTURA
-- =========================================================
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS total_cost numeric;

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_type_check
  CHECK (type = ANY (ARRAY['in','out','adjustment','transfer','reservation','opening']));

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_source_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_source_check
  CHECK (source IS NULL OR source = ANY (ARRAY['manual','purchase','sale','adjustment','sale_return','sale_cancellation','system','opening']));

-- Um único movimento de abertura por produto
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_opening_per_product
  ON public.inventory_movements (company_id, product_id)
  WHERE type = 'opening';

-- Motor: abertura entra no razão como delta direto
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delta numeric := 0;
  cur_stock numeric;
  new_stock numeric;
  prod_name text;
  affected_rows integer := 0;
BEGIN
  IF NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'Movimentação sem produto não é permitida.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Movimentação sem empresa não é permitida.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.type = 'opening' THEN
    IF NEW.unit_cost IS NULL OR NEW.unit_cost < 0 THEN
      RAISE EXCEPTION 'Movimento de abertura exige custo unitário válido.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.total_cost := ROUND(COALESCE(NEW.unit_cost,0) * NEW.quantity, 6);
    NEW.reason := COALESCE(NEW.reason, 'Saldo inicial');
    delta := NEW.quantity;
  ELSIF NEW.type = 'in' THEN
    delta := ABS(NEW.quantity);
  ELSIF NEW.type = 'out' THEN
    delta := -ABS(NEW.quantity);
  ELSIF NEW.type = 'adjustment' THEN
    delta := NEW.quantity;
  ELSE
    delta := 0;
  END IF;

  IF NEW.unit_cost IS NOT NULL AND NEW.total_cost IS NULL THEN
    NEW.total_cost := ROUND(NEW.unit_cost * NEW.quantity, 6);
  END IF;

  IF delta <> 0 THEN
    SELECT p.stock, p.name INTO cur_stock, prod_name
      FROM public.products p
     WHERE p.id = NEW.product_id AND p.company_id = NEW.company_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado para a movimentação (product_id=%, company_id=%).',
        NEW.product_id, NEW.company_id USING ERRCODE = 'foreign_key_violation';
    END IF;

    new_stock := COALESCE(cur_stock, 0) + delta;

    IF new_stock < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": saldo atual %, movimentação % resultaria em %. Operação abortada.',
        COALESCE(prod_name, NEW.product_id::text), COALESCE(cur_stock, 0), delta, new_stock
        USING ERRCODE = 'check_violation';
    END IF;

    PERFORM set_config('nexos.inventory_engine', 'on', true);
    UPDATE public.products SET stock = new_stock, updated_at = now()
     WHERE id = NEW.product_id AND company_id = NEW.company_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    PERFORM set_config('nexos.inventory_engine', 'off', true);

    IF affected_rows <> 1 THEN
      RAISE EXCEPTION 'Movimentação de estoque não atualizou exatamente um produto (product_id=%, company_id=%, linhas=%).',
        NEW.product_id, NEW.company_id, affected_rows;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =========================================================
-- PARTE 4 — POLÍTICA DE CUSTO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.company_inventory_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  allow_sale_without_cost boolean NOT NULL DEFAULT true,
  cost_method text NOT NULL DEFAULT 'average' CHECK (cost_method IN ('average','last_purchase')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.company_inventory_settings TO authenticated;
GRANT ALL ON public.company_inventory_settings TO service_role;
ALTER TABLE public.company_inventory_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_inventory_settings_select" ON public.company_inventory_settings
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));
CREATE POLICY "company_inventory_settings_insert" ON public.company_inventory_settings
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));
CREATE POLICY "company_inventory_settings_update" ON public.company_inventory_settings
  FOR UPDATE TO authenticated USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

DROP TRIGGER IF EXISTS trg_company_inventory_settings_touch ON public.company_inventory_settings;
CREATE TRIGGER trg_company_inventory_settings_touch
  BEFORE UPDATE ON public.company_inventory_settings
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- =========================================================
-- PARTE 3 — SNAPSHOT DE CUSTO
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS last_purchase_cost numeric;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS average_cost numeric,
  ADD COLUMN IF NOT EXISTS last_purchase_cost numeric,
  ADD COLUMN IF NOT EXISTS cost_method text,
  ADD COLUMN IF NOT EXISTS total_cost numeric;

CREATE OR REPLACE FUNCTION public.enforce_sale_item_cost_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_status text;
  v_allow boolean := true;
  v_method text := 'average';
  v_avg numeric;
  v_last numeric;
BEGIN
  SELECT s.company_id, lower(COALESCE(s.status,'pending')) INTO v_company, v_status
    FROM public.sales s WHERE s.id = NEW.sale_id;

  IF NEW.product_id IS NOT NULL THEN
    SELECT p.cost, p.last_purchase_cost INTO v_avg, v_last
      FROM public.products p WHERE p.id = NEW.product_id;
  END IF;

  SELECT cis.allow_sale_without_cost, cis.cost_method INTO v_allow, v_method
    FROM public.company_inventory_settings cis WHERE cis.company_id = v_company;
  v_allow := COALESCE(v_allow, true);
  v_method := COALESCE(v_method, 'average');

  NEW.average_cost := COALESCE(NEW.average_cost, v_avg);
  NEW.last_purchase_cost := COALESCE(NEW.last_purchase_cost, v_last);
  NEW.cost_method := COALESCE(NEW.cost_method, v_method);
  NEW.unit_cost := COALESCE(
    NEW.unit_cost,
    CASE WHEN v_method = 'last_purchase' THEN COALESCE(v_last, v_avg) ELSE COALESCE(v_avg, v_last) END
  );

  IF NEW.unit_cost IS NOT NULL THEN
    NEW.total_cost := ROUND(NEW.unit_cost * COALESCE(NEW.quantity, 0), 6);
  END IF;

  IF NOT v_allow
     AND NEW.product_id IS NOT NULL
     AND v_status NOT IN ('draft','cancelled')
     AND (NEW.unit_cost IS NULL OR NEW.unit_cost <= 0) THEN
    RAISE EXCEPTION 'O produto não possui custo registrado. Defina um custo antes da venda.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sale_item_cost_snapshot ON public.sale_items;
CREATE TRIGGER trg_sale_item_cost_snapshot
  BEFORE INSERT OR UPDATE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sale_item_cost_snapshot();

-- Último custo de compra alimentado pelo recebimento
CREATE OR REPLACE FUNCTION public.apply_purchase_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  cur_stock NUMERIC;
  cur_cost  NUMERIC;
  new_cost  NUMERIC;
  new_stock NUMERIC;
  v_reason  TEXT;
  v_items_base NUMERIC;
  v_extra NUMERIC;
  v_landed_unit NUMERIC;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    SELECT COALESCE(SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.unit_price, 0)), 0)
      INTO v_items_base FROM public.purchase_items pi WHERE pi.purchase_id = NEW.id;

    v_extra := COALESCE(NEW.shipping, 0) + COALESCE(NEW.insurance, 0)
             + COALESCE(NEW.other_costs, 0) - COALESCE(NEW.discount, 0);

    FOR item IN
      SELECT pi.id AS item_id, pi.product_id, pi.quantity, pi.unit_price, pi.description
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id AND pi.product_id IS NOT NULL
    LOOP
      IF COALESCE(item.quantity, 0) <= 0 THEN
        RAISE EXCEPTION 'Item % da compra % possui quantidade inválida (%). Deve ser maior que zero.',
          COALESCE(item.description, item.item_id::text), COALESCE(NEW.number, NEW.id::text), item.quantity
          USING ERRCODE = 'check_violation';
      END IF;

      IF COALESCE(item.unit_price, 0) < 0 THEN
        RAISE EXCEPTION 'Item % da compra % possui custo unitário negativo (%).',
          COALESCE(item.description, item.item_id::text), COALESCE(NEW.number, NEW.id::text), item.unit_price
          USING ERRCODE = 'check_violation';
      END IF;

      IF v_items_base > 0 AND v_extra <> 0 THEN
        v_landed_unit := ROUND(
          COALESCE(item.unit_price, 0)
          + (v_extra * ((COALESCE(item.quantity, 0) * COALESCE(item.unit_price, 0)) / v_items_base))
            / NULLIF(item.quantity, 0)
        , 6);
      ELSE
        v_landed_unit := COALESCE(item.unit_price, 0);
      END IF;
      IF v_landed_unit < 0 THEN v_landed_unit := 0; END IF;

      SELECT stock, cost INTO cur_stock, cur_cost
        FROM public.products WHERE id = item.product_id FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto % não encontrado ao aplicar recebimento da compra %.',
          item.product_id, COALESCE(NEW.number, NEW.id::text) USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := v_landed_unit;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * v_landed_unit)) / (cur_stock + item.quantity);
      END IF;
      new_cost := ROUND(new_cost, 6);

      new_stock := COALESCE(cur_stock, 0) + item.quantity;
      v_reason  := 'Compra ' || COALESCE(NEW.number, NEW.id::text);

      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity, reason, notes, movement_date, user_id,
        source, reference_id, reference_number, unit_cost, total_cost
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity, 'Compra', v_reason,
        COALESCE(NEW.received_at, now()), NEW.created_by,
        'purchase', NEW.id, NEW.number, v_landed_unit, ROUND(v_landed_unit * item.quantity, 6)
      );

      UPDATE public.products
         SET cost = new_cost, last_purchase_cost = v_landed_unit, updated_at = now()
       WHERE id = item.product_id;

      INSERT INTO public.purchase_receipt_audits(
        company_id, purchase_id, purchase_item_id, product_id, quantity, unit_cost,
        previous_stock, new_stock, previous_cost, new_cost, reason, notes, user_id
      ) VALUES (
        NEW.company_id, NEW.id, item.item_id, item.product_id, item.quantity, v_landed_unit,
        COALESCE(cur_stock, 0), new_stock, cur_cost, new_cost, 'purchase_received',
        v_reason || ' (custo com rateio de frete/seguro/outros)', NEW.created_by
      );
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- =========================================================
-- PARTE 6 — AUDITORIA DE RECONCILIAÇÃO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventory_reconciliation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  before_stock numeric NOT NULL DEFAULT 0,
  ledger_stock numeric NOT NULL DEFAULT 0,
  adjustment numeric NOT NULL DEFAULT 0,
  opening_movement_created boolean NOT NULL DEFAULT false,
  opening_movement_id uuid,
  unit_cost numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.inventory_reconciliation_audit TO authenticated;
GRANT ALL ON public.inventory_reconciliation_audit TO service_role;
ALTER TABLE public.inventory_reconciliation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_reconciliation_audit_select" ON public.inventory_reconciliation_audit
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

CREATE INDEX IF NOT EXISTS idx_inv_reconciliation_company_created
  ON public.inventory_reconciliation_audit (company_id, created_at DESC);

-- =========================================================
-- PARTE 5 — RAZÃO DE ESTOQUE
-- =========================================================
CREATE OR REPLACE FUNCTION public.inventory_ledger_audit(_company_id uuid)
RETURNS TABLE (
  product_id uuid,
  sku text,
  name text,
  opening numeric,
  inbound numeric,
  outbound numeric,
  ledger_stock numeric,
  current_stock numeric,
  difference numeric,
  inconsistent boolean,
  has_opening boolean,
  unit_cost numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH led AS (
    SELECT m.product_id,
      COALESCE(SUM(CASE WHEN m.type = 'opening' THEN m.quantity ELSE 0 END), 0) AS opening,
      COALESCE(SUM(CASE WHEN m.type = 'in' THEN ABS(m.quantity)
                        WHEN m.type = 'adjustment' AND m.quantity > 0 THEN m.quantity ELSE 0 END), 0) AS inbound,
      COALESCE(SUM(CASE WHEN m.type = 'out' THEN ABS(m.quantity)
                        WHEN m.type = 'adjustment' AND m.quantity < 0 THEN ABS(m.quantity) ELSE 0 END), 0) AS outbound,
      bool_or(m.type = 'opening') AS has_opening
    FROM public.inventory_movements m
    WHERE m.company_id = _company_id
    GROUP BY m.product_id
  )
  SELECT p.id,
         p.sku,
         p.name,
         COALESCE(l.opening, 0),
         COALESCE(l.inbound, 0),
         COALESCE(l.outbound, 0),
         COALESCE(l.opening, 0) + COALESCE(l.inbound, 0) - COALESCE(l.outbound, 0) AS ledger_stock,
         COALESCE(p.stock, 0),
         COALESCE(p.stock, 0) - (COALESCE(l.opening, 0) + COALESCE(l.inbound, 0) - COALESCE(l.outbound, 0)) AS difference,
         (COALESCE(p.stock, 0) - (COALESCE(l.opening, 0) + COALESCE(l.inbound, 0) - COALESCE(l.outbound, 0))) <> 0 AS inconsistent,
         COALESCE(l.has_opening, false),
         p.cost
  FROM public.products p
  LEFT JOIN led l ON l.product_id = p.id
  WHERE p.company_id = _company_id
    AND public.user_has_company_access(p.company_id);
$function$;

GRANT EXECUTE ON FUNCTION public.inventory_ledger_audit(uuid) TO authenticated;

-- =========================================================
-- PARTE 2 — ASSISTENTE DE RECONCILIAÇÃO
-- =========================================================
CREATE OR REPLACE FUNCTION public.reconcile_inventory_opening(_company_id uuid, _dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_user uuid := auth.uid();
  v_movement uuid;
  v_created integer := 0;
  v_skipped integer := 0;
  v_pending integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF _company_id IS NULL OR NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Empresa inválida para reconciliação.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR r IN SELECT * FROM public.inventory_ledger_audit(_company_id) WHERE inconsistent LOOP
    IF r.has_opening THEN
      -- Nunca duplicar abertura: produto permanece inconsistente para análise manual.
      v_pending := v_pending + 1;
      v_items := v_items || jsonb_build_object(
        'product_id', r.product_id, 'sku', r.sku, 'name', r.name,
        'before_stock', r.current_stock, 'ledger_stock', r.ledger_stock,
        'adjustment', r.difference, 'opening_movement_created', false,
        'status', 'pending_manual'
      );
      CONTINUE;
    END IF;

    IF _dry_run THEN
      v_skipped := v_skipped + 1;
      v_items := v_items || jsonb_build_object(
        'product_id', r.product_id, 'sku', r.sku, 'name', r.name,
        'before_stock', r.current_stock, 'ledger_stock', r.ledger_stock,
        'adjustment', r.difference, 'opening_movement_created', false,
        'status', 'simulated'
      );
      CONTINUE;
    END IF;

    -- Saldo já está correto em products.stock: a abertura apenas documenta o razão
    -- sem mover o saldo novamente.
    PERFORM set_config('nexos.inventory_engine', 'on', true);
    UPDATE public.products SET stock = COALESCE(stock, 0) - r.difference
      WHERE id = r.product_id AND company_id = _company_id;
    PERFORM set_config('nexos.inventory_engine', 'off', true);

    INSERT INTO public.inventory_movements(
      company_id, product_id, type, quantity, reason, notes,
      movement_date, user_id, source, unit_cost
    ) VALUES (
      _company_id, r.product_id, 'opening', r.difference, 'Saldo inicial',
      'Reconciliação automática do razão de estoque',
      now(), v_user, 'opening', COALESCE(r.unit_cost, 0)
    ) RETURNING id INTO v_movement;

    INSERT INTO public.inventory_reconciliation_audit(
      company_id, product_id, before_stock, ledger_stock, adjustment,
      opening_movement_created, opening_movement_id, unit_cost, notes, created_by
    ) VALUES (
      _company_id, r.product_id, r.current_stock, r.ledger_stock, r.difference,
      true, v_movement, COALESCE(r.unit_cost, 0), 'Movimento de abertura criado', v_user
    );

    v_created := v_created + 1;
    v_items := v_items || jsonb_build_object(
      'product_id', r.product_id, 'sku', r.sku, 'name', r.name,
      'before_stock', r.current_stock, 'ledger_stock', r.ledger_stock,
      'adjustment', r.difference, 'opening_movement_created', true,
      'status', 'reconciled'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'reconciled', v_created,
    'simulated', v_skipped,
    'pending_manual', v_pending,
    'items', v_items
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reconcile_inventory_opening(uuid, boolean) TO authenticated;
