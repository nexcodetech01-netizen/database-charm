# NexOS — Blueprint Oficial

> Fonte única da verdade do projeto NexOS.
> Este documento deve ser consultado **antes** de qualquer implementação, alteração ou decisão sobre o produto.
> Qualquer divergência entre código e blueprint é tratada como bug ou como atualização deste documento — nunca como exceção silenciosa.

---

## 1. Visão do Produto

### 1.1 Objetivo
O **NexOS** é um SaaS de gestão empresarial (ERP + CRM + Financeiro + IA) que unifica operação, vendas, estoque, financeiro e relacionamento com clientes em uma única plataforma moderna, intuitiva e assistida por IA — substituindo planilhas e ferramentas fragmentadas.

### 1.2 Público-alvo
- Pequenas e médias empresas brasileiras (comércio, serviços, revenda, distribuição).
- Empreendedores individuais em crescimento que já sentem dor com controle manual.
- Times pequenos (1–30 pessoas) que precisam de operação centralizada.

### 1.3 Proposta de valor
- **Tudo em um só lugar**: produtos, estoque, compras, vendas, financeiro, clientes, agenda e marketing.
- **Interface premium**: nível Linear/Stripe/Notion/Vercel, focada em clareza e velocidade.
- **IA integrada (Bella)**: copiloto operacional que ajuda a decidir, não apenas registrar.
- **Pronto para o Brasil**: CNPJ/CPF, formatos BR, meios de pagamento locais (Bella Pay via Asaas).

### 1.4 Diferenciais
- Design System proprietário e consistente em todos os módulos.
- Arquitetura modular real — features isoladas, sem acoplamento.
- **Bella IA** como camada transversal, não como chatbot isolado.
- **Bella Pay** integrado a Asaas para cobrança nativa dentro do fluxo financeiro.
- Multiempresa (multi-tenant) desde o dia 1 via RLS.

### 1.5 Princípios do NexOS
1. **Simplicidade acima de tudo** — menos é mais.
2. **Clareza > densidade** de informação.
3. **Consistência total** entre módulos.
4. **Performance é feature**.
5. **Segurança por padrão** (RLS, escopo por empresa).
6. **Modularidade real** — nenhuma feature invade outra.
7. **Nada é implementado sem passar pelo fluxo oficial**.

---

## 2. Arquitetura Oficial

### 2.1 Stack tecnológica
- **Frontend**: React 19 + TypeScript strict, Vite 7, TanStack Start (SSR + file-based routing), TanStack Router, TanStack Query.
- **UI**: Tailwind CSS v4 (tokens em `src/styles.css`), shadcn/ui, Lucide Icons.
- **Formulários**: React Hook Form + Zod.
- **Backend**: Supabase (Auth, Postgres com RLS, Storage).
- **Server logic**: `createServerFn` do TanStack Start (padrão). Edge Functions apenas para webhooks/integrações externas.
- **Pagamentos**: Asaas (via módulo Bella Pay).

Qualquer troca de tecnologia exige aprovação do Product Owner + Tech Lead.

### 2.2 Estrutura de pastas
```
src/
├── components/          # UI compartilhada
│   ├── ui/              # shadcn/ui primitives (não editar diretamente)
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
docs/
└── BLUEPRINT.md         # Este documento
supabase/
└── migrations/          # Toda alteração de banco
```

### 2.3 Organização por módulos (features)
- Cada domínio de negócio vive em `src/features/<feature>/`.
- **Dependência unidirecional**: `routes → features → components/hooks/services → lib/types`.
- Um módulo **nunca** importa diretamente de outro módulo. Se precisar compartilhar, promover para `components/`, `hooks/`, `services/` ou `lib/`.
- Cada feature expõe sua API pública em `index.ts`.

