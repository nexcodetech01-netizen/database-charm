-- Preserve every existing SELECT/INSERT/UPDATE policy and harden only DELETE.

-- SALES
DROP POLICY IF EXISTS rbac_sales_delete ON public.sales;
CREATE POLICY rbac_sales_delete ON public.sales
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'sales.delete')
    AND status = 'draft'
  );

DROP POLICY IF EXISTS rbac_sale_returns_delete ON public.sale_returns;
CREATE POLICY rbac_sale_returns_delete ON public.sale_returns
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'sales.delete')
    AND refund_status = 'not_required'
  );

DROP POLICY IF EXISTS rbac_sale_items_delete ON public.sale_items;
CREATE POLICY rbac_sale_items_delete ON public.sale_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND user_has_company_access(s.company_id)
        AND has_permission(auth.uid(), s.company_id, 'sales.delete')
        AND s.stock_applied IS NOT TRUE
    )
  );

-- PURCHASES
DROP POLICY IF EXISTS rbac_purchases_delete ON public.purchases;
CREATE POLICY rbac_purchases_delete ON public.purchases
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'purchases.delete')
    AND status <> 'received'
  );

DROP POLICY IF EXISTS rbac_purchase_items_delete ON public.purchase_items;
CREATE POLICY rbac_purchase_items_delete ON public.purchase_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.purchases p
      WHERE p.id = purchase_items.purchase_id
        AND user_has_company_access(p.company_id)
        AND has_permission(auth.uid(), p.company_id, 'purchases.delete')
        AND p.status <> 'received'
    )
  );

-- PRODUCTS / CATEGORIES / SUPPLIERS
DROP POLICY IF EXISTS rbac_products_delete ON public.products;
CREATE POLICY rbac_products_delete ON public.products
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'products.delete')
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_movements im
      WHERE im.product_id = products.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.sale_items si
      WHERE si.product_id = products.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.purchase_items pi
      WHERE pi.product_id = products.id
    )
  );

DROP POLICY IF EXISTS rbac_product_categories_delete ON public.product_categories;
CREATE POLICY rbac_product_categories_delete ON public.product_categories
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'categories.delete')
    AND NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.category_id = product_categories.id
    )
  );

DROP POLICY IF EXISTS rbac_product_suppliers_delete ON public.product_suppliers;
CREATE POLICY rbac_product_suppliers_delete ON public.product_suppliers
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'suppliers.delete')
    AND NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.supplier_id = product_suppliers.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.purchases pu
      WHERE pu.supplier_id = product_suppliers.id
    )
  );

-- CUSTOMERS
DROP POLICY IF EXISTS rbac_customers_delete ON public.customers;
CREATE POLICY rbac_customers_delete ON public.customers
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'customers.delete')
    AND NOT EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.customer_id = customers.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.customer_id = customers.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.customer_id = customers.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_interactions ci
      WHERE ci.customer_id = customers.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_events ce
      WHERE ce.customer_id = customers.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.loyalty_accounts la
      WHERE la.customer_id = customers.id
    )
  );

-- AGENDA / CRM
DROP POLICY IF EXISTS rbac_appointments_delete ON public.appointments;
CREATE POLICY rbac_appointments_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'agenda.delete')
    AND status <> 'concluido'
  );

DROP POLICY IF EXISTS rbac_crm_events_delete ON public.crm_events;

DROP POLICY IF EXISTS rbac_opportunities_delete ON public.opportunities;
CREATE POLICY rbac_opportunities_delete ON public.opportunities
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'crm.delete')
    AND status = 'open'
  );

DROP POLICY IF EXISTS rbac_pipeline_stages_delete ON public.pipeline_stages;
CREATE POLICY rbac_pipeline_stages_delete ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'crm.delete')
    AND is_won IS FALSE
    AND is_lost IS FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.stage_id = pipeline_stages.id
    )
  );