# Plano de Correção: Lógica de Estoque de Kits

O objetivo é garantir que o estoque de produtos marcados como KIT (`product_type = 'kit'`) seja sempre calculado com base no menor saldo proporcional de seus componentes (gargalo), evitando duplicações e inconsistências.

## Alterações Propostas

### 1. Backend (Supabase/PostgreSQL)
Implementar uma trigger robusta que sincronize o campo `stock` da tabela `products` sempre que houver alteração nos componentes do kit ou no estoque dos componentes individuais.

- **Trigger de Sincronização**: Criar uma função `sync_kit_stock(kit_id)` que calcula o estoque real (MIN de estoque/quantidade_no_kit) e atualiza a coluna `stock` na tabela `products`.
- **Eventos de Disparo**:
  - `AFTER INSERT OR UPDATE OR DELETE` na tabela `product_kit_components`.
  - `AFTER INSERT` na tabela `inventory_movements` (para recalcular kits que usem o produto movimentado).

### 2. Services (Frontend)
Refinar a lógica de salvamento e listagem no `products.service.ts`.

- **Limpeza de Duplicidade**: No método `update`, garantir o `DELETE` prévio de componentes para evitar acúmulo de linhas.
- **Cálculo de Exibição**: Manter a lógica de `calculateKitStock` no service como fallback/preview, mas confiar no valor persistido pelo banco para listagens.

### 3. Formulário de Produto
Ajustar o `ProductForm` para lidar corretamente com a transição entre produto simples e kit.

- **Reset de Estado**: Garantir que a troca de tipo limpe campos irrelevantes.
- **Preview de Estoque**: Exibir o cálculo em tempo real do estoque do kit enquanto o usuário edita a composição.

## Detalhes Técnicos

### SQL Migration
```sql
-- Função para calcular e atualizar o estoque de um kit específico
CREATE OR REPLACE FUNCTION public.refresh_kit_stock(p_parent_id UUID)
RETURNS VOID AS $$
DECLARE
    v_new_stock INTEGER;
BEGIN
    SELECT COALESCE(MIN(FLOOR(p.stock / pkc.quantity)), 0)::INTEGER
    INTO v_new_stock
    FROM public.product_kit_components pkc
    JOIN public.products p ON p.id = pkc.component_id
    WHERE pkc.parent_id = p_parent_id;

    UPDATE public.products
    SET stock = v_new_stock
    WHERE id = p_parent_id AND product_type = 'kit';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para mudanças na composição
CREATE OR REPLACE FUNCTION public.trg_refresh_kit_stock_on_composition_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.refresh_kit_stock(OLD.parent_id);
        RETURN OLD;
    ELSE
        PERFORM public.refresh_kit_stock(NEW.parent_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para mudanças no estoque de componentes
CREATE OR REPLACE FUNCTION public.trg_refresh_kit_stock_on_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualiza todos os kits que contêm este produto como componente
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN SELECT DISTINCT parent_id FROM public.product_kit_components WHERE component_id = NEW.product_id LOOP
            PERFORM public.refresh_kit_stock(r.parent_id);
        END LOOP;
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;
```

## Validação
- Testar a criação de um kit com componentes de estoque variado e verificar se o `stock` do kit assume o menor valor.
- Realizar uma venda/entrada de um componente e verificar se o estoque do kit reflete a mudança automaticamente.
- Verificar se a edição de um kit remove componentes antigos corretamente.
