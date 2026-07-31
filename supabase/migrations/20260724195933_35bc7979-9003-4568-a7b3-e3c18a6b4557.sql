
-- ============================================================
-- Helpers de normalização (idempotentes)
-- ============================================================
CREATE OR REPLACE FUNCTION public._sku_strip_accents(t text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    COALESCE($1,''),
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
  );
$$;

CREATE OR REPLACE FUNCTION public._sku_first3(t text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT substring(
    regexp_replace(upper(public._sku_strip_accents($1)), '[^A-Z0-9]', '', 'g'),
    1, 3
  );
$$;

CREATE OR REPLACE FUNCTION public._sku_prefix_for(word text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(public._sku_strip_accents($1))
    WHEN 'bolsa'      THEN 'BOL'
    WHEN 'bolsas'     THEN 'BOL'
    WHEN 'carteira'   THEN 'CAR'
    WHEN 'carteiras'  THEN 'CAR'
    WHEN 'mochila'    THEN 'MOC'
    WHEN 'mochilas'   THEN 'MOC'
    WHEN 'acessorio'  THEN 'ACS'
    WHEN 'acessorios' THEN 'ACS'
    ELSE public._sku_first3($1)
  END;
$$;

-- ============================================================
-- Gerador único de SKU (espelha src/features/products/lib/sku-generator.ts)
-- Formato: CATEGORIA-MODELO-COR-### (sequencial por empresa+base)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_product_sku(
  _company_id uuid,
  _name text,
  _category_name text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.generate_product_sku(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_product_sku(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_product_sku(uuid, text, text) TO service_role;

-- ============================================================
-- receive_purchase — usa gerador único
-- ============================================================
CREATE OR REPLACE FUNCTION public.receive_purchase(_purchase_id uuid)
RETURNS public.purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item RECORD;
  v_new_product_id uuid;
  v_sku text;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % não encontrada.', _purchase_id;
  END IF;
  IF NOT public.user_has_company_access(v_purchase.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para receber esta compra.' USING ERRCODE = '42501';
  END IF;
  IF v_purchase.status = 'received' THEN
    RETURN v_purchase;
  END IF;
  IF v_purchase.status = 'cancelled' THEN
    RAISE EXCEPTION 'Compra cancelada não pode ser recebida.';
  END IF;

  FOR v_item IN
    SELECT id, description, unit_price
      FROM public.purchase_items
     WHERE purchase_id = _purchase_id
       AND product_id IS NULL
       AND COALESCE(TRIM(description), '') <> ''
  LOOP
    v_sku := public.generate_product_sku(v_purchase.company_id, v_item.description, NULL);
    IF v_sku IS NULL OR v_sku = '' THEN
      RAISE EXCEPTION 'Falha ao gerar SKU para item "%".', v_item.description;
    END IF;

    INSERT INTO public.products (
      company_id, name, sku, supplier_id, cost, stock, status
    ) VALUES (
      v_purchase.company_id,
      v_item.description,
      v_sku,
      v_purchase.supplier_id,
      COALESCE(v_item.unit_price, 0),
      0,
      'active'
    )
    RETURNING id INTO v_new_product_id;

    UPDATE public.purchase_items
       SET product_id = v_new_product_id, updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.purchases
     SET status = 'received',
         received_at = COALESCE(received_at, now()),
         updated_at = now()
   WHERE id = _purchase_id
   RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid) TO service_role;

-- ============================================================
-- reprocess_received_purchase — usa gerador único
-- ============================================================
CREATE OR REPLACE FUNCTION public.reprocess_received_purchase(_purchase_id uuid)
RETURNS public.purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item RECORD;
  v_new_product_id uuid;
  v_sku text;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % não encontrada.', _purchase_id;
  END IF;
  IF NOT public.user_has_company_access(v_purchase.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para reprocessar esta compra.' USING ERRCODE = '42501';
  END IF;
  IF v_purchase.status <> 'received' THEN
    RAISE EXCEPTION 'Somente compras recebidas podem ser reprocessadas.';
  END IF;
  IF COALESCE(v_purchase.stock_applied, false) = true THEN
    RETURN v_purchase;
  END IF;

  FOR v_item IN
    SELECT id, description, unit_price
      FROM public.purchase_items
     WHERE purchase_id = _purchase_id
       AND product_id IS NULL
       AND COALESCE(TRIM(description), '') <> ''
  LOOP
    v_sku := public.generate_product_sku(v_purchase.company_id, v_item.description, NULL);
    IF v_sku IS NULL OR v_sku = '' THEN
      RAISE EXCEPTION 'Falha ao gerar SKU para item "%".', v_item.description;
    END IF;

    INSERT INTO public.products (
      company_id, name, sku, supplier_id, cost, stock, status
    ) VALUES (
      v_purchase.company_id,
      v_item.description,
      v_sku,
      v_purchase.supplier_id,
      COALESCE(v_item.unit_price, 0),
      0,
      'active'
    )
    RETURNING id INTO v_new_product_id;

    UPDATE public.purchase_items
       SET product_id = v_new_product_id, updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.purchases SET status = 'pending' WHERE id = _purchase_id;
  UPDATE public.purchases
     SET status = 'received',
         received_at = COALESCE(received_at, now()),
         updated_at = now()
   WHERE id = _purchase_id
   RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$$;

REVOKE ALL ON FUNCTION public.reprocess_received_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO service_role;
