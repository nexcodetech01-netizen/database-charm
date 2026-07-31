
-- =========================================================================
-- REFORÇO DO RBAC EM RLS
-- Substitui as policies "FOR ALL" por policies por comando (SELECT/INSERT/
-- UPDATE/DELETE) exigindo user_has_company_access + has_permission.
-- =========================================================================

DO $$
DECLARE
  r RECORD;
  spec RECORD;
BEGIN
  -- Especificação: (table, module, parent_table opcional, parent_fk opcional)
  FOR spec IN
    SELECT * FROM (VALUES
      -- Finance
      ('financial_transactions','finance', NULL, NULL),
      ('financial_accounts','finance', NULL, NULL),
      ('financial_categories','finance', NULL, NULL),
      ('cost_centers','finance', NULL, NULL),
      ('payment_method_fees','finance', NULL, NULL),
      ('cash_movements','finance', NULL, NULL),
      ('cash_sessions','finance', NULL, NULL),
      ('credit_accounts','finance', NULL, NULL),
      ('credit_installments','finance', NULL, NULL),
      ('credit_payments','finance', NULL, NULL),
      -- Sales
      ('sales','sales', NULL, NULL),
      ('sale_returns','sales', NULL, NULL),
      ('sale_items','sales','sales','sale_id'),
      ('sale_return_items','sales','sale_returns','return_id'),
      -- Purchases
      ('purchases','purchases', NULL, NULL),
      ('purchase_items','purchases','purchases','purchase_id'),
      -- Products / Categorias / Fornecedores
      ('products','products', NULL, NULL),
      ('product_images','products', NULL, NULL),
      ('product_categories','categories', NULL, NULL),
      ('product_suppliers','suppliers', NULL, NULL),
      -- Customers
      ('customers','customers', NULL, NULL),
      ('customer_interactions','customers', NULL, NULL),
      -- Agenda / CRM
      ('appointments','agenda', NULL, NULL),
      ('crm_events','crm', NULL, NULL),
      ('opportunities','crm', NULL, NULL),
      ('pipeline_stages','crm', NULL, NULL)
    ) AS s(table_name, module_name, parent_table, parent_fk)
  LOOP
    -- Remover policies existentes desta tabela (exceto policies especiais
    -- que são tratadas separadamente abaixo).
    FOR r IN
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = spec.table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, spec.table_name);
    END LOOP;

    IF spec.parent_table IS NULL THEN
      -- Policies diretas usando company_id da própria tabela
      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR SELECT TO authenticated
          USING (
            user_has_company_access(company_id)
            AND has_permission(auth.uid(), company_id, %L)
          )
      $f$, 'rbac_' || spec.table_name || '_select', spec.table_name, spec.module_name || '.view');

      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR INSERT TO authenticated
          WITH CHECK (
            user_has_company_access(company_id)
            AND has_permission(auth.uid(), company_id, %L)
          )
      $f$, 'rbac_' || spec.table_name || '_insert', spec.table_name, spec.module_name || '.create');

      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR UPDATE TO authenticated
          USING (
            user_has_company_access(company_id)
            AND has_permission(auth.uid(), company_id, %L)
          )
          WITH CHECK (
            user_has_company_access(company_id)
            AND has_permission(auth.uid(), company_id, %L)
          )
      $f$, 'rbac_' || spec.table_name || '_update', spec.table_name,
           spec.module_name || '.update', spec.module_name || '.update');

      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR DELETE TO authenticated
          USING (
            user_has_company_access(company_id)
            AND has_permission(auth.uid(), company_id, %L)
          )
      $f$, 'rbac_' || spec.table_name || '_delete', spec.table_name, spec.module_name || '.delete');

    ELSE
      -- Policies via tabela pai (herda company_id do pai)
      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR SELECT TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.%I p
               WHERE p.id = %I.%I
                 AND user_has_company_access(p.company_id)
                 AND has_permission(auth.uid(), p.company_id, %L)
            )
          )
      $f$, 'rbac_' || spec.table_name || '_select', spec.table_name,
           spec.parent_table, spec.table_name, spec.parent_fk,
           spec.module_name || '.view');

      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR INSERT TO authenticated
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.%I p
               WHERE p.id = %I.%I
                 AND user_has_company_access(p.company_id)
                 AND has_permission(auth.uid(), p.company_id, %L)
            )
          )
      $f$, 'rbac_' || spec.table_name || '_insert', spec.table_name,
           spec.parent_table, spec.table_name, spec.parent_fk,
           spec.module_name || '.create');

      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR UPDATE TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.%I p
               WHERE p.id = %I.%I
                 AND user_has_company_access(p.company_id)
                 AND has_permission(auth.uid(), p.company_id, %L)
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.%I p
               WHERE p.id = %I.%I
                 AND user_has_company_access(p.company_id)
                 AND has_permission(auth.uid(), p.company_id, %L)
            )
          )
      $f$, 'rbac_' || spec.table_name || '_update', spec.table_name,
           spec.parent_table, spec.table_name, spec.parent_fk, spec.module_name || '.update',
           spec.parent_table, spec.table_name, spec.parent_fk, spec.module_name || '.update');

      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR DELETE TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.%I p
               WHERE p.id = %I.%I
                 AND user_has_company_access(p.company_id)
                 AND has_permission(auth.uid(), p.company_id, %L)
            )
          )
      $f$, 'rbac_' || spec.table_name || '_delete', spec.table_name,
           spec.parent_table, spec.table_name, spec.parent_fk,
           spec.module_name || '.delete');
    END IF;
  END LOOP;
END $$;

-- =========================================================================
-- CASOS ESPECIAIS
-- =========================================================================

-- inventory_movements: continua append-only (sem UPDATE/DELETE pela Data API),
-- mas SELECT/INSERT passam a exigir permissão de inventário.
DROP POLICY IF EXISTS rbac_inventory_movements_select ON public.inventory_movements;
DROP POLICY IF EXISTS rbac_inventory_movements_insert ON public.inventory_movements;
DROP POLICY IF EXISTS rbac_inventory_movements_update ON public.inventory_movements;
DROP POLICY IF EXISTS rbac_inventory_movements_delete ON public.inventory_movements;
DROP POLICY IF EXISTS invmov_owner_select ON public.inventory_movements;
DROP POLICY IF EXISTS invmov_owner_insert ON public.inventory_movements;

CREATE POLICY rbac_inventory_movements_select ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'inventory.view')
  );

CREATE POLICY rbac_inventory_movements_insert ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'inventory.create')
  );

-- sale_events: SELECT com permissão de vendas; INSERT direto continua bloqueado
-- (só a RPC via SECURITY DEFINER pode inserir eventos).
DROP POLICY IF EXISTS rbac_sale_events_select ON public.sale_events;
DROP POLICY IF EXISTS rbac_sale_events_insert ON public.sale_events;
DROP POLICY IF EXISTS rbac_sale_events_update ON public.sale_events;
DROP POLICY IF EXISTS rbac_sale_events_delete ON public.sale_events;
DROP POLICY IF EXISTS sale_events_no_direct_insert ON public.sale_events;
DROP POLICY IF EXISTS sale_events_select_company ON public.sale_events;

CREATE POLICY rbac_sale_events_select ON public.sale_events
  FOR SELECT TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'sales.view')
  );

CREATE POLICY sale_events_no_direct_insert ON public.sale_events
  FOR INSERT TO authenticated
  WITH CHECK (false);
