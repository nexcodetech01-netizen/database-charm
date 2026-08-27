# Redução de egress na tela de Produtos

## O que já está correto hoje (verificado no código)

- A listagem já é paginada: `productsService.list` usa `.range(from, to)` com `pageSize = 20`.
- Não existe `select('*')` na listagem — há uma projeção `LIST_SELECT`.
- Não existe polling nem `useEffect` de refetch: `useProductsList` é um `useQuery` simples.
- As miniaturas já são assinadas em lote (uma chamada `createSignedUrls` para toda a página).

Ou seja, o consumo não vem de N requisições repetidas de dados — vem sobretudo do **download das imagens originais em tamanho cheio** para exibir miniaturas de 40px, e de alguns campos pesados carregados sem necessidade.

## Ajustes propostos

### 1. Imagens redimensionadas (maior ganho)
- Passar a pedir a imagem já redimensionada ao Storage: `createSignedUrls(paths, ttl, { transform: { width: 300, quality: 70, format: 'origin' } })` — na prática o Supabase entrega WebP automaticamente quando o navegador aceita.
- Aplicar em `product-images.service.ts` (`signedUrl` / `signedUrls`) com um parâmetro opcional de largura, para que a listagem peça 300px e a tela de detalhe/edição continue pedindo a imagem cheia.
- Ajustar `ProductThumb` para pedir largura coerente com o tamanho renderizado.
- Observação importante: a transformação de imagem do Supabase é um recurso de plano pago. Se o projeto estiver no plano gratuito, a URL com `transform` retorna erro; nesse caso o código deve cair de volta na URL normal automaticamente (fallback), e o ganho virá dos itens 2 e 3.

### 2. Projeção mais enxuta na listagem
- Remover `description` e `sales_channels` do `LIST_SELECT` (não são exibidos na tabela). `description` é o campo mais pesado por linha.
- Manter os demais campos usados pela tabela e pelas ações da linha.

### 3. Cache mais agressivo do lado do cliente
- `useProductsList` e `useProductMetrics`: `staleTime` de 5 minutos, `refetchOnWindowFocus: false`, `refetchOnMount: false` — evita refazer a consulta a cada troca de aba ou remontagem da tela.
- Aumentar o TTL das URLs assinadas (hoje 1h) e o `staleTime` do cache delas para o mesmo período, evitando reassinar a cada visita.

### 4. Redução de refetch em cascata após salvar produto
- Hoje `useUpdateProduct` invalida `products.all` + detalhe + `inventory` + picker de estoque em toda edição. Restringir a invalidação à lista e ao detalhe do produto alterado, mantendo a invalidação do catálogo apenas quando o canal `catalog` estiver ativo.

## Detalhes técnicos

Arquivos afetados:
- `src/features/products/services/product-images.service.ts` (transform + fallback)
- `src/features/products/components/product-thumb.tsx` (largura por tamanho)
- `src/features/products/components/product-table.tsx` (pedir 300px)
- `src/features/products/services/products.service.ts` (`LIST_SELECT`)
- `src/features/products/hooks/use-products.ts` (staleTime, refetch flags, invalidação)

Sem mudanças de banco, de RLS ou de layout visual.
