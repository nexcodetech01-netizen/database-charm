-- Desloca a posição de todas as fotos de um produto em +1, numa única
-- instrução, para abrir espaço para uma nova foto principal na posição 0.
-- SECURITY INVOKER: as policies de RLS do usuário continuam valendo.
-- (Não há índice único em position, então o UPDATE em bloco é seguro.)
CREATE OR REPLACE FUNCTION public.shift_product_image_positions(_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  UPDATE product_images
     SET position = COALESCE(position, 0) + 1
   WHERE product_id = _product_id;
$$;

GRANT EXECUTE ON FUNCTION public.shift_product_image_positions(uuid) TO authenticated;