### 2.4 Componentes compartilhados
Antes de criar qualquer componente, verificar `src/components/ui/` e `src/components/layout/`. Já disponíveis: Button, Input, Card, Badge, Dialog, Sheet, Select, Table, Sidebar, Topbar, Toaster, Form, Tabs.
**Proibido duplicar componentes.**

### 2.5 Convenções de nomenclatura
- Arquivos: `kebab-case.ts` / `kebab-case.tsx`.
- Componentes React: `PascalCase`.
- Hooks: `useCamelCase`, arquivo `use-camel-case.ts`.
- Services: `<dominio>.service.ts`, funções em `camelCase`.
- Types: `PascalCase`; constantes globais em `SCREAMING_SNAKE_CASE`.
- Rotas (URLs): **português**, kebab-case (`/fornecedores`, `/clientes`, `/estoque`).
- Tabelas do banco: **inglês**, `snake_case`, plural (`customers`, `product_categories`).

---

## 3. Design System

### 3.1 Paleta oficial
Tokens semânticos em `src/styles.css`. **Nunca hardcoded**, **nunca laranja/dourado**.

| Token | Light | Dark |
|---|---|---|
| `--primary` | `#2563EB` | `#3B82F6` |
| `--primary-hover` | `#1D4ED8` | `#2563EB` |
| `--background` | `#F8FAFC` | `#0B1220` |
| `--sidebar` / `--card` | `#FFFFFF` | `#0F172A` |
| `--border` | `#E2E8F0` | `rgb(255 255 255 / 8%)` |
| `--success` | `#16A34A` | `#22C55E` |
| `--warning` | `#F59E0B` | `#F59E0B` |
| `--destructive` | `#DC2626` | `#EF4444` |

### 3.2 Tipografia
- Sans: **Inter** (400/500/600/700).
- Mono: **JetBrains Mono** (400/500).
- Headings: `font-weight: 600`, `letter-spacing: -0.02em`.
- Body: `letter-spacing: -0.01em`, antialiased.

### 3.3 Espaçamentos
- Escala Tailwind padrão (base 4px).
- Cards com padding generoso (`p-6` mínimo).
- Muito espaço em branco — nunca comprimir informação.
- Raio padrão: `--radius: 0.625rem` (~10px).

### 3.4 Componentes reutilizáveis
Consumir sempre de `src/components/ui/`. Variantes via `cva`. Casos novos → **estender a variante**, nunca criar componente paralelo.

### 3.5 Responsividade
- Mobile-first.
- Breakpoints Tailwind: `sm`, `md`, `lg`, `xl`, `2xl`.
- Sidebar colapsa em `< md`.
- Tabelas: scroll horizontal em mobile ou versão "card list" quando aplicável.

### 3.6 Princípios de UX/UI
- **Clareza > densidade**.
- **Menos cliques** para tarefas frequentes.
- Feedback imediato (toasts, loading, skeletons).
- Mesma tarefa se faz do mesmo jeito em qualquer módulo.
- Bella disponível de forma discreta em todos os módulos, sem invadir o fluxo.

---

## 4. Banco de Dados

### 4.1 Arquitetura Supabase
- Postgres gerenciado, com Auth, RLS e Storage.
- Cliente browser: `@/integrations/supabase/client`.
- Cliente server (autenticado): middleware `requireSupabaseAuth`.
- Cliente admin: `@/integrations/supabase/client.server` **apenas** em server-only, para webhooks/admin.

### 4.2 Multiempresa (tenant)
- Toda tabela de negócio possui `company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE`.
- Toda RLS filtra por `company_id` do usuário autenticado.
- Nenhum dado cruza empresas — nem em queries, nem em Storage, nem em relatórios.

### 4.3 Auth
- Supabase Auth (email/senha + reset).
- Sessão persistida via cliente Supabase (SPA) e cookies `@supabase/ssr` (SSR).
- Rota protegida: subtree `src/routes/_authenticated/` com guard.

