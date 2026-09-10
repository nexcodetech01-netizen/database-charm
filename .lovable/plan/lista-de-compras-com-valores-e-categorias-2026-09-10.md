# Lista de compras com valores e categorias

## Alteração
- Incluir valor estimado e categoria opcionais no formulário, com sugestões das categorias já carregadas.
- Exibir totais pendente e comprado, evitando apresentar zero quando nenhum item tiver valor.
- Agrupar pendências por categoria, deixando “Sem categoria” por último, com subtotal por grupo.
- Mostrar preço unitário e total em cada item.
- Permitir editar preço e categoria diretamente na lista, salvando pelo hook existente.

## Detalhes técnicos
- Alterar somente `src/routes/_authenticated/lista-de-compras.tsx`.
- Reutilizar os campos e hooks já existentes na camada de dados.
- Preservar os componentes e o estilo visual atuais.
