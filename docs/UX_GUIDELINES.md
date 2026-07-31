# NexOS — UX Guidelines (Sprint 21.0)

> Fundação única de experiência. Todo módulo do NexOS deve seguir este
> documento antes de qualquer redesign. Esta sprint **não altera módulos**:
> apenas define padrões e disponibiliza componentes reutilizáveis.

---

## Princípios

1. **Foco na operação.** Cada tela responde a uma pergunta única do usuário.
2. **Hierarquia primeiro.** O olho deve encontrar o número/ação principal
   em menos de 1 segundo.
3. **Densidade calibrada.** Nem "dashboard vazio", nem "planilha do Excel".
4. **Consistência > criatividade.** Mesmo padrão, mesmo lugar, sempre.
5. **Silêncio nos estados calmos.** Ruído visual só onde há decisão.

---

## 1. Cabeçalhos — `PageHeader`

Todo módulo começa com o mesmo componente.

- **Título:** 24px, `font-semibold`, `tracking-tight`. Um nível único (H1).
- **Subtítulo:** 14px, `text-muted-foreground`. Descreve o propósito em uma
  frase (nunca "Gerenciar seus…").
- **Breadcrumbs:** acima do título, via `BreadcrumbNav`. Sempre começa em
  "Início". Nunca duplica o título da página.
- **Ações principais:** à direita. Máximo **1 primária** + até 2 secundárias.
- **Ícone opcional:** tile 40×40, fundo `primary/10`, ícone Lucide.
- **Meta:** slot ao lado do título para badges de contagem/estado.

```tsx
<PageHeader
  icon={Package}
  title="Produtos"
  description="Cadastro central de itens vendáveis e insumos."
  meta={<Badge variant="secondary">128</Badge>}
  actions={<Button><Plus/> Novo produto</Button>}
/>
```

---

## 2. Cards de resumo — `KpiCard`

KPIs no topo das telas de listagem e dashboards.

- Layout em grid: **1 col mobile → 2 sm → 4 lg**.
- **Label:** 12px, uppercase, `tracking-wide`, `text-muted-foreground`.
- **Valor:** 24px, `font-semibold`, `tabular-nums`.
- **Trend pill** opcional: seta + variação + tom semântico
  (`positive` verde / `negative` vermelho / `neutral` cinza).
- Ícone à direita em tile suave (`primary/10`).
- Estado de carregamento: `loading` renderiza `<Skeleton />`.

Badges de status usam `variant`:
- `default` — ativo / concluído
- `secondary` — rascunho / neutro
- `outline` — pendente
- `destructive` — erro / bloqueado

---

## 3. Formulários — `FormSection` + `FormGrid`

Padrão editorial em duas colunas (desktop): título/descrição à esquerda,
campos à direita. Empilha em mobile.

- **Espaçamento vertical:** `py-6` entre seções, borda inferior sutil.
- **Espaçamento entre campos:** `gap-4`.
- **Grid:** 1 coluna para textarea/endereço, 2 para dados curtos, 3 apenas
  quando os campos forem realmente compactos (código/qtd/unidade).
- **Campos obrigatórios:** asterisco `*` após o label; nunca vermelho por
  padrão. Vermelho é reservado para **erro real**.
- **Ajuda:** texto auxiliar sob o campo em 12px muted; erros substituem
  a ajuda, nunca somam.
- **Ordem:** dados de identidade → classificação → operação → fiscal → notas.
- **Botões de rodapé:** `Cancelar` (ghost/outline) à esquerda, `Salvar`
  primário à direita. Nunca dois primários.
- **Autosave:** quando existir, mostrar timestamp discreto ("Salvo agora").

```tsx
<FormSection title="Identidade" description="Nome e códigos do produto.">
  <FormGrid cols={2}>
    <Field name="name" label="Nome *" />
    <Field name="sku" label="SKU" />
  </FormGrid>
</FormSection>
```

---

## 4. Tabelas — `SectionToolbar` + `Table`

