-- ============================================================
-- RC.0.2 — MULTI-TENANT HARDENING
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles.current_company_id -> campo controlado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_company_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Contextos de servidor (service role, SECURITY DEFINER internos, jobs)
  -- não possuem auth.uid(): mantêm o comportamento atual.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.current_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.current_company_id IS NOT DISTINCT FROM OLD.current_company_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.user_has_company_access(NEW.current_company_id) THEN
    RAISE EXCEPTION 'Empresa nao vinculada ao usuario.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_profiles_company_binding ON public.profiles;
CREATE TRIGGER trg_profiles_company_binding
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_company_binding();

-- ------------------------------------------------------------
-- 2. Policies: current_company_id -> user_has_company_access()
-- ------------------------------------------------------------

-- bella_automations
DROP POLICY IF EXISTS "Automations: tenant read" ON public.bella_automations;
CREATE POLICY "Automations: tenant read" ON public.bella_automations
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Automations: tenant insert" ON public.bella_automations;
CREATE POLICY "Automations: tenant insert" ON public.bella_automations
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Automations: tenant update" ON public.bella_automations;
CREATE POLICY "Automations: tenant update" ON public.bella_automations
  FOR UPDATE TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Automations: tenant delete" ON public.bella_automations;
CREATE POLICY "Automations: tenant delete" ON public.bella_automations
  FOR DELETE TO authenticated USING (public.user_has_company_access(company_id));

-- bella_automation_runs
DROP POLICY IF EXISTS "Automation runs: tenant read" ON public.bella_automation_runs;
CREATE POLICY "Automation runs: tenant read" ON public.bella_automation_runs
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

-- knowledge_documents
DROP POLICY IF EXISTS "knowledge_documents tenant read" ON public.knowledge_documents;
CREATE POLICY "knowledge_documents tenant read" ON public.knowledge_documents
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "knowledge_documents tenant insert" ON public.knowledge_documents;
CREATE POLICY "knowledge_documents tenant insert" ON public.knowledge_documents
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "knowledge_documents tenant update" ON public.knowledge_documents;
CREATE POLICY "knowledge_documents tenant update" ON public.knowledge_documents
  FOR UPDATE TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "knowledge_documents tenant delete" ON public.knowledge_documents;
CREATE POLICY "knowledge_documents tenant delete" ON public.knowledge_documents
  FOR DELETE TO authenticated USING (public.user_has_company_access(company_id));

-- knowledge_chunks
DROP POLICY IF EXISTS "knowledge_chunks tenant read" ON public.knowledge_chunks;
CREATE POLICY "knowledge_chunks tenant read" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "knowledge_chunks tenant insert" ON public.knowledge_chunks;
CREATE POLICY "knowledge_chunks tenant insert" ON public.knowledge_chunks
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "knowledge_chunks tenant delete" ON public.knowledge_chunks;
CREATE POLICY "knowledge_chunks tenant delete" ON public.knowledge_chunks
  FOR DELETE TO authenticated USING (public.user_has_company_access(company_id));

-- knowledge_query_logs
DROP POLICY IF EXISTS "knowledge_query_logs tenant read" ON public.knowledge_query_logs;
CREATE POLICY "knowledge_query_logs tenant read" ON public.knowledge_query_logs
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "knowledge_query_logs tenant insert" ON public.knowledge_query_logs;
CREATE POLICY "knowledge_query_logs tenant insert" ON public.knowledge_query_logs
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));

-- nexos_event_log
DROP POLICY IF EXISTS "Users read own company events" ON public.nexos_event_log;
CREATE POLICY "Users read own company events" ON public.nexos_event_log
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Users insert own company events" ON public.nexos_event_log;
CREATE POLICY "Users insert own company events" ON public.nexos_event_log
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "Users update own company events" ON public.nexos_event_log;
CREATE POLICY "Users update own company events" ON public.nexos_event_log
  FOR UPDATE TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

-- ------------------------------------------------------------
-- 3. accept_company_invite: vinculo ANTES da empresa ativa
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_company_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.company_invites%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_invite
    FROM public.company_invites
   WHERE token = _token
   FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Convite não está mais disponível.';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.company_invites
       SET status = 'expired', updated_at = now()
     WHERE id = v_invite.id;
    RAISE EXCEPTION 'Convite expirado.';
  END IF;

  IF lower(v_invite.email) <> v_user_email THEN
    RAISE EXCEPTION 'Este convite é para %. Entre com essa conta para aceitar.', v_invite.email;
  END IF;

  -- O vínculo precisa existir ANTES de definir a empresa ativa,
  -- porque profiles.current_company_id agora exige vínculo real.
  INSERT INTO public.user_roles (user_id, company_id, role_id)
  VALUES (v_user_id, v_invite.company_id, v_invite.role_id)
  ON CONFLICT (user_id, company_id, role_id) DO NOTHING;

  INSERT INTO public.profiles (id, current_company_id)
  VALUES (v_user_id, v_invite.company_id)
  ON CONFLICT (id) DO UPDATE
    SET current_company_id = EXCLUDED.current_company_id,
        updated_at = now();

  UPDATE public.company_invites
     SET status = 'accepted',
         accepted_at = now(),
         accepted_by = v_user_id,
         updated_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'companyId', v_invite.company_id);
