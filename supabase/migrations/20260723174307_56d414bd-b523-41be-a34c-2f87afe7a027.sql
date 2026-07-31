
DO $$
DECLARE
  r RECORD;
  cat_name TEXT;
  cat_id UUID;
  n TEXT;
BEGIN
  FOR r IN
    SELECT id, company_id,
           lower(translate(coalesce(name,'') || ' ' || coalesce(description,''),
             'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
             'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) AS hay
    FROM public.products
    WHERE category_id IS NULL
  LOOP
    n := r.hay;
    cat_name := CASE
      WHEN n ~ '\ymochila\y' OR n ~ '\ybackpack\y' THEN 'Mochila'
      WHEN n ~ '\ycarteira\y' OR n ~ '\ywallet\y' OR n ~ 'porta[- ]cart' THEN 'Carteira'
      WHEN n ~ '\ynecessaire\y' THEN 'Necessaire'
      WHEN n ~ '\yclutch\y' THEN 'Clutch'
      WHEN n ~ '\ypochete\y' OR n ~ '\yfanny\y' THEN 'Pochete'
      WHEN n ~ '\ybaguete\y' THEN 'Bolsa Baguete'
      WHEN n ~ '\ytote\y' THEN 'Bolsa Tote'
      WHEN n ~ '\yhobo\y' THEN 'Bolsa Hobo'
      WHEN n ~ '\ysacola\y' OR n ~ '\yshopper\y' THEN 'Bolsa Sacola'
      WHEN n ~ '\ytransversal\y' OR n ~ '\ycrossbody\y' OR n ~ '\ytiracolo\y' THEN 'Bolsa Transversal'
      WHEN n ~ '\yshoulder\y' THEN 'Bolsa Shoulder'
      WHEN n ~ '\ybau\y' THEN 'Bolsa Baú'
      WHEN n ~ '\ysocial\y' THEN 'Bolsa Social'
      WHEN n ~ '\ybolsa\y' OR n ~ '\ybag\y' THEN 'Bolsa'
      WHEN n ~ '\yrelogio\y' OR n ~ '\ywatch\y' THEN 'Relógio'
      WHEN n ~ '\ycinto\y' OR n ~ '\ybelt\y' THEN 'Cinto'
      WHEN n ~ '\yoculos\y' OR n ~ '\ysunglasses\y' THEN 'Óculos'
      WHEN n ~ '\ychaveiro\y' THEN 'Chaveiro'
      WHEN n ~ '\ysapato\y' OR n ~ '\ytenis\y' OR n ~ '\ysandalia\y' OR n ~ '\ysapatilha\y' OR n ~ '\ychinelo\y' THEN 'Sapato'
      WHEN n ~ '\ypulseira\y' OR n ~ '\ycolar\y' OR n ~ '\ybrinco\y' OR n ~ '\yanel\y' OR n ~ '\yacessorio\y' THEN 'Acessório'
      ELSE NULL
    END;

    IF cat_name IS NULL THEN CONTINUE; END IF;

    SELECT id INTO cat_id
    FROM public.product_categories
    WHERE company_id = r.company_id AND lower(name) = lower(cat_name)
    LIMIT 1;

    IF cat_id IS NULL THEN
      INSERT INTO public.product_categories (company_id, name)
      VALUES (r.company_id, cat_name)
      RETURNING id INTO cat_id;
    END IF;

    UPDATE public.products SET category_id = cat_id WHERE id = r.id;
  END LOOP;
END $$;
