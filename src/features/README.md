# Features

Each folder under `src/features/` is a self-contained business module.
Keep modules independent — never import from a sibling feature directly.
Share code through `src/components/`, `src/hooks/`, `src/lib/`,
`src/services/`, and `src/types/`.

## Suggested structure per feature

```
src/features/<feature>/
├── components/    # UI local to this feature
├── hooks/         # Custom hooks (data fetching, state)
├── services/      # API/Supabase calls specific to the feature
├── types.ts       # Feature-scoped types
└── index.ts       # Public surface (re-exports)
```

## Planned modules (skeleton only — no business logic yet)

- `auth` — sign-in, sign-up, password reset
- `dashboard` — overview & KPIs
- `customers` — CRM / clientes
- `products` — catálogo
- `sales` — vendas / pedidos
- `finance` — financeiro
- `settings` — preferências e workspace
