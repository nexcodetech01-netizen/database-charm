-- BUG ATIVO ENCONTRADO E CORRIGIDO (2026-08-27): mesmo buraco que já
-- foi corrigido no ESTOQUE hoje mais cedo (checkout abandonado faz a
-- venda voltar de 'paid'/'pending' pra 'draft' — não é bem um
-- "cancelamento" formal, mas o efeito é o mesmo: a venda deixa de ser
-- uma venda de verdade). O gatilho de estoque já foi generalizado pra
-- cobrir "qualquer saída de paid", mas o gatilho do FINANCEIRO
-- (`a_cancel_sale_finance_on_cancel`) continuava só disparando na
-- transição pra 'cancelled' — não pra 'draft'.
--
-- Resultado: um lançamento financeiro "pendente" ficava preso pra
-- sempre, referenciando uma venda que virou rascunho (não é mais uma
-- venda real) — aparecendo em "A Receber" sem ter mais um pedido de
-- verdade por trás. Achado com dado real: PDV-20260827-170352 (a
-- mesma venda do bug do estoque já corrigido).
--
-- Corrigido: o gatilho agora também dispara quando a venda volta pra
-- 'draft' vindo de qualquer status ativo (pending, partially_paid,
-- overdue) — mesma lógica da correção já aplicada no estoque.

DROP TRIGGER IF EXISTS a_cancel_sale_finance_on_cancel ON public.sales;
CREATE TRIGGER a_cancel_sale_finance_on_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
WHEN (
  (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  OR (NEW.status = 'draft' AND OLD.status NOT IN ('draft', 'cancelled'))
)
EXECUTE FUNCTION public.cancel_sale_finance_on_cancel();

-- Corrige na hora o caso já encontrado (venda que já voltou pra
-- draft antes dessa correção existir, deixada com o financeiro
-- pendente e solto).
UPDATE public.financial_transactions
   SET status = 'refunded',
       notes = btrim(COALESCE(notes || E'\n', '') ||
         format('[correção %s] venda voltou pra rascunho (checkout abandonado) — lançamento cancelado.', to_char(now(), 'YYYY-MM-DD HH24:MI'))),
       updated_at = now()
 WHERE id = '8b56d35a-0eb4-43c7-9ef1-466dcdc13fdc'
   AND status = 'pending';
