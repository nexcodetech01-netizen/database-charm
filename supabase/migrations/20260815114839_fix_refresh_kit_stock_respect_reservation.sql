-- FIX — causa raiz DEFINITIVA do "reserva não persiste".
--
-- Achado (auditoria de 2026-08-14/15, via log de diagnóstico no
-- navegador): existe um sistema de recálculo automático de estoque de
-- kit (refresh_kit_stock + trg_kit_composition_change +
-- trg_kit_component_inventory_change, migration
-- 20260813233729_cffc44ff-fa04-41f3-9204-a0948db1235c.sql) que dispara
-- toda vez que a composição do kit muda ou que o estoque de um
-- componente muda em qualquer lugar do sistema.
--
-- Esse recálculo é executado por um gatilho em product_kit_components,
-- que dispara a CADA linha inserida durante o salvamento do kit — ou
-- seja, roda DEPOIS do formulário já ter gravado o estoque correto
-- (com reserva) em products.stock, e SOBRESCREVE esse valor com o
-- cálculo antigo do gargalo puro, sem considerar reserved_quantity.
-- Por isso o valor calculado no navegador (2) sempre aparecia certo na
-- tela e no log de diagnóstico, mas o valor salvo no banco continuava
-- sendo o antigo (5) — mesmo depois da correção anterior que permitiu
-- gravar o estoque do kit diretamente.
--
-- Este gatilho automático é, na verdade, uma boa ideia (mantém o
-- estoque do kit sincronizado em tempo real, inclusive quando o
-- estoque de um componente muda em QUALQUER lugar do sistema, não só
-- ao editar o kit) — só precisava saber da reserva. Corrigido para
-- respeitar reserved_quantity por componente, com a mesma regra usada
-- no cálculo do formulário: cada componente contribui com o MENOR
-- entre seu estoque físico proporcional e sua reserva restante
-- (reserva - unidades já vendidas deste kit específico).

CREATE OR REPLACE FUNCTION public.refresh_kit_stock(p_parent_id UUID)
RETURNS VOID AS $$
DECLARE
    v_new_stock INTEGER;
    v_units_sold INTEGER;
BEGIN
    -- Habilita o bypass da trava de estoque para esta transação.
    PERFORM set_config('nexos.inventory_engine', 'on', true);

    -- Unidades já vendidas DESTE kit (mesma regra do cálculo no
    -- navegador) — descontadas da reserva de cada componente, pra o
    -- número não ficar desatualizado sozinho após vendas.
    SELECT COALESCE(SUM(si.quantity), 0)::INTEGER
    INTO v_units_sold
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.product_id = p_parent_id
      AND s.status IN ('paid', 'partially_paid');

    -- Gargalo respeitando reserva: cada componente contribui com o
    -- MENOR entre o estoque físico proporcional e a reserva restante.
    -- Sem reserva definida (NULL), usa só o estoque físico — igual
    -- sempre funcionou.
    SELECT COALESCE(MIN(
      CASE
        WHEN pkc.reserved_quantity IS NULL THEN FLOOR(p.stock / pkc.quantity)
        ELSE LEAST(
          FLOOR(p.stock / pkc.quantity),
          GREATEST(0, pkc.reserved_quantity - v_units_sold)
        )
      END
    ), 0)::INTEGER
    INTO v_new_stock
    FROM public.product_kit_components pkc
    JOIN public.products p ON p.id = pkc.component_id
    WHERE pkc.parent_id = p_parent_id;

    UPDATE public.products
    SET stock = v_new_stock,
        updated_at = now()
    WHERE id = p_parent_id AND product_type = 'kit';

    PERFORM set_config('nexos.inventory_engine', 'off', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
