# Tratamento de código de barras duplicado

## Resultado
- Impedir que o erro interno do banco apareça ao salvar ou importar produtos.
- Na edição, avisar qual produto já usa o novo código e permitir abri-lo.
- Na criação, impedir a continuação com código repetido e oferecer abrir o cadastro existente ou limpar o campo.
- Manter o comportamento atual para possíveis duplicatas por nome ou SKU.

## Implementação
1. Padronizar no serviço de produtos a conversão da violação do código de barras em mensagem amigável, tanto na criação quanto na edição.
2. Antes de salvar uma edição cujo código mudou, procurar outro produto com o mesmo código ignorando o produto atual.
3. No formulário completo, exibir uma confirmação específica para código repetido, com ações para abrir o produto existente ou limpar o código e continuar editando; não oferecer “Criar mesmo assim”.
4. Revisar o cadastro rápido e os fluxos de importação; aplicar a mesma mensagem amigável onde houver código de barras e garantir proteção de último recurso pelo serviço.
5. Adicionar ou atualizar testes direcionados e validar tipagem e compilação automática.

## Limites
- Preservar o índice único de código de barras.
- Não mudar a política atual de duplicidade por nome ou SKU.
