-- ============================================================
-- HOTFIX INTEGRIDADE DE ESTOQUE (3 correções críticas)
-- 1) products.stock só muda via apply_inventory_movement()
-- 2) inventory_movements append-only (sem UPDATE/DELETE)
-- 3) estoque negativo bloqueado no motor
-- ============================================================

-- ---------- CORREÇÃO 3 + marcação do motor (CORREÇÃO 1) ----------
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
  IF NEW.type = 'in' THEN
    delta := ABS(NEW.quantity);
  ELSIF NEW.type = 'out' THEN
    delta := -ABS(NEW.quantity);
  ELSIF NEW.type = 'adjustment' THEN
    delta := NEW.quantity;
  ELSE
    delta := 0;
  END IF;

  IF delta <> 0 THEN
    SELECT p.stock, p.name
      INTO cur_stock, prod_name
      FROM public.products p
     WHERE p.id = NEW.product_id
       AND p.company_id = NEW.company_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Produto não encontrado para a movimentação (product_id=%, company_id=%).',
        NEW.product_id, NEW.company_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    new_stock := COALESCE(cur_stock, 0) + delta;

    IF new_stock < 0 THEN
      RAISE EXCEPTION
        'Estoque insuficiente para "%": saldo atual %, movimentação % resultaria em %. Operação abortada.',
        COALESCE(prod_name, NEW.product_id::text),
        COALESCE(cur_stock, 0), delta, new_stock
        USING ERRCODE = 'check_violation';
    END IF;

    -- Libera o guard de products.stock apenas dentro do motor oficial.
    PERFORM set_config('nexos.inventory_engine', 'on', true);

    UPDATE public.products
       SET stock = new_stock,
           updated_at = now()
     WHERE id = NEW.product_id
       AND company_id = NEW.company_id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    PERFORM set_config('nexos.inventory_engine', 'off', true);

    IF affected_rows <> 1 THEN
      RAISE EXCEPTION
        'Movimentação de estoque não atualizou exatamente um produto (product_id=%, company_id=%, linhas=%).',
        NEW.product_id, NEW.company_id, affected_rows;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------- CORREÇÃO 1: guard em products.stock ----------
CREATE OR REPLACE FUNCTION public.guard_product_stock_engine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock
     AND COALESCE(current_setting('nexos.inventory_engine', true), 'off') <> 'on' THEN
    RAISE EXCEPTION
      'Alteração direta de estoque não permitida para "%". O saldo só pode ser alterado por movimentação de estoque (inventory_movements).',
      COALESCE(NEW.name, NEW.id::text)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_product_stock_engine ON public.products;
CREATE TRIGGER trg_guard_product_stock_engine
BEFORE UPDATE OF stock ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_product_stock_engine();

-- ---------- CORREÇÃO 2: inventory_movements append-only ----------
CREATE OR REPLACE FUNCTION public.guard_inventory_movements_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION
    'inventory_movements é um razão append-only: % não é permitido. Registre uma nova movimentação de correção.',
    TG_OP
    USING ERRCODE = 'insufficient_privilege';
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_inventory_movements_append_only ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_append_only
BEFORE UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_movements_append_only();

-- Policies: apenas SELECT e INSERT
DROP POLICY IF EXISTS invmov_owner_all ON public.inventory_movements;

CREATE POLICY invmov_owner_select
ON public.inventory_movements
FOR SELECT
TO authenticated
USING (user_has_company_access(company_id));

CREATE POLICY invmov_owner_insert
ON public.inventory_movements
FOR INSERT
TO authenticated
WITH CHECK (user_has_company_access(company_id));

-- Grants: nenhum UPDATE/DELETE para clientes da API
REVOKE UPDATE, DELETE, TRUNCATE ON public.inventory_movements FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.inventory_movements FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.inventory_movements FROM PUBLIC;
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT SELECT, INSERT ON public.inventory_movements TO service_role;