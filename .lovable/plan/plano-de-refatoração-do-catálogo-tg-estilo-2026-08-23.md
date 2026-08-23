# Plano de Refatoração do Catálogo TG Estilo

Auditoria profunda realizada no domínio `tgestilo.nexxcode.com.br` revelou que o ambiente de produção está servindo um roteamento e menu legados (rotas `/category/$id`, menu estático `CARTEIRAS`, `BOLSAS`, etc.) que não estão presentes no código fonte atual (`src/routes`). A nova arquitetura utiliza rotas dinâmicas baseadas em slugs de coleção (`/catalogo/colecao/$slug`).

Este plano visa unificar a interface, garantindo que o catálogo moderno seja exibido corretamente em produção com todas as categorias (incluindo "Vestuário") visíveis e um design sofisticado.

## Etapa 1: Correção do Menu de Categorias no Catálogo
O menu de categorias atual usa `flex-wrap` mas carece de um design sofisticado e profissional condizente com a marca TG Estilo.

- Refatorar o componente de categorias em `src/routes/catalogo.colecao.$slug.tsx`.
- Implementar um design de "Pill-style" moderno com glassmorphism.
- Garantir que a categoria "Vestuário" (e futuras categorias) seja sempre visível e clicável.

## Etapa 2: Estabilização do Auto-vínculo de Produtos
Garantir que novos produtos marcados com o canal `catalog` entrem automaticamente na coleção principal, resolvendo o problema de produtos que "somem" por não estarem vinculados.

- Ajustar `products.service.ts` para resolver o ID da coleção `tg-style-catalogue` de forma dinâmica e resiliente.
- Adicionar logs de auditoria no processo de auto-publicação.

## Etapa 3: Preparação para Redirecionamento de Rotas Legadas
Como as rotas `/category/$id` não existem no código mas são acessadas pelos usuários, prepararemos o terreno para que o roteador trate essas requisições ou as redirecione para a nova estrutura de coleções.

- Adicionar um catch-all ou lógica de redirecionamento no `__root.tsx` ou criar um arquivo de rota legado para interceptar e encaminhar para a coleção correta.

## Detalhes Técnicos

### Frontend (`src/routes/catalogo.colecao.$slug.tsx`)
- Substituir o seletor de categorias atual por um container flexível de botões estilizados.
- Utilizar cores semânticas (`primary`, `accent`) e tipografia `Montserrat` (injetada via `__root.tsx`).

### Backend (`src/features/products/services/products.service.ts`)
- Refinar a lógica de `create` e `update` para garantir que o vínculo com `product_collection_items` ocorra sem falhas de RLS (usando service_role quando necessário através de server functions).

### Roteamento
- Implementar redirecionamento de `/category/*` para `/catalogo/colecao/tg-style-catalogue` no `__root.tsx` para garantir que o tráfego legado não caia em 404.
