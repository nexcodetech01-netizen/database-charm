# NexOS — Engineering Guide

> Guia oficial de engenharia. Complementa o `BLUEPRINT.md` (§2, §7, §8). Toda alteração de código deve respeitar este documento.

---

## 1. Convenções de código

### Nomenclatura
- **Arquivos**: `kebab-case.ts` / `kebab-case.tsx`.
- **Componentes React**: `PascalCase`.
- **Hooks**: `useCamelCase` — arquivo `use-camel-case.ts`.
- **Services**: `<dominio>.service.ts` — funções em `camelCase`.
- **Types/Interfaces**: `PascalCase`.
- **Constantes globais**: `SCREAMING_SNAKE_CASE`.
- **Rotas (URLs)**: português, kebab-case (`/fornecedores`, `/clientes`).
- **Tabelas do banco**: inglês, `snake_case`, plural (`customers`, `product_categories`).

### Formatação
- Prettier + ESLint configurados no repositório — não alterar sem aprovação.
- Imports ordenados: libs externas → aliases (`@/`) → relativos.
- Sem imports não utilizados. Sem código morto.

### Comentários
- Comentários em português.
- Explicar **por que**, não **o que** — o código já mostra o que.
- Evitar comentários redundantes.

---

## 2. Organização de pastas

```
src/
├── components/          # UI compartilhada
│   ├── ui/              # shadcn/ui primitives (não editar direto)
│   └── layout/          # AppLayout, Sidebar, Topbar
├── features/            # Módulos de negócio isolados
│   └── <feature>/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types.ts
│       └── index.ts
├── providers/           # QueryClient, Theme, Auth, Toaster
├── hooks/               # Hooks reutilizáveis
├── services/            # Wrappers globais (supabase, storage)
├── integrations/        # Clientes gerados (Supabase)
├── lib/                 # Utilitários puros
├── config/              # env, rotas, constantes
├── types/               # Tipos compartilhados
├── routes/              # File-based routing (TanStack Router)
└── styles.css           # Tailwind v4 + design tokens
```

### Regras
- **Dependência unidirecional**: `routes → features → components/hooks/services → lib/types`.
- Uma feature **nunca** importa diretamente de outra. Compartilhamento acontece via `components/`, `hooks/`, `services/`, `lib/`.
- Cada feature expõe sua API pública em `index.ts`.
- Não criar `src/pages/` — routing é file-based via TanStack Router em `src/routes/`.

---

## 3. Padrões React

- **Somente componentes funcionais + hooks**. Sem classes.
- **Nunca** `index` como `key` em listas — use IDs estáveis.
- **Nunca** mutar props ou estado diretamente.
- Extrair lógica reutilizável para hooks (`use-*`).
- Componentes grandes devem ser quebrados em subcomponentes por responsabilidade.
- Evitar `useEffect` para buscar dados — use TanStack Query.
- Portais Radix + listas: sempre keys estáveis para evitar `insertBefore`/`removeChild`.

### Anti-padrões proibidos
- Loops de renderização.
- Desmontar componentes durante animações.
- Alterar providers globais (`QueryClient`, `Theme`, `Auth`) sem aprovação.

---

## 4. TypeScript

- `strict: true` — sempre.
- **Sem** `any` implícito.
- **Sem** `@ts-ignore` sem justificativa em comentário.
- Prefira tipos derivados de schemas Zod: `type Foo = z.infer<typeof fooSchema>`.
- Tipos exportados via `index.ts` da feature.
- Evitar tipos genéricos complexos quando um tipo concreto resolve.

---

## 5. React Query

### Leitura (padrão)
```ts
// no loader
await queryClient.ensureQueryData(customersQueryOptions(filters))

// no componente
const { data } = useSuspenseQuery(customersQueryOptions(filters))
```

### Escrita
```ts
const mutation = useMutation({
  mutationFn: createCustomer,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
})
```

