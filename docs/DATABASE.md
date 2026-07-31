# NexOS — Database Guide

> Documentação oficial da camada de dados. Complementa o `BLUEPRINT.md` (§4). Toda alteração de schema deve refletir aqui.

---

## 1. Arquitetura Supabase

- **Postgres gerenciado** pela Supabase, com Auth, RLS e Storage integrados.
- **Multi-tenant** desde o dia 1 via `company_id` em toda tabela de negócio.
- **Segurança por padrão**: RLS habilitada em todas as tabelas públicas.

### Clientes

| Cliente | Onde usar | Chave |
|---|---|---|
| `@/integrations/supabase/client` | Browser (SPA) | publishable |
| `requireSupabaseAuth` | Server functions autenticadas | publishable + JWT do usuário |
| `@/integrations/supabase/client.server` | Server-only (webhooks, admin) | `service_role` |

**Nunca** expor `service_role` no cliente.

---

## 2. Convenções das tabelas

### Colunas obrigatórias
Toda tabela de negócio contém:

```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Padrões
- Nome: **inglês**, `snake_case`, **plural** (`customers`, `product_categories`).
- Enums Postgres para status/tipos fechados.
- Índices em toda coluna usada em filtro/join/ordenação frequente.
- Trigger `update_updated_at_column` em toda tabela mutável.

### Trigger padrão
```sql
CREATE TRIGGER update_<table>_updated_at
BEFORE UPDATE ON public.<table>
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## 3. Relacionamentos

### Núcleo
- `auth.users` → `profiles` (1:1)
- `profiles` → `companies` (owner)
- `companies` → **todas as tabelas de negócio** (via `company_id`)

### Domínio
- `product_categories` → `product_categories` (auto-relacional via `parent_id`)
- `products` → `product_categories`, `product_suppliers`
- `product_images` → `products`
- `inventory_movements` → `products`
- `customer_interactions` → `customers`

### Futuros (preparados)
- `sales` → `customers`, `products`
- `purchases` → `product_suppliers`, `products`
- `financial_entries` → `customers`, `product_suppliers`, `sales`, `purchases`
- `user_roles` → `auth.users`, `companies`

---

## 4. Storage (Buckets)

| Bucket | Visibilidade | Uso |
|---|---|---|
| `product-images` | Privado | Imagens de produtos |

### Regras
- Buckets **privados por padrão**.
- Nome de arquivo prefixado por `company_id/` (ex: `<company_id>/<product_id>/<file>.jpg`).
- Policies de Storage escopadas por `company_id`.
- Acesso via URLs assinadas (`createSignedUrl`) — nunca URLs públicas para dados sensíveis.

### Novo bucket
1. Criar via migration (`storage.buckets`).
2. Definir policies de SELECT/INSERT/UPDATE/DELETE por `company_id`.
3. Documentar aqui.

---

## 5. RLS (Row-Level Security)

### Regras absolutas
- **Sempre habilitada** em qualquer tabela pública.
- Policies escopadas por `auth.uid()` → `company_id` do usuário.
- **Nenhum dado cruza empresas** — nem em queries, nem em Storage, nem em relatórios.

### Padrão de policy
```sql
CREATE POLICY "Company members manage their own <table>"
ON public.<table>
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);
```

### Roles
- Roles **sempre** em tabela `user_roles` separada.
- Função `has_role(_user_id, _role) SECURITY DEFINER` para evitar recursão.
- **Nunca** armazenar roles em `profiles` ou `users`.

---

## 6. Auth

- **Supabase Auth** com email/senha + fluxo de recuperação de senha.
- Sessão persistida via cliente Supabase (SPA) e cookies `@supabase/ssr` (SSR).
- Rota protegida: subtree `src/routes/_authenticated/` com guard.
- Onboarding obrigatório após primeiro login (criação da empresa).

---

## 7. Migrations

### Estrutura obrigatória — nesta ordem
```sql
-- 1. CREATE TABLE
CREATE TABLE public.<name> (...);

-- 2. GRANT (obrigatório)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;
GRANT ALL ON public.<name> TO service_role;
-- GRANT SELECT ON public.<name> TO anon;  -- somente se policy anon existir

-- 3. ENABLE RLS
ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
CREATE POLICY "..." ON public.<name> FOR ... USING (...) WITH CHECK (...);

-- 5. Índices e triggers
CREATE INDEX idx_<name>_<col> ON public.<name>(<col>);
CREATE TRIGGER update_<name>_updated_at ...;
```

### Regras
- **Proibido**: `DROP TABLE`, `DROP COLUMN`, alterações destrutivas sem plano de migração aprovado.
- Toda alteração de schema **via migration** — nunca ad-hoc no painel.
- Migrations são imutáveis após aprovadas — corrigir sempre com nova migration.
- Um `GRANT` ausente causa `permission denied` em runtime — não pode faltar.

---

## 8. Tabelas atuais (resumo)

| Tabela | Sprint | Descrição |
|---|---|---|
| `profiles` | 1 | Perfil do usuário vinculado a `auth.users` |
| `companies` | 1 | Empresa (tenant) |
| `product_categories` | 2/3 | Taxonomia hierárquica de produtos |
| `product_suppliers` | 2/5 | Fornecedores completos |
| `products` | 2 | Produtos com precificação e estoque |
| `product_images` | 2 | Imagens vinculadas ao produto |
| `inventory_movements` | 4 | Movimentações de estoque |
| `customers` | 6 | Clientes (CRM) |
| `customer_interactions` | 6 | Timeline de interações do CRM |

---

_Documento vivo — atualizar a cada migration aprovada._
