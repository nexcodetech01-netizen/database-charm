# Plano de Refatoração: Cabeçalho e Menu do Catálogo NexOS

O objetivo deste plano é refatorar o cabeçalho e o menu de categorias do catálogo para alcançar um design sofisticado e profissional, corrigindo a visibilidade e a estética, enquanto se mantém fiel à identidade visual do projeto (NexOS Dark Mode).

## Alterações Propostas

### 1. Refatoração do Cabeçalho (`header`)
- **Estética Superior**: Adicionar um gradiente sutil no fundo e melhorar a tipografia.
- **Ações Rápidas**: Reposicionar os botões "Copiar link" e "Compartilhar" para uma área mais discreta ou elegante, usando ícones com labels claros.
- **Informações da Empresa**: Destacar o nome da empresa com um estilo de "badge" ou texto refinado.

### 2. Redesign do Menu de Categorias
- **Visibilidade "Sticky"**: Garantir que o menu de categorias seja fixo no topo durante o scroll, mas com um design mais compacto.
- **Estilo de Cápsulas (Pills)**: Melhorar o design das cápsulas de categoria com estados ativos mais claros e transições suaves.
- **Layout Inteligente**: Manter o `flex-wrap` para garantir que todas as categorias sejam visíveis (incluindo "Vestuário"), mas adicionar um limite de altura com opção "Ver mais" se a lista for excessivamente longa, para manter a compacidade.
- **Filtros Integrados**: Unificar a busca e os filtros de marca/preço em uma barra de ferramentas mais coesa.

### 3. Ajustes de Cores e Temas
- **Consistência Dark Mode**: Usar as variáveis semânticas do Tailwind v4 (`bg-card`, `text-primary`, `border-border/50`) para garantir que o cabeçalho se integre perfeitamente ao resto do app.
- **Efeito de Vidro (Glassmorphism)**: Aplicar `backdrop-blur` no menu fixo para um visual moderno.

## Detalhes Técnicos

### Arquivos a serem modificados:
- `src/routes/catalogo.colecao.$slug.tsx`: Reestruturação do JSX e aplicação das novas classes Tailwind.
- `src/features/catalog/lib/load-collection-page.server.ts`: (Se necessário) Garantir que a ordem das categorias priorize itens com mais estoque ou ordem alfabética refinada.

### Estrutura Visual Desejada:
```text
[ LOGO / NOME EMPRESA ] [ BUSCA ] [ AÇÕES ]
[ CATEGORIA 1 ] [ CATEGORIA 2 ] [ ... ] [ VESTUÁRIO ]
-----------------------------------------------------
[ RESULTADOS E PRODUTOS ]
```

## Próximos Passos
1. Refatorar o componente `PublicCollectionPage` em `src/routes/catalogo.colecao.$slug.tsx`.
2. Validar a responsividade em dispositivos móveis.
3. Confirmar a visibilidade da categoria "Vestuário" após o redesign.