Padrão para listas em todos os módulos.

- **Toolbar acima da tabela** (`SectionToolbar`): busca à esquerda, filtros
  ao centro, ações à direita ("Exportar", "Novo").
- **Busca:** input com ícone `Search`, placeholder "Buscar por nome, código…".
- **Cabeçalho:** `text-xs uppercase tracking-wide text-muted-foreground`.
- **Linhas:** altura `h-12`, hover `bg-muted/40`, cursor pointer quando
  linha é clicável.
- **Colunas numéricas/monetárias:** `text-right`, `tabular-nums`.
- **Ações por linha:** menu `⋯` (`DropdownMenu`) na última coluna,
  `text-right`, largura fixa `w-10`.
- **Seleção múltipla:** checkbox na primeira coluna, largura `w-10`;
  barra de ações em massa aparece flutuante no rodapé quando há seleção.
- **Paginação:** rodapé com "N–M de T", `‹` `›` e seletor de tamanho
  (25/50/100). Sempre à direita, `border-t`.
- **Densidade:** apenas UMA densidade oficial (confortável). Não oferecer
  toggle compacto/expandido no MVP.
- **Ordenação:** ícone `ArrowUpDown` no cabeçalho clicável.

---

## 5. Painel lateral direito — `DetailPanel`

Usado em telas operacionais (PDV, Compras, Financeiro, Agenda).

- Layout base: `grid lg:grid-cols-[minmax(0,1fr)_360px]`.
- Painel é **sticky** (`top-4`) e rola independente.
- Estrutura fixa:
  1. Cabeçalho (título curto + descrição opcional)
  2. Conteúdo com `SummaryRow` (label esquerda, valor direita, `tabular-nums`)
  3. Rodapé com ações principais (`bg-muted/30`, botões full-width empilhados)
- **Total final** com `emphasis` (18px, negrito).
- Máximo **1 ação primária** no rodapé; secundárias ficam acima.
- Em mobile (`< lg`): painel vira card no fim da página, sem sticky.

---

## 6. Detalhes de entidade

Página de "ver registro" segue estrutura única:

1. `BreadcrumbNav` + `PageHeader` com título = nome da entidade, meta =
   badge de status, actions = `Editar`, `⋯` (excluir, duplicar, imprimir).
2. Faixa de KPIs específicos do domínio (opcional): 3–4 `KpiCard`s.
3. `Tabs` fixas — **ordem canônica**:
   - `Visão geral` (grid de cards com dados-chave)
   - `Histórico` (linha do tempo de eventos)
   - `Relacionados` (vendas, agendamentos, tickets…)
   - `Integrações` (Asaas, e-mail, WhatsApp — quando existir)
   - `Notas` (texto livre + anexos)
4. Nunca formulário inline na tela de detalhe — edição sempre em rota
   dedicada `/entidade/:id/editar`.

---

## 7. Estados

| Estado       | Componente          | Quando usar                                   |
|--------------|---------------------|-----------------------------------------------|
| Vazio        | `EmptyState`        | Zero registros; sempre com CTA claro          |
| Carregando   | `<Skeleton />` list | Listas, cards, tabelas — preservar layout     |
| Carregando 2 | `LoadingState`      | Ações pontuais (imprimir, sincronizar)        |
| Erro         | `ErrorState`        | Falha de carregamento; oferecer "Tentar novamente" |
| Sucesso      | `toast.success()`   | Confirmação de ação; nunca modal              |
| Aviso        | `toast.warning()`   | Ex.: estoque baixo após salvar                |

Regras de copy (ver skill `nexcode-ux-writer`):
- Nunca "Nenhum dado encontrado". Sempre nomeie o objeto:
  "Nenhum produto cadastrado".
- Erros orientam ação: "Não conseguimos carregar. Tente novamente."
- CTA específica: "Criar produto", não "Adicionar".

---

## 8. Tipografia

