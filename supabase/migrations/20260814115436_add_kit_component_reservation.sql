-- FEATURE — Reserva de componente por kit (variantes de kit compartilhando
-- estoque de um mesmo componente).
--
-- Caso de uso real: o usuário tem 5 unidades de "Capinha A15" e monta DOIS
-- kits diferentes com ela — "Kit Comum" (capinha + película comum + cabo) e
-- "Kit Privacidade" (capinha + película privacidade + cabo). Antes, os dois
-- kits mostravam sempre o mesmo número (o total de capinha disponível),
-- porque o cálculo de estoque de kit não sabia que dois kits diferentes
-- disputam o mesmo componente. Isso deixava a tela de produtos confusa
-- (os dois mostrando "5 UN", parecendo 10 possíveis no total).
--
-- `reserved_quantity`: quando definido, é o teto de quantas unidades DESTE
-- componente o usuário decidiu reservar para ESTE kit especificamente
-- (ex.: 3 capinhas para o Kit Comum, 2 para o Kit Privacidade). Quando NULL
-- (padrão), o comportamento não muda — o kit continua usando o estoque
-- total do componente, como sempre funcionou.
--
-- Importante: isto NÃO substitui a trava real contra vender além do
-- estoque físico (isso continua garantido pelo gatilho de baixa de estoque
-- já existente, que sempre olha o saldo real do componente). A reserva é
-- só um teto de PLANEJAMENTO em cima disso — nunca deixa vender mais do
-- que existe fisicamente, com ou sem reserva configurada.

ALTER TABLE public.product_kit_components
  ADD COLUMN IF NOT EXISTS reserved_quantity integer;

COMMENT ON COLUMN public.product_kit_components.reserved_quantity IS
  'Teto opcional de quantas unidades deste componente estão reservadas para este kit específico. NULL = usa o estoque total do componente (comportamento padrão, sem reserva).';