### Regras
- **Query keys** tipadas por feature (`['customers', 'list', filters]`).
- **Nunca** `useQuery` + `isLoading` para render inicial — use `useSuspenseQuery` com loader.
- Sempre `invalidateQueries` após mutations.
- Não misturar TanStack Query com `useEffect` + `fetch`.

---

## 6. Supabase

### Clientes
- **Browser** (SPA): `@/integrations/supabase/client`.
- **Server autenticado**: middleware `requireSupabaseAuth` em server functions.
- **Server admin** (`service_role`): `@/integrations/supabase/client.server` — **apenas** em código server-only (webhooks, admin).

### Regras
- **Nunca** expor `service_role` no cliente.
- Toda tabela nova: RLS habilitada + policies escopadas por `company_id`.
- Roles **sempre** em `user_roles` + função `has_role SECURITY DEFINER`. **Nunca** em `profiles`.
- Storage: buckets privados por padrão, prefixo `company_id/`.
- Alterações de banco **sempre via migration** — nunca ad-hoc no painel.

---

## 7. Componentes compartilhados

Antes de criar qualquer componente, verificar:

- `src/components/ui/` — primitives shadcn/ui.
- `src/components/layout/` — AppLayout, Sidebar, Topbar.

**Disponíveis**: Button, Input, Card, Badge, Dialog, Sheet, Drawer, Select, Table, Sidebar, Topbar, Toaster, Form, Tabs, Tooltip.

### Regras
- **Proibido duplicar componentes**.
- Estender via variantes (`cva`) ou composição — nunca criando componente paralelo.
- Não editar diretamente `src/components/ui/` para casos pontuais.
- Se um componente precisar existir globalmente, promover para `src/components/` com aprovação do Tech Lead.

---

## 8. Fluxo obrigatório de desenvolvimento

Toda alteração — feature, ajuste ou correção — segue **obrigatoriamente**:

1. **Product Owner analisa** — valor, escopo, prioridade, aprovação/adiamento.
2. **Tech Lead planeja** — módulos afetados, arquivos a alterar, riscos, dependências.
3. **Implementação** — apenas o escopo aprovado, respeitando este guia.
4. **QA revisa** — checklist do `BLUEPRINT.md` §10, regressão nos módulos vizinhos.
5. **Aprovação** — só publica após QA aprovar.
6. **Publicação** — deploy + GitHub sincronizado + `CHANGELOG.md` atualizado.

Nenhuma etapa pode ser pulada. Alterações rápidas seguem o fluxo em versão condensada, mas **sempre registradas**.

### Regras críticas de escopo
- **Não alterar módulos fora do escopo** solicitado.
- **Nunca implementar múltiplos módulos** na mesma alteração.
- Se >10 arquivos serão modificados, **parar e confirmar** antes.
- Alterações em arquivos compartilhados (providers, layout, sidebar, `ui/`, `lib/`, `config/`) **devem ser justificadas** e aprovadas pelo Tech Lead.

---

---

## 9. Testes automatizados (Playwright)

Ferramenta oficial: **Playwright + TypeScript**. Suíte em `tests/`, organizada por módulo, com fixtures em `tests/support/`.

### Comandos
- `bun test:e2e` — headless.
- `bun test:e2e:headed` — com browser visível.
- `bun test:e2e:ui` — modo interativo.
- `bun test:e2e:install` — instala navegadores (rodar 1×).

### Regras
- **Nunca** escrever testes que dependam de dados hardcoded — usar factories (`tests/support/factories.ts`).
- **Nunca** manipular banco diretamente nos testes — fluxos vão pela UI.
- Fixture `authedPage` (em `tests/support/fixtures.ts`) provê sessão autenticada; auto-skip se `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` não configurados.
- Seletores priorizam `getByRole` e labels visíveis; evitar `data-testid` a menos que estritamente necessário.
- Todo novo módulo entregue **deve** ter um spec smoke em `tests/<módulo>/`.

### CI
`.github/workflows/e2e.yml` executa a suíte em Pull Requests e no `push` em `main`, publicando o `playwright-report/` como artifact.

---

_Este guia é vivo. Atualizações seguem o fluxo da seção 8._
