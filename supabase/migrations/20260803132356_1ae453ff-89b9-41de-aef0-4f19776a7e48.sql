-- Migração para automatizar a criação de Contas a Receber em vendas sem pagamento imediato.
-- SPRINT: Eliminar o "limbo" entre venda entregue e pagamento recebido.

-- 1) Garante que vendas sem pagamento imediato (payment_method = null ou 'a_receber')
--    disparem a criação do título no Contas a Receber automaticamente.
CREATE OR REPLACE FUNCTION public.trg_auto_ensure_sale_receivable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se a venda passou para 'pending' ou 'paid' e não tem pagamento imediato definido,
  -- ou se é explicitamente 'a_receber' (crediário/limbo).
  IF NEW.status IN ('pending', 'paid') AND (NEW.payment_method IS NULL OR NEW.payment_method = 'a_receber') THEN
    -- A função ensure_sale_receivable já é idempotente e trata permissões e bloqueios.
    PERFORM public.ensure_sale_receivable(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Remove triggers antigos se existirem para evitar conflitos (limpeza de nomes genéricos)
DROP TRIGGER IF EXISTS trg_auto_ensure_sale_receivable ON public.sales;

CREATE TRIGGER trg_auto_ensure_sale_receivable
AFTER INSERT OR UPDATE OF status, payment_method ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_ensure_sale_receivable();
