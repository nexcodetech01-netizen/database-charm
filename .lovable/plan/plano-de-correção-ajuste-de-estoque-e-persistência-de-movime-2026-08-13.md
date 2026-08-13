# Plano de Correção: Ajuste de Estoque e Persistência de Movimentações

O objetivo é corrigir a falha na gravação de ajustes de estoque, garantindo que o campo `source` respeite a restrição do banco de dados e que a UI reflita o novo saldo imediatamente sem necessidade de recarregar a página.

## Alterações

### 1. Backend e Camada de Dados (Supabase/Services)
- **inventory-movement.service.ts**: Reforçar a validação do campo `source` para garantir que apenas valores permitidos pelo enum do PostgreSQL (`manual`, `adjustment`, `purchase`, etc.) sejam enviados, com fallback para `manual`.
- **product.repository.ts**: Garantir que as inserções de movimentos de estoque durante a criação/duplicação de produtos também sigam a mesma regra de validação de `source`.

### 2. Interface e UX (React/TanStack Query)
- **movement-form-dialog.tsx**: 
    - Corrigir o mapeamento do campo `source` no formulário para assegurar conformidade com o enum.
    - Garantir que a mutação dispare as invalidações corretas no `onSuccess`.
- **use-inventory.ts / use-products.ts**:
    - Otimizar as invalidações de query no TanStack Query.
    - Garantir que `queryClient.invalidateQueries(['products'])` e `queryClient.invalidateQueries(['inventory'])` cubram todas as visualizações (detalhes e listagens).
- **stock-form.tsx**:
    - Garantir que o valor exibido no card "Saldo em Estoque" ou "Disponível" utilize a propriedade reativa vinda da query de produtos, permitindo atualização instantânea após a mutação.

## Verificação Técnica
- Validar se a constraint `inventory_movements_source_check` não é mais violada ao salvar ajustes manuais.
- Confirmar que o saldo de estoque (coluna `stock` da tabela `products`) é atualizado via trigger de banco após a inserção do movimento.
- Verificar o recarregamento instantâneo da UI via TanStack Query.

## Detalhes Adicionais (Não técnicos)
- A correção impede que o sistema "esqueça" o valor digitado no ajuste de estoque devido a erros silenciosos na comunicação com o banco de dados.
- O saldo passará a ser exibido corretamente logo após a confirmação da operação.
