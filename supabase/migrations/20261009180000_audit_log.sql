-- =====================================================================
-- Histórico de alterações (09/10/2026)
--
-- Toda criação, alteração e exclusão em financeiro, vendas, compras,
-- caixa, crediário e estoque fica gravada: quem, quando, por onde (app,
-- servidor/Bella/WhatsApp ou direto no banco) e o que mudou (antes →
-- depois). Só leitura para a dona (permissão audit.view; o dono da
-- empresa sempre tem). Ninguém consegue editar ou apagar o histórico
-- pelo app.
--
-- O registro nunca bloqueia a operação: se falhar, só gera aviso no log.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL,
  table_name  text NOT NULL,
  record_id   uuid,
  parent_table text,
  parent_id   uuid,
  action      text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  actor_id    uuid,
  actor_name  text,
  via         text NOT NULL,
  label       text,
  changes     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_company_time ON public.audit_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_parent ON public.audit_log (parent_table, parent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (company_id, actor_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM PUBLIC, anon, authenticated;

INSERT INTO public.permissions (code, module, action, description)
VALUES ('audit.view', 'audit', 'view', 'Ver o histórico de alterações')
ON CONFLICT (code) DO NOTHING;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), company_id, 'audit.view'));

-- ---------------------------------------------------------------------
-- Gatilho genérico
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_row jsonb;
  v_ignore text[] := ARRAY['updated_at', 'created_at'] || coalesce(TG_ARGV::text[], '{}');
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_company uuid;
  v_parent_table text;
  v_parent_id uuid;
  v_actor uuid := auth.uid();
  v_role text;
  v_via text;
  v_label text;
BEGIN
  v_row := coalesce(v_new, v_old);

  IF TG_OP = 'UPDATE' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN v_key = ANY (v_ignore);
      IF (v_new -> v_key) IS DISTINCT FROM (v_old -> v_key) THEN
        v_changes := v_changes || jsonb_build_object(v_key,
                       jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN
      RETURN NULL; -- só mudou campo técnico
    END IF;
  ELSE
    v_changes := v_row - v_ignore;
    -- tira campos vazios do retrato para ficar legível
    v_changes := coalesce((SELECT jsonb_object_agg(k, v) FROM jsonb_each(v_changes) e(k, v)
                            WHERE v <> 'null'::jsonb AND v <> '""'::jsonb), '{}'::jsonb);
  END IF;

  BEGIN
    -- Empresa e "pai" (para mostrar o histórico junto: venda + itens + financeiro)
    v_company := nullif(v_row ->> 'company_id', '')::uuid;
    CASE TG_TABLE_NAME
      WHEN 'sale_items' THEN
        v_parent_table := 'sales'; v_parent_id := (v_row ->> 'sale_id')::uuid;
      WHEN 'purchase_items' THEN
        v_parent_table := 'purchases'; v_parent_id := (v_row ->> 'purchase_id')::uuid;
      WHEN 'inventory_movements' THEN
        v_parent_table := 'products'; v_parent_id := (v_row ->> 'product_id')::uuid;
      WHEN 'credit_accounts' THEN
        v_parent_table := 'sales'; v_parent_id := (v_row ->> 'sale_id')::uuid;
      WHEN 'cash_movements' THEN
        v_parent_table := 'cash_sessions'; v_parent_id := (v_row ->> 'session_id')::uuid;
      WHEN 'financial_transactions' THEN
        IF v_row ->> 'source' = 'sale' THEN
          v_parent_table := 'sales'; v_parent_id := (v_row ->> 'reference_id')::uuid;
        ELSIF v_row ->> 'source' = 'purchase' THEN
          v_parent_table := 'purchases'; v_parent_id := (v_row ->> 'reference_id')::uuid;
        END IF;
      ELSE NULL;
    END CASE;
    IF v_company IS NULL AND v_parent_table = 'sales' THEN
      SELECT company_id INTO v_company FROM public.sales WHERE id = v_parent_id;
    ELSIF v_company IS NULL AND v_parent_table = 'purchases' THEN
      SELECT company_id INTO v_company FROM public.purchases WHERE id = v_parent_id;
    END IF;
    IF v_company IS NULL THEN
      RETURN NULL;
    END IF;

    -- Por onde veio: app (usuária logada), servidor (Bella, WhatsApp,
    -- webhooks, automações) ou direto no banco (SQL Editor).
    v_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
    v_via := CASE
               WHEN v_actor IS NOT NULL THEN 'app'
               WHEN v_role = 'service_role' THEN 'servidor'
               WHEN v_role IS NULL THEN 'banco'
               ELSE coalesce(v_role, 'banco')
             END;

    v_label := coalesce(v_row ->> 'number', v_row ->> 'description', v_row ->> 'name',
                        v_row ->> 'sku', v_row ->> 'reason');

    INSERT INTO public.audit_log (company_id, table_name, record_id, parent_table, parent_id,
                                  action, actor_id, actor_name, via, label, changes)
    VALUES (v_company, TG_TABLE_NAME, nullif(v_row ->> 'id', '')::uuid, v_parent_table, v_parent_id,
            lower(TG_OP), v_actor,
            (SELECT full_name FROM public.profiles WHERE id = v_actor),
            v_via, left(v_label, 200), v_changes);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'audit_row_change(%): %', TG_TABLE_NAME, SQLERRM;
  END;

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

-- Liga o histórico nas tabelas (argumentos = campos ignorados)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('financial_transactions', ''),
    ('financial_accounts', ''),
    ('financial_transfers', ''),
    ('cash_sessions', ''),
    ('cash_movements', ''),
    ('credit_accounts', ''),
    ('credit_installments', ''),
    ('credit_payments', ''),
    ('sales', ''),
    ('sale_items', '''profit_snapshot'''),
    ('purchases', ''),
    ('purchase_items', ''),
    ('inventory_movements', ''),
    ('products', '''description'',''channel_pricing_settings'',''image_url'',''cover_image_path'',''video_url'',''tags'',''ml_item_id'',''ml_permalink'',''ml_published_at'',''ml_status'',''sales_channels''')
  ) AS t(tbl, args)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS zz_audit_row_change ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER zz_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(%s)', r.tbl, r.args);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- Autor nos lançamentos automáticos (ex.: pagamento de compra criado
-- pelo sistema passa a levar o nome de quem recebeu a compra)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_transaction_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.created_by := coalesce(NEW.created_by, auth.uid());
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fill_transaction_created_by ON public.financial_transactions;
CREATE TRIGGER trg_fill_transaction_created_by
  BEFORE INSERT ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fill_transaction_created_by();

-- Quem pode ver (para o app esconder o menu)
CREATE OR REPLACE FUNCTION public.can_view_audit(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND public.has_permission(auth.uid(), _company_id, 'audit.view');
$function$;

REVOKE EXECUTE ON FUNCTION public.can_view_audit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_audit(uuid) TO authenticated;