| Uso                     | Classe                                                 |
|-------------------------|--------------------------------------------------------|
| Título de página (H1)   | `text-2xl font-semibold tracking-tight`                |
| Título de seção (H2)    | `text-lg font-semibold`                                |
| Título de card (H3)     | `text-sm font-semibold`                                |
| Subtítulo/descrição     | `text-sm text-muted-foreground`                        |
| Label de campo          | `text-sm font-medium`                                  |
| Label de KPI            | `text-xs font-medium uppercase tracking-wide muted`    |
| Valor numérico          | `font-mono tabular-nums`                               |
| Valor monetário         | `<MoneyValue />` (tabular-nums + intent semântico)     |
| Ajuda / hint            | `text-xs text-muted-foreground`                        |

Cores semânticas: sempre via tokens (`text-primary`, `bg-muted`, etc.).
**Proibido** `text-white`, `bg-black`, `#hex` inline em componentes.

---

## 9. Hierarquia visual

- **Regra dos 3 níveis:** primário (ação principal), secundário (contexto),
  terciário (metadados). Nunca 4 pesos competindo.
- **Espaço em branco** entre grupos ≥ `gap-6`; dentro do grupo `gap-3/4`.
- **Bordas** são sempre `border-border`; nunca borda dupla.
- **Sombras** apenas em elementos flutuantes (Popover/Dialog/Dropdown).
  Cards ficam com borda + fundo, sem sombra.
- **Ícones Lucide** em tamanho fixo: `h-4 w-4` inline, `h-5 w-5` em headers,
  `h-6 w-6` em empty states.
- **Botões:** primário sólido (`variant="default"`), secundário `outline`,
  terciário `ghost`. Ícones acompanham texto (nunca apenas ícone em
  desktop, salvo tabelas).

---

## 10. Responsividade

Breakpoints (Tailwind): `sm 640` · `md 768` · `lg 1024` · `xl 1280`.

Regras universais:
- Todo cabeçalho multi-item usa `grid grid-cols-[minmax(0,1fr)_auto]` até
  `sm:`, então vira `flex`. Textos ganham `truncate` + `min-w-0`.
- Sidebar colapsa para off-canvas em `< lg`.
- KPIs: `1 → 2 → 4` colunas conforme largura.
- Formulários viram 1 coluna em `< md`; `FormSection` empilha automaticamente.
- Tabelas com muitas colunas usam scroll horizontal (`overflow-x-auto`) e
  **fixam** a primeira coluna quando aplicável.
- `DetailPanel` só é sticky em `≥ lg`; abaixo, empilha ao fim da página.
- Nenhuma tela pode ter overflow horizontal em 360×640.

---

## Componentes reutilizáveis (entregues nesta sprint)

Localização: `src/components/layout/`.

| Componente          | Arquivo                | Uso                                          |
|---------------------|------------------------|----------------------------------------------|
| `PageHeader`        | `page-header.tsx`      | Cabeçalho canônico de todas as páginas       |
| `BreadcrumbNav`     | `breadcrumb-nav.tsx`   | Navegação hierárquica acima do header        |
| `SectionToolbar`    | `section-toolbar.tsx`  | Barra de busca/filtros/ações sobre tabelas   |
| `KpiCard`           | `kpi-card.tsx`         | Card de KPI/resumo com trend opcional        |
| `FormSection`       | `form-section.tsx`     | Seção editorial de formulário longo          |
| `FormGrid`          | `form-section.tsx`     | Grid interno de campos (1/2/3 colunas)       |
| `DetailPanel`       | `detail-panel.tsx`     | Painel lateral direito sticky                |
| `SummaryRow`        | `detail-panel.tsx`     | Linha label→valor alinhada                   |
| `MoneyValue`        | `money-value.tsx`      | Valor monetário com intent semântico         |
| `EmptyState`        | `empty-state.tsx`      | Estado vazio com CTA                         |
| `LoadingState`      | `state-views.tsx`      | Spinner para ações pontuais                  |
| `ErrorState`        | `state-views.tsx`      | Erro com retry                               |
| `ListSkeleton`      | `list-skeleton.tsx`    | Skeleton para listas/tabelas                 |