### 4.4 RLS
- **Sempre habilitado** em qualquer tabela pública.
- Policies escopo `auth.uid()` → `company_id` do usuário.
- Roles em tabela separada `user_roles` + função `has_role` `SECURITY DEFINER`. **Nunca** roles em `profiles`/`users`.

### 4.5 Storage
- Buckets privados por padrão.
- Nome de arquivo prefixado por `company_id/`.
- Policies de Storage também escopadas por `company_id`.

### 4.6 Buckets
- `product-images` — imagens de produtos (privado, escopo por empresa).
- Novos buckets seguem o mesmo padrão: privados, prefixo `company_id/`, policies escopadas.

### 4.7 Convenções de tabelas
- Nome: inglês, `snake_case`, plural.
- Colunas obrigatórias: `id UUID PK default gen_random_uuid()`, `company_id`, `created_at`, `updated_at`.
- Trigger `update_updated_at_column` em toda tabela mutável.
- Enums Postgres para status/tipos fechados.
- Índices em toda coluna usada em filtro/join/ordenação frequente.

### 4.8 Convenções de migrations
Toda migration segue **exatamente** esta ordem:
1. `CREATE TABLE public.<nome> (...)`
2. `GRANT` para `authenticated` e `service_role` (e `anon` apenas se houver policy pública).
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
4. `CREATE POLICY ...`.
5. Índices e triggers.

**Proibido**: `DROP TABLE`, `DROP COLUMN` e alterações destrutivas sem plano de migração de dados aprovado.

---

## 5. Módulos do Sistema

Legenda de status: 🟢 pronto · 🟡 em andamento · ⚪ planejado.

### 5.1 Dashboard  🟢
- **Objetivo**: visão executiva com saudação, KPIs, próxima ação, alertas, insights e ações rápidas.
- **Dependências**: dados agregados dos demais módulos.
- **Próximas etapas**: conectar KPIs reais conforme módulos avançam.

### 5.2 Bella IA  ⚪
- **Objetivo**: copiloto transversal — sugestões, resumos, ações rápidas por contexto.
- **Dependências**: todos os módulos como fontes de contexto; gateway de IA.
- **Próximas etapas**: definir superfícies de entrada (Topbar + inline em cada módulo).

### 5.3 Produtos  🟢
- **Objetivo**: CRUD com precificação, imagens, estoque inicial, tags e status.
- **Dependências**: Categorias, Fornecedores, Storage.
- **Próximas etapas**: variações, kits, ficha técnica.

### 5.4 Categorias  🟢
- **Objetivo**: taxonomia hierárquica (pai/subcategorias) com cor, ícone, status.
- **Dependências**: Produtos.
- **Próximas etapas**: reordenação drag-and-drop.

### 5.5 Estoque  🟢
- **Objetivo**: movimentações (entrada, saída, ajuste), histórico, alertas de mínimo.
- **Dependências**: Produtos.
- **Próximas etapas**: transferência entre locais, inventário cíclico.

### 5.6 Compras  ⚪
- **Objetivo**: ordens de compra, recebimento, custo médio, integração com Estoque e Financeiro.
- **Dependências**: Fornecedores, Produtos, Estoque, Financeiro.
- **Próximas etapas**: modelagem de OC e fluxo de aprovação.

### 5.7 Fornecedores  🟢
- **Objetivo**: cadastro completo (fiscais, contato, endereço, condição de pagamento) + histórico.
- **Dependências**: Produtos, Compras.
- **Próximas etapas**: avaliação de fornecedor, contratos.

### 5.8 Clientes (CRM)  🟢
- **Objetivo**: cadastro completo, interações em timeline, segmentação, oportunidades.
- **Dependências**: Vendas, Financeiro, Marketing, Bella Pay, Bella IA.
- **Próximas etapas**: oportunidades reais, pipeline visual, automações.

