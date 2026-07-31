# NexOS — Arquitetura

SaaS de gestão para PMEs brasileiras. Este documento descreve a base
técnica antes da implementação de qualquer módulo de negócio.

## Stack

- **React 19 + TypeScript (strict)**
- **Vite 7** + **TanStack Start** (SSR + file-based routing)
- **TanStack Router** e **TanStack Query**
- **Tailwind CSS v4** (tokens em `src/styles.css`) + **shadcn/ui**
- **Supabase** — Auth, Database (RLS), Storage
- **Lucide Icons**

## Princípios

1. **Modularização por feature** — cada domínio de negócio vive em
   `src/features/<feature>/` e é independente dos demais.
2. **Camadas com dependência unidirecional**: `routes → features →
   components/hooks/services → lib/types`. Nunca o contrário.
3. **Design tokens** — cor, espaçamento, tipografia e raio vêm do
   `@theme` em `src/styles.css`. Nada de valores hardcoded.
4. **Segurança**: RLS habilitado em toda tabela; nunca expor
   `service_role` no cliente; segredos em `process.env` dentro de
   server functions.
5. **Performance**: `React.lazy` para rotas pesadas, `useSuspenseQuery`
   na leitura padrão, `select` específico no Supabase, paginação.

## Estrutura de pastas

```
src/
├── components/          # UI compartilhada
│   ├── ui/              # shadcn/ui primitives (não editar direto)
│   └── layout/          # AppLayout, Sidebar, Topbar
├── features/            # Módulos de negócio (auth, dashboard, ...)
│   └── <feature>/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types.ts
│       └── index.ts
├── providers/           # AppProviders, ThemeProvider, AuthProvider
├── hooks/               # Hooks reutilizáveis (use-toast, use-debounced-value)
├── services/            # Camada de serviços (supabase, storage)
├── integrations/        # Clientes gerados (Supabase)
├── lib/                 # Utilitários puros (cn, format, ...)
├── config/              # env, rotas, constantes globais
├── types/               # Tipos compartilhados
├── routes/              # File-based routing (TanStack Router)
└── styles.css           # Tailwind v4 + design tokens
```

## Providers (`src/providers/app-providers.tsx`)

Compõe, na ordem: `QueryClientProvider` → `ThemeProvider` →
`AuthProvider` → `Toaster`. Adicionar um novo provider global é uma
alteração de um único arquivo.

## Roteamento

File-based via TanStack Router. Nomes de arquivo mapeiam para URLs
usando pontos como separadores (`settings.profile.tsx` →
`/settings/profile`). Constantes centralizadas em `src/config/routes.ts`.

## Dados

- Leitura: `queryClient.ensureQueryData` no loader + `useSuspenseQuery`
  no componente.
- Escrita: `useMutation` + `queryClient.invalidateQueries`.
- Server-only: `createServerFn` (nunca Edge Functions como padrão).

## Próximos passos

Implementar módulos na ordem: `auth` → `dashboard` → `settings` →
demais features de negócio.
