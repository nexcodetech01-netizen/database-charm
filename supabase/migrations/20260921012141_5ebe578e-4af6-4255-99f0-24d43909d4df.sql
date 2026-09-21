-- Mesma classe de corrida que já corrigimos no SKU (migration
-- 20260920115407_148bd7a7-...): a checagem de duplicata do código de
-- barras (findDuplicateProduct) e a criação do produto são dois passos
-- separados, sem nenhuma trava no banco. Duas importações/criações quase
-- simultâneas com o mesmo código de barras passam pela checagem sem ver
-- uma a outra, e os dois produtos duplicados acabam salvos.
--
-- Janela mais estreita que a do SKU (precisa de duas coisas acontecendo ao
-- mesmo tempo), mas mesma causa raiz: falta uma trava de unicidade real.

-- 1) Limpa colisões existentes ANTES de criar o índice único. Diferente do
--    SKU (onde dava pra inventar um sufixo "-DUP2" sem problema, já que é
--    um código interno gerado por nós), o código de barras é um dado do
--    mundo real usado pra escanear o produto (EAN lookup, leitor no PDV,
--    conferência de recebimento) — fabricar um valor tipo "789...-DUP2"
--    criaria um código que nunca vai bater com nenhum scanner de verdade.
--    Por isso, em vez de sufixar, zeramos o campo nas linhas duplicadas
--    mais recentes (mantemos o código só na ocorrência mais antiga) — fica
--    sinalizado como "precisa conferir/rescanear" em vez de um valor
--    inventado.
UPDATE public.products p
   SET barcode = NULL,
       updated_at = now()
  FROM (
    SELECT id
      FROM (
        SELECT id,
               row_number() OVER (
                 PARTITION BY company_id, barcode
                 ORDER BY created_at NULLS LAST, id
               ) AS occurrence
          FROM public.products
         WHERE barcode IS NOT NULL
           AND btrim(barcode) <> ''
           AND btrim(barcode) <> 'SEM GTIN'
      ) ranked
     WHERE occurrence > 1
  ) dup
 WHERE p.id = dup.id;

-- 2) Índice único parcial por empresa — exclui NULL, vazio e o placeholder
--    "SEM GTIN" usado em todo o app quando não há código de barras real.
CREATE UNIQUE INDEX products_company_barcode_unique_idx
  ON public.products (company_id, barcode)
  WHERE barcode IS NOT NULL
    AND btrim(barcode) <> ''
    AND btrim(barcode) <> 'SEM GTIN';