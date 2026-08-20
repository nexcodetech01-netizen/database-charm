# Plan: Melhorias na Calculadora de Frete

Implementar validações, persistência, estados de carregamento e testes para a calculadora de frete.

## Proposed Changes

### 1. Validação de CEP e Máscara
- Aprimorar o `ShippingCalculatorSchema` no `src/features/shipping/types.ts` para mensagens mais claras.
- Refinar a função `formatCep` e aplicá-la consistentemente nos inputs de CEP.

### 2. Persistência de Cotações
- Expandir o uso do `localStorage` para salvar não apenas o CEP de destino, mas as dimensões completas e o resultado da cotação.
- Garantir que a aba "Recentes" carregue os dados corretamente.

### 3. Estados de Carregamento e Bloqueio
- Adicionar um estado visual de carregamento no botão principal durante a chamada à Server Function.
- Desabilitar o botão enquanto `isLoading` for verdadeiro para evitar cliques duplicados.

### 4. Interface de Erro Amigável
- Implementar um componente de alerta para falhas de rede ou erros da API SuperFrete.
- Incluir um botão "Tentar Novamente" que re-submete o formulário.

### 5. Testes e Validações E2E
- Criar um script de teste Playwright em `/tmp/browser/test_shipping_calculator.py` para validar:
    - Máscara de CEP enquanto digita.
    - Persistência no localStorage após uma cotação bem-sucedida.
    - Bloqueio do botão durante o carregamento.

## Technical Details
- Utilizar `react-hook-form` para gerenciar os estados de validação.
- `localStorage` keys: `nexos:frete:recent-quotes`.
- `zod` para schema validation.
