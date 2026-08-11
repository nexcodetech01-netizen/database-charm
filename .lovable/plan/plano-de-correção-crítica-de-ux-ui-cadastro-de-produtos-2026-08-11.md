# Plano de Correção Crítica de UX/UI - Cadastro de Produtos

Este plano visa restaurar a usabilidade do cadastro de produtos, implementando atalhos para criação de categorias, cálculos automáticos de margem de lucro e melhorias visuais na validação de campos obrigatórios.

## Alterações Técnicas

### 1. Cadastro Rápido de Categoria
- Criar o componente `CategoryQuickFormDialog.tsx` para permitir a criação imediata de categorias via modal.
- Integrar este modal em `GeneralInfoForm.tsx` e `PricingForm.tsx` através de um botão "+" ao lado do select de categoria.
- Garantir que a nova categoria seja selecionada automaticamente após a criação em `ProductForm`.

### 2. Cálculo por Porcentagem de Margem de Lucro
- Adicionar o campo "Margem Desejada (%)" em `PricingForm.tsx`.
- Implementar lógica de cálculo bidirecional:
  - Alterar Custo + Margem -> Calcula Preço de Venda.
  - Alterar Preço de Venda -> Recalcula Margem (%).
- Utilizar `BRLCurrencyInput` e novos campos de entrada numérica para precisão.

### 3. Validação e Feedback Visual
- Adicionar indicador visual de obrigatoriedade (*) nos labels através de um novo componente `RequiredLabel.tsx` ou CSS utilitário.
- Atualizar `ProductForm` para lidar com erros de validação do Zod, injetando mensagens de erro e estados de erro nos componentes filhos.
- Implementar o "Smart Focus on Error": se houver erro em uma aba oculta, o sistema alternará automaticamente para a aba correta e dará foco ao campo com erro.

### Arquivos afetados:
- `src/features/products/components/product-form/index.tsx` (Lógica central, tabs, smart focus)
- `src/features/products/components/product-form/modules/general-info-form.tsx` (Botão "+" categoria, indicadores obrigatórios)
- `src/features/products/components/product-form/modules/pricing-form.tsx` (Cálculo de margem, botão "+" categoria, indicadores obrigatórios)
- `src/features/products/components/product-form/modules/logistics-form.tsx` (Indicadores obrigatórios)
- `src/features/products/components/product-form/modules/fiscal-form.tsx` (Indicadores obrigatórios)
- `src/features/products/components/product-form/category-quick-form-dialog.tsx` (Novo componente)
- `src/components/ui/required-label.tsx` (Novo componente de utilidade)