---

## Lista de padrões definidos

- [x] Cabeçalho único (`PageHeader`) com meta e ações
- [x] KPI padrão (`KpiCard`) com trend semântica
- [x] Formulário editorial em duas colunas (`FormSection`/`FormGrid`)
- [x] Toolbar de tabela (busca + filtros + ações)
- [x] Painel lateral direito sticky (`DetailPanel` + `SummaryRow`)
- [x] Estrutura canônica de página de detalhes (KPIs + Tabs)
- [x] Estados: vazio, carregando, erro, sucesso (toast)
- [x] Escala tipográfica única
- [x] Regra dos 3 níveis de hierarquia
- [x] Breakpoints e comportamento responsivo por componente

## Próximo passo

Sprint 21.1 em diante aplica esta fundação módulo a módulo, começando por
**Produtos** (referência), **Vendas/PDV** e **Financeiro**. Nenhum módulo
recebe redesign fora deste padrão.

---

## 10. Fundação Visual — `PageLayout` + `KpiSection` (UX-001)

A partir da sprint UX-001, **toda nova tela e toda migração de tela existente
deve usar `PageLayout` como envelope**. Nenhum módulo compõe manualmente
`div > BreadcrumbNav > PageHeader > grid > toolbar > conteúdo` — essa é
exatamente a estrutura que `PageLayout` já entrega, com espaçamentos, largura
máxima (`max-w-7xl`) e paddings responsivos (`p-4 sm:p-6`) padronizados.

### Ordem canônica de blocos

```
BreadcrumbNav  (automático)
PageHeader     (title • description • meta • actions)
KpiSection     (grid 1 → 2 → 4)
SectionToolbar (busca + filtros + ações)
Conteúdo       (tabela / cards / formulário)
Aside          (opcional, sticky no lg)
```

### Exemplo canônico

```tsx
import { Package, Plus } from "lucide-react";
import {
  PageLayout,
  KpiSection,
  KpiCard,
  SectionToolbar,
} from "@/components/layout";

export function ProdutosListPage() {
  return (
    <PageLayout
      icon={Package}
      title="Produtos"
      description="Cadastro central de itens vendáveis e insumos."
      actions={<Button><Plus className="mr-2 h-4 w-4" /> Novo produto</Button>}
      kpis={
        <KpiSection>
          <KpiCard label="Ativos" value="128" />
          <KpiCard label="Sem estoque" value="4" />
          <KpiCard label="Margem média" value="42%" />
          <KpiCard label="Ticket médio" value="R$ 189,90" />
        </KpiSection>
      }
      toolbar={
        <SectionToolbar
          search={<Input placeholder="Buscar produtos..." />}
          filters={<CategoryFilter />}
          actions={<ExportButton />}
        />
      }
    >
      <DataTable ... />
    </PageLayout>
  );
}
```

### Regras de migração

- Substituir `<div className="space-y-6 p-6">` + `PageHeader` manual pelo
  `PageLayout`. Remover `max-w-*` locais.
- KPIs sempre dentro de `KpiSection` — nunca `grid grid-cols-4` solto.
- Toolbar sempre via `SectionToolbar`; não recriar caixinhas com `border` +
  `rounded-lg` no módulo.
- Formulários longos: seguir a seção 4 (`FormSection` + `FormGrid`),
  dentro do slot `children` do `PageLayout`.
- Import único: `from "@/components/layout"` (barrel). Deep-imports por
  arquivo continuam funcionando, mas não são mais o padrão.

### O que **não** muda

- Nenhuma rota, hook, service, query, RLS ou regra de negócio.
- Identidade visual (tokens, tipografia, raio, sombras) permanece a
  mesma — `PageLayout` é composição pura.
- Módulos legados continuam funcionando; a migração é feita por ticket.