### 5.9 Vendas  ⚪
- **Objetivo**: pedidos, orçamentos, PDV leve, integração com Estoque, Financeiro e Bella Pay.
- **Dependências**: Produtos, Estoque, Clientes, Financeiro, Bella Pay.
- **Próximas etapas**: modelagem de pedido e fluxo de faturamento.

### 5.10 Financeiro  ⚪
- **Objetivo**: contas a pagar/receber, fluxo de caixa, conciliação, categorias financeiras.
- **Dependências**: Compras, Vendas, Bella Pay.
- **Próximas etapas**: modelagem de contas e categorias.

### 5.11 Bella Pay (Asaas)  ⚪
- **Objetivo**: cobrança nativa (boleto, Pix, cartão) integrada a Asaas dentro do Financeiro/Vendas.
- **Dependências**: Financeiro, Vendas, Clientes.
- **Próximas etapas**: onboarding Asaas, webhooks, conciliação automática.

### 5.12 Agenda  ⚪
- **Objetivo**: compromissos, tarefas, lembretes vinculados a clientes/oportunidades.
- **Dependências**: Clientes, Usuários.
- **Próximas etapas**: modelagem de eventos e recorrência.

### 5.13 Marketing  ⚪
- **Objetivo**: campanhas simples (e-mail/WhatsApp), segmentação de clientes.
- **Dependências**: Clientes, Bella IA.
- **Próximas etapas**: definir provedores e templates.

### 5.14 Relatórios  ⚪
- **Objetivo**: relatórios operacionais e gerenciais por módulo + consolidados.
- **Dependências**: todos os módulos.
- **Próximas etapas**: definir catálogo inicial de relatórios.

### 5.15 Configurações  🟡
- **Objetivo**: dados da empresa, preferências, integrações, tema, faturamento do SaaS.
- **Dependências**: Auth, Usuários e Permissões.
- **Próximas etapas**: telas de perfil da empresa, integrações e preferências.

### 5.16 Usuários e Permissões  ⚪
- **Objetivo**: convidar usuários, atribuir papéis, controlar acesso por módulo.
- **Dependências**: Auth, RLS, `user_roles`.
- **Próximas etapas**: modelagem de papéis (owner, admin, operator, viewer) e telas de gestão.

---

## 6. Fluxo Oficial de Desenvolvimento

Toda alteração — feature nova, ajuste ou correção — segue **obrigatoriamente**:

1. **Product Owner analisa** — valor, escopo, prioridade, sprint, aprovação/adiamento.
2. **Tech Lead planeja** — módulos afetados, arquivos a alterar, riscos, dependências, plano.
3. **Implementação** — apenas o escopo aprovado, seguindo padrões deste blueprint.
4. **QA revisa** — checklist da seção 10, testes de regressão nos módulos vizinhos.
5. **Aprovação** — só entra em produção após QA aprovar.
6. **Publicação** — deploy, sincronização com GitHub e atualização da documentação.

Nenhuma etapa pode ser pulada. Alterações "rápidas" também seguem o fluxo — em versão condensada, mas registrada.

---

## 7. Regras de Engenharia

- **Não alterar módulos fora do escopo** solicitado.
- **Sempre reutilizar componentes existentes** — verificar `src/components/` antes de criar.
- **Nunca duplicar componentes**, telas, cadastros ou fluxos.
- **Toda alteração de banco via migration** — nunca ad-hoc no painel.
- **Preservar a arquitetura** (features isoladas, dependência unidirecional).
- **Preservar o Design System** — sem cores hardcoded, sem fontes novas, sem tokens paralelos.
- **Preservar autenticação** — não mexer em Auth, guards ou fluxo de sessão sem aprovação.
- **Preservar integrações** — Supabase, Asaas, Bella e demais integrações são intocáveis fora de escopo específico.
- **Alterações em arquivos compartilhados** (providers, layout, sidebar, `ui/`, `lib/`, `config/`) **devem ser justificadas** e aprovadas pelo Tech Lead.
- **Nunca** expor `service_role` no cliente.
- **Nunca** armazenar roles em `profiles`.
- **Nunca** usar `index` como `key` em listas.
- **Nunca** implementar múltiplos módulos na mesma alteração.
- Se >10 arquivos serão modificados, **parar e confirmar** antes.

