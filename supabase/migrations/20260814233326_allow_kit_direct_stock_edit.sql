-- FIX — gatilho de proteção de estoque bloqueava também produtos-kit.
--
-- Achado (auditoria de 2026-08-14): trg_guard_product_stock_engine
-- bloqueia QUALQUER alteração direta de "stock" na tabela products,
-- exigindo que passe por inventory_movements — correto para produtos
-- simples (protege o histórico de estoque real). Mas produtos do tipo
-- "kit" não têm estoque físico próprio: o valor é sempre calculado
-- (gargalo dos componentes, com reserva opcional) e precisa ser gravado
-- diretamente ao salvar o kit — não existe (nem faz sentido existir) um
-- inventory_movement para "kit".
--
-- Sem esta exceção, o formulário de produto tinha que APAGAR o campo
-- "stock" do payload antes de salvar qualquer edição (pra não disparar
-- esse erro) — o que também apagava, sem querer, o valor correto
-- calculado a partir da reserva do usuário. Resultado: definir uma
-- reserva (ex.: "reservar até 2 capinhas") mudava a pré-visualização na
-- tela corretamente, mas nunca era realmente salvo no banco.

CREATE OR REPLACE FUNCTION public.guard_product_stock_engine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock
     AND NEW.product_type IS DISTINCT FROM 'kit'
     AND COALESCE(current_setting('nexos.inventory_engine', true), 'off') <> 'on' THEN
    RAISE EXCEPTION
      'Alteração direta de estoque não permitida para "%". O saldo só pode ser alterado por movimentação de estoque (inventory_movements).',
      COALESCE(NEW.name, NEW.id::text)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
