-- Fotos de produto com link público e cacheável (27/10/2026).
-- O egress do plano gratuito estourou: as telas usavam links assinados
-- (não ficam em cache) e baixavam a foto original. Fotos de produto já
-- aparecem no catálogo público; com o bucket público, cada foto é baixada
-- uma vez e reaproveitada pelo cache. Envio/troca/exclusão continuam só
-- para a própria empresa (políticas de storage existentes).
UPDATE storage.buckets SET public = true WHERE id = 'product-images';
