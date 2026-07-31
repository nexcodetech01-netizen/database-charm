CREATE OR REPLACE FUNCTION public.generate_executive_summary(
  _company_id uuid,
  _start date DEFAULT NULL,
  _end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
  v_dre jsonb;
  v_prev_dre jsonb;
  v_balance jsonb;
  v_kpis jsonb;
  v_cash numeric;
  v_receivable numeric;
  v_overdue_receivable numeric;
  v_payable numeric;
  v_overdue_payable numeric;
  v_inventory_value numeric;
  v_inventory_items integer;
  v_stale_items integer;
  v_rbt12 numeric;
  v_month_revenue numeric;
  v_tax jsonb;
  v_profile record;
  v_products jsonb;
  v_customers jsonb;
  v_suppliers jsonb;
  v_sales_count integer;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'not authorized for company %', _company_id USING ERRCODE = '42501';
  END IF;

  v_today := public.company_today(_company_id);
  v_end := COALESCE(_end, v_today);
  v_start := COALESCE(_start, date_trunc('month', v_end)::date);
  v_prev_start := (v_start - INTERVAL '1 month')::date;
  v_prev_end := (v_start - INTERVAL '1 day')::date;

  v_dre := public.generate_dre(_company_id, v_start, v_end);
  v_prev_dre := public.generate_dre(_company_id, v_prev_start, v_prev_end);
  v_balance := public.generate_balance_sheet(_company_id, v_end);
  v_kpis := public.financial_kpis(_company_id, v_start, v_end);

  SELECT COALESCE(SUM(current_balance), 0) INTO v_cash
  FROM public.financial_accounts
  WHERE company_id = _company_id AND status = 'active';

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND status <> 'paid' AND status <> 'cancelled'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND status <> 'paid' AND status <> 'cancelled' AND due_date < v_today), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND status <> 'paid' AND status <> 'cancelled'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND status <> 'paid' AND status <> 'cancelled' AND due_date < v_today), 0)
  INTO v_receivable, v_overdue_receivable, v_payable, v_overdue_payable
  FROM public.financial_transactions
  WHERE company_id = _company_id;

  SELECT
    COALESCE(SUM(GREATEST(COALESCE(stock, 0), 0) * COALESCE(cost, 0)), 0),
    COUNT(*) FILTER (WHERE COALESCE(stock, 0) > 0)
  INTO v_inventory_value, v_inventory_items
  FROM public.products
  WHERE company_id = _company_id AND status = 'active';

  SELECT COUNT(*) INTO v_stale_items
  FROM public.products p
  WHERE p.company_id = _company_id
    AND p.status = 'active'
    AND COALESCE(p.stock, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
      WHERE si.product_id = p.id
        AND s.company_id = _company_id
        AND COALESCE(s.is_test, false) = false
        AND s.status <> 'cancelled'
        AND s.sale_date >= (v_today - INTERVAL '90 days')::date
    );

  SELECT COUNT(*) INTO v_sales_count
  FROM public.sales
  WHERE company_id = _company_id
    AND COALESCE(is_test, false) = false
    AND status <> 'cancelled'
    AND sale_date BETWEEN v_start AND v_end;

  v_rbt12 := public.company_rbt12(_company_id, v_end);
  v_month_revenue := public.company_monthly_revenue(_company_id, v_end);

  SELECT * INTO v_profile FROM public.company_tax_profile
  WHERE company_id = _company_id AND active = true
  ORDER BY start_date DESC LIMIT 1;

  IF v_profile.id IS NOT NULL AND v_profile.tax_regime = 'simples_nacional' THEN
    v_tax := public.simples_compute(COALESCE(v_profile.simples_annex, 'I'), v_rbt12, v_month_revenue);
  ELSE
    v_tax := NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_products FROM (
    SELECT
      p.id, p.name, p.sku,
      COALESCE(p.stock, 0) AS stock,
      COALESCE(SUM(si.quantity), 0) AS quantity_sold,
      COALESCE(SUM(si.total), 0) AS revenue,
      COALESCE(SUM(si.total - COALESCE(si.total_cost, si.quantity * COALESCE(si.unit_cost, 0))), 0) AS profit
    FROM public.products p
    LEFT JOIN public.sale_items si ON si.product_id = p.id
    LEFT JOIN public.sales s ON s.id = si.sale_id
      AND s.company_id = _company_id
      AND COALESCE(s.is_test, false) = false
      AND s.status <> 'cancelled'
      AND s.sale_date BETWEEN v_start AND v_end
    WHERE p.company_id = _company_id AND p.status = 'active'
    GROUP BY p.id, p.name, p.sku, p.stock
    ORDER BY 6 DESC
    LIMIT 200
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_customers FROM (
    SELECT
      c.id, c.name,
      COUNT(DISTINCT s.id) AS sales_count,
      COALESCE(SUM(s.grand_total), 0) AS revenue,
      COALESCE((
        SELECT SUM(ft.amount) FROM public.financial_transactions ft
        WHERE ft.company_id = _company_id
          AND ft.type = 'income'
          AND ft.status NOT IN ('paid', 'cancelled')
          AND ft.due_date < v_today
          AND ft.reference_id IN (SELECT s2.id FROM public.sales s2 WHERE s2.customer_id = c.id)
      ), 0) AS overdue_amount,
      MAX(s.sale_date) AS last_sale_at
    FROM public.customers c
    LEFT JOIN public.sales s ON s.customer_id = c.id
      AND s.company_id = _company_id
      AND COALESCE(s.is_test, false) = false
      AND s.status <> 'cancelled'
      AND s.sale_date BETWEEN v_start AND v_end
    WHERE c.company_id = _company_id
    GROUP BY c.id, c.name
    ORDER BY 4 DESC
    LIMIT 100
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_suppliers FROM (
    SELECT
      sup.id, sup.name,
      COUNT(pu.id) AS purchases_count,
      COALESCE(SUM(pu.grand_total), 0) AS total_amount,
      COALESCE(AVG(pu.grand_total), 0) AS average_amount,
      COALESCE(MAX(sup.delivery_days), 0) AS delivery_days
    FROM public.product_suppliers sup
    LEFT JOIN public.purchases pu ON pu.supplier_id = sup.id
      AND pu.company_id = _company_id
      AND pu.status <> 'cancelled'
      AND pu.purchase_date BETWEEN v_start AND v_end
    WHERE sup.company_id = _company_id
    GROUP BY sup.id, sup.name
    ORDER BY 4 DESC
    LIMIT 100
  ) t;

  RETURN jsonb_build_object(
    'companyId', _company_id,
    'period', jsonb_build_object('start', v_start, 'end', v_end, 'today', v_today),
    'previousPeriod', jsonb_build_object('start', v_prev_start, 'end', v_prev_end),
    'dre', v_dre,
    'previousDre', v_prev_dre,
    'balanceSheet', v_balance,
    'kpis', v_kpis,
    'cash', jsonb_build_object(
      'available', v_cash,
      'receivable', v_receivable,
      'overdueReceivable', v_overdue_receivable,
      'payable', v_payable,
      'overduePayable', v_overdue_payable
    ),
    'inventory', jsonb_build_object(
      'value', v_inventory_value,
      'items', v_inventory_items,
      'staleItems', v_stale_items
    ),
    'tax', jsonb_build_object(
      'regime', v_profile.tax_regime,
      'annex', v_profile.simples_annex,
      'rbt12', v_rbt12,
      'monthRevenue', v_month_revenue,
      'computation', v_tax
    ),
    'salesCount', v_sales_count,
    'rankings', jsonb_build_object(
      'products', v_products,
      'customers', v_customers,
      'suppliers', v_suppliers
    ),
    'generatedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_executive_summary(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_executive_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_executive_summary(uuid, date, date) TO service_role;