END;
$function$;

-- ------------------------------------------------------------
-- 4. SECURITY DEFINER: validacao de caller
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _company_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- Um usuário autenticado só pode consultar as próprias permissões.
    (auth.uid() IS NULL OR _user_id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.companies
        WHERE id = _company_id AND owner_id = _user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = _user_id
          AND ur.company_id = _company_id
          AND p.code = _permission_code
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.company_rbt12(_company_id uuid, _competence date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(s.grand_total), 0)::numeric
    FROM public.sales s
   WHERE s.company_id = _company_id
     AND (auth.uid() IS NULL OR public.user_has_company_access(_company_id))
     AND COALESCE(s.is_test, false) = false
     AND s.status <> 'cancelled'
     AND s.sale_date >= (date_trunc('month', _competence) - interval '12 months')::date
     AND s.sale_date <  date_trunc('month', _competence)::date;
$function$;

CREATE OR REPLACE FUNCTION public.company_monthly_revenue(_company_id uuid, _competence date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(s.grand_total), 0)::numeric
    FROM public.sales s
   WHERE s.company_id = _company_id
     AND (auth.uid() IS NULL OR public.user_has_company_access(_company_id))
     AND COALESCE(s.is_test, false) = false
     AND s.status <> 'cancelled'
     AND s.sale_date >= date_trunc('month', _competence)::date
     AND s.sale_date <  (date_trunc('month', _competence) + interval '1 month')::date;
$function$;

CREATE OR REPLACE FUNCTION public.company_timezone(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(NULLIF(TRIM(timezone), ''), 'America/Sao_Paulo')
    FROM public.companies
   WHERE id = _company_id
     AND (auth.uid() IS NULL OR public.user_has_company_access(_company_id))
$function$;

CREATE OR REPLACE FUNCTION public.accounting_account_id(_company_id uuid, _code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Empresa nao vinculada ao usuario.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO _id FROM public.accounting_accounts
   WHERE company_id = _company_id AND code = _code;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.credit_resolve_account(_company_id uuid, _method text, _account_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_method text := lower(coalesce(_method, 'cash'));
  v_is_cash boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Empresa nao vinculada ao usuario.' USING ERRCODE = '42501';
  END IF;

  IF _account_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.financial_accounts
     WHERE id = _account_id AND company_id = _company_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Conta de destino inválida.'; END IF;
    RETURN v_id;
  END IF;

  v_is_cash := v_method IN ('cash', 'dinheiro', 'especie', 'espécie');

  IF NOT v_is_cash THEN
    SELECT id INTO v_id FROM public.financial_accounts
     WHERE company_id = _company_id AND status = 'active' AND type <> 'cash'
     ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.financial_accounts
     WHERE company_id = _company_id AND status = 'active'
     ORDER BY (type = 'cash') DESC, created_at ASC LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'CONTA_FINANCEIRA_AUSENTE: cadastre uma conta financeira ativa antes de registrar recebimentos.';
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_product_sku(_company_id uuid, _name text, _category_name text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_generic    text[] := ARRAY['bolsa','bolsas','carteira','carteiras','mochila','mochilas','mala','malas','necessaire','necessaires','acessorio','acessorios','clutch','clutches','pasta','pastas','pochete','pochetes','nova','novo','kit'];
  v_connectors text[] := ARRAY['de','da','do','das','dos','e','com','para','por','a','o','as','os','-','–'];
  v_words      text[];
  v_key        text;
  v_cat_key    text;
  v_cat_prefix text;
  v_model      text := '';
  v_color      text := '';
  v_base       text;
  v_start      int := 1;
  v_i          int;
  v_model_idx  int := 0;
  v_next_seq   int;
  v_pattern    text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Empresa nao vinculada ao usuario.' USING ERRCODE = '42501';
  END IF;

  IF _name IS NULL OR TRIM(_name) = '' THEN
    RETURN NULL;
  END IF;

  v_words := regexp_split_to_array(TRIM(_name), '\s+');
  IF v_words IS NULL OR array_length(v_words,1) IS NULL THEN
    RETURN NULL;
  END IF;

  -- Prefixo categoria
  IF _category_name IS NOT NULL AND TRIM(_category_name) <> '' THEN
    v_cat_key    := lower(public._sku_strip_accents(TRIM(_category_name)));
    v_cat_prefix := public._sku_prefix_for(_category_name);
  ELSE
    v_cat_key    := NULL;
    v_cat_prefix := public._sku_prefix_for(v_words[1]);
    v_start := 2;
  END IF;

  -- Modelo: primeira palavra "relevante"
  v_i := v_start;
  WHILE v_i <= array_length(v_words,1) LOOP
    v_key := lower(public._sku_strip_accents(v_words[v_i]));
    IF v_key <> ''
       AND NOT (v_key = ANY(v_connectors))
       AND NOT (v_key = ANY(v_generic))
       AND (v_cat_key IS NULL OR v_key <> v_cat_key)
       AND v_key ~ '[a-z0-9]'
    THEN
      v_model_idx := v_i;
      v_model     := public._sku_first3(v_words[v_i]);
      EXIT;
    END IF;
    v_i := v_i + 1;
  END LOOP;

  IF v_model_idx = 0 THEN
    -- fallback: primeiro token alfanumérico
    v_i := 1;
    WHILE v_i <= array_length(v_words,1) LOOP
      IF v_words[v_i] ~ '[A-Za-z0-9]' THEN
        v_model := public._sku_first3(v_words[v_i]);
        EXIT;
      END IF;
      v_i := v_i + 1;
    END LOOP;
  ELSE
    -- Cor: última palavra alfanumérica depois do modelo
    v_i := array_length(v_words,1);
    WHILE v_i > v_model_idx LOOP
      v_key := lower(public._sku_strip_accents(v_words[v_i]));
      IF v_key <> '' AND NOT (v_key = ANY(v_connectors)) AND v_key ~ '[a-z0-9]' THEN
        v_color := public._sku_first3(v_words[v_i]);
        EXIT;
      END IF;
      v_i := v_i - 1;
    END LOOP;
  END IF;

  v_base := array_to_string(
    ARRAY(
      SELECT x FROM unnest(ARRAY[v_cat_prefix, v_model, v_color]) x
      WHERE x IS NOT NULL AND x <> ''
    ),
    '-'
  );

  IF v_base IS NULL OR v_base = '' THEN
    RETURN NULL;
  END IF;

  -- Sequencial dentro da mesma empresa/base
  v_pattern := '^' || regexp_replace(v_base, '([\\.^$*+?()\[\]{}|])', '\\\1', 'g') || '-(\d+)$';

  SELECT COALESCE(MAX((m[1])::int), 0) + 1
    INTO v_next_seq
  FROM public.products p,
       LATERAL regexp_match(p.sku, v_pattern) AS m
  WHERE p.company_id = _company_id
    AND p.sku ~* v_pattern;

  RETURN v_base || '-' || lpad(v_next_seq::text, 3, '0');
END;
$function$;

-- ------------------------------------------------------------
-- 5. EXECUTE: remover superficie anonima / administrativa
-- ------------------------------------------------------------

-- Nunca devem ser chamaveis por anon (mantem authenticated + service_role)
REVOKE EXECUTE ON FUNCTION public.company_rbt12(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_monthly_revenue(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_today(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_month_start(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_product_sku(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_company_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accounting_balances(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.financial_kpis(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_dre(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_balance_sheet(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_executive_summary(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_tax_apportionment(uuid, date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_tax_scenarios(uuid, date, numeric[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inventory_ledger_audit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.products_inventory_metrics(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sales_status_breakdown(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_inventory_opening(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_security_audit(uuid, text, text, text, text, jsonb, jsonb, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accounting_post_sale(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_sale(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_sale_receivable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reverse_sale_finance(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_settlement_data(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_platform_health(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) FROM PUBLIC, anon;

-- Administrativas / integracao: apenas o servidor (service_role)
REVOKE EXECUTE ON FUNCTION public.accounting_account_id(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accounting_seed_chart(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accounting_backfill(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accounting_post_entry(uuid, date, text, text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accounting_reverse_origin(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_resolve_account(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fiscal_allocate_nfe_number(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fiscal_release_nfe_number(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bella_pay_record_webhook_event(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bella_pay_apply_webhook_result(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bella_pay_resolve_webhook_token(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accounting_account_id(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.accounting_seed_chart(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_resolve_account(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_allocate_nfe_number(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_release_nfe_number(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bella_pay_record_webhook_event(uuid, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bella_pay_apply_webhook_result(uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bella_pay_resolve_webhook_token(text) TO service_role;