---

## 8. Padrões de Código

### React
- Componentes funcionais + hooks. Sem classes.
- Sem loops de renderização. Sem mutação de props.
- Portais Radix e listas: keys estáveis e únicas.

### TypeScript
- `strict: true`. Sem `any` implícito. Sem `@ts-ignore` sem justificativa.
- Tipos derivados de Zod schemas quando aplicável (`z.infer<>`).

### Vite
- Configuração em `vite.config.ts` intocada fora de necessidade real.
- Sem `ssr.external` no ambiente SSR do Worker.
- Imports resolvem em tempo de build — todo arquivo/pacote importado deve existir.

### Tailwind
- v4 com tokens em `src/styles.css`.
- **Nunca** classes de cor hardcoded (`bg-blue-500`, `text-white`). Usar tokens semânticos (`bg-primary`, `text-foreground`).
- `cn()` para composição condicional de classes.

### shadcn/ui
- Primitives em `src/components/ui/` — não editar diretamente para casos pontuais.
- Estender via variantes (`cva`) e composição.

### React Query
- Leitura padrão: `queryClient.ensureQueryData` no loader + `useSuspenseQuery` no componente.
- Escrita: `useMutation` + `invalidateQueries`.
- Query keys tipadas por feature.

### React Hook Form
- Padrão para todo formulário.
- Integração via `zodResolver`.
- Nunca controlar campos manualmente com `useState` quando o form já cobre.

### Zod
- Schema único por entidade quando possível.
- Validação em: (a) formulário e (b) input de server function.

### Supabase
- Cliente browser para SPA, `requireSupabaseAuth` para server functions autenticadas.
- `service_role` **apenas** em módulos server-only, nunca em código de cliente.
- Toda tabela nova: RLS habilitada + policies escopadas por `company_id`.

---

## 9. Roadmap

### ✅ Concluído
- Fundação: Auth, Onboarding, Layout autenticado, Sidebar, Dashboard inicial.
- Produtos, Categorias, Estoque, Fornecedores, Clientes (CRM).
- Design System v1 + documentação oficial (este blueprint).

### 🟡 Em desenvolvimento
- Configurações (perfil da empresa, preferências).
- Refinamentos de UX nos módulos entregues.

### ⏭️ Próxima Sprint
- Vendas (pedidos e orçamentos).
- Compras (ordens de compra).
- Financeiro básico (contas a pagar/receber, fluxo de caixa).
- Usuários e Permissões (papéis + gestão).

### 📦 Backlog
- Bella Pay (Asaas).
- Bella IA (superfícies e ações).
- Agenda.
- Marketing.
- Relatórios avançados.
- Variações/kits de produto.
- Multi-locais de estoque.
- App mobile.
- API pública.

---

## 10. Critérios de Qualidade

Checklist **obrigatório** antes de considerar uma sprint concluída:

- [ ] **Build aprovado** (`vite build` sem erros).
- [ ] **TypeScript sem erros** (`tsgo`).
- [ ] **ESLint sem erros** (warnings justificados).
- [ ] **Console sem erros** em runtime (dev e build).
- [ ] **Responsividade validada** em mobile, tablet e desktop.
- [ ] **Sem regressões** nos módulos vizinhos (smoke test manual).
- [ ] **QA aprovado** formalmente.
- [ ] **GitHub sincronizado** (branch principal atualizada).
- [ ] **Documentação atualizada** (este blueprint reflete o estado real).

Sem todos os itens marcados, a sprint **não é considerada concluída**.

---

_Este blueprint é vivo. Atualizações seguem o fluxo da seção 6._
