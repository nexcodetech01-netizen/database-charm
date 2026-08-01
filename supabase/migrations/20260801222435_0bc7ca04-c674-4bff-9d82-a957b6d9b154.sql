CREATE OR REPLACE FUNCTION public.merge_duplicate_products(_company_id uuid, _dry_run boolean DEFAULT true, _delete_unused boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  grp record;
  dup record;
  v_groups int := 0;
  v_merged int := 0;
  v_moved numeric := 0;
  v_deleted int := 0;
  v_inactivated int := 0;
  v_used boolean;
  v_report jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada.';
  END IF;

  FOR grp IN SELECT * FROM public.preview_duplicate_products(_company_id) LOOP
    v_groups := v_groups + 1;
    v_report := v_report || jsonb_build_object(
      'name_key', grp.name_key,
      'keeper_id', grp.keeper_id,
      'keeper_name', grp.keeper_name,
      'duplicates', grp.duplicates,
      'merged_stock', grp.merged_stock
    );

    IF _dry_run THEN
      CONTINUE;
    END IF;

    FOR dup IN
      SELECT (d->>'id')::uuid AS id, coalesce((d->>'stock')::numeric, 0) AS stock
      FROM jsonb_array_elements(grp.duplicates) d
    LOOP
      IF dup.stock <> 0 THEN
        INSERT INTO public.inventory_movements
          (company_id, product_id, type, quantity, reason, notes, source, reference_id, user_id)
        VALUES
          (_company_id, dup.id, 'out', abs(dup.stock),
           'Mesclagem de produtos duplicados',
           'product_merge: saída para produto ' || grp.keeper_id,
           'adjustment', grp.keeper_id, auth.uid()),
          (_company_id, grp.keeper_id, 'in', abs(dup.stock),
           'Mesclagem de produtos duplicados',
           'product_merge: entrada vinda do produto ' || dup.id,
           'adjustment', dup.id, auth.uid());
        v_moved := v_moved + abs(dup.stock);
      END IF;

      UPDATE public.sale_items SET product_id = grp.keeper_id WHERE product_id = dup.id;
      UPDATE public.purchase_items SET product_id = grp.keeper_id WHERE product_id = dup.id;
      UPDATE public.sale_return_items SET product_id = grp.keeper_id WHERE product_id = dup.id;
      UPDATE public.product_interests SET product_id = grp.keeper_id WHERE product_id = dup.id;
      UPDATE public.product_images SET product_id = grp.keeper_id WHERE product_id = dup.id;
      DELETE FROM public.product_collection_items pci
        WHERE pci.product_id = dup.id
          AND EXISTS (
            SELECT 1 FROM public.product_collection_items x
            WHERE x.collection_id = pci.collection_id AND x.product_id = grp.keeper_id
          );
      UPDATE public.product_collection_items SET product_id = grp.keeper_id WHERE product_id = dup.id;

      SELECT EXISTS (SELECT 1 FROM public.inventory_movements m WHERE m.product_id = dup.id)
        INTO v_used;

      IF _delete_unused AND NOT v_used THEN
        DELETE FROM public.products WHERE id = dup.id AND company_id = _company_id;
        v_deleted := v_deleted + 1;
      ELSE
        UPDATE public.products
           SET status = 'inactive',
               sku = CASE WHEN sku IS NULL THEN NULL ELSE sku || '-MERGED' END,
               description = coalesce(description || E'\n', '')
                 || '[Mesclado em ' || now()::date || ' no produto ' || grp.keeper_id || ']',
               updated_at = now()
         WHERE id = dup.id AND company_id = _company_id;
        v_inactivated := v_inactivated + 1;
      END IF;

      v_merged := v_merged + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'groups', v_groups,
    'duplicates_merged', v_merged,
    'stock_moved', v_moved,
    'inactivated', v_inactivated,
    'deleted', v_deleted,
    'details', v_report
  );
END;
$function$;