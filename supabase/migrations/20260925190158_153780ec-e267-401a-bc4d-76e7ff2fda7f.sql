UPDATE public.products
SET barcode = 'SEM GTIN'
WHERE barcode IS NOT NULL
  AND upper(regexp_replace(translate(btrim(barcode), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'), '[[:space:]]+', ' ', 'g')) IN ('ISENTO', 'SEM CODIGO', 'SEM EAN', 'SEM GTIN', 'N/A', 'NA', '0')
  AND barcode <> 'SEM GTIN';