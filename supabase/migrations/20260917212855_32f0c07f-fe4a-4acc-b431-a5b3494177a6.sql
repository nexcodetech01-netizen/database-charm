CREATE OR REPLACE FUNCTION public.prevent_duplicate_category_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing text;
  _new_name_key text;
BEGIN
  _new_name_key := public.category_name_key(NEW.name);

  IF _new_name_key = '' THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO _existing
  FROM public.product_categories c
  WHERE c.company_id = NEW.company_id
    AND c.id <> NEW.id
    AND public.category_name_key(c.name) = _new_name_key
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe a categoria "%" equivalente a "%". Utilize a categoria existente.', _existing, NEW.name
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;