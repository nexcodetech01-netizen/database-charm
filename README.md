# Nexos Design Foundry

O **Nexos Design Foundry** é uma plataforma SaaS multi-tenant robusta projetada para automação, precificação inteligente e design integrado. Desenvolvido com uma arquitetura moderna e focada em escalabilidade, o ecossistema une o potencial do **Lovable** para o frontend ágil, **Supabase** para backend e banco de dados relacional com políticas de segurança estritas (RLS), e orquestração de microsserviços para IA.

---

## 🏗️ Visão Geral da Arquitetura

O projeto adota uma abordagem de desenvolvimento orientada a componentes e fortemente tipada em **TypeScript**, estruturada da seguinte forma:

```
├── .github/workflows/   # Pipelines de CI/CD para automação de testes e deploys
├── .lovable/            # Arquivos de plano, logs de build e instruções do bot Lovable
├── docs/                # Decisões de Arquitetura (ADRs), roadmaps e regras do motor de precificação
├── public/              # Ativos estáticos, assets visuais e manifestos
├── src/                 # Código-fonte da aplicação (Componentes, Hooks, Contextos e Rotas)
├── supabase/            # Estrutura do banco de dados (Schemas, Migrations e Seed Data)
└── tests/               # Testes automatizados (E2E com Playwright e Unitários com Vitest)
```

### 🚀 Stack Tecnológica Principal
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Start / Router.
*   **Backend & DB:** Supabase (PostgreSQL), PL/pgSQL para funções internas e triggers, Row Level Security (RLS) para isolamento completo de tenants.
*   **Testes:** Playwright (Testes de ponta a ponta) e Vitest (Testes unitários de alta performance).
*   **Ambiente & Runtime:** Bun (Gerenciador de pacotes e runtime ultra-rápido).

---

## 🔒 Multi-Tenancy & Segurança (Supabase)

A segurança e o isolamento de dados são aplicados diretamente na camada do banco de dados utilizando **Row Level Security (RLS)** do PostgreSQL. 
*   **Isolamento Absoluto:** Cada tenant possui chaves e identificadores únicos que filtram as consultas nativamente.
*   **Políticas Dinâmicas:** Triggers e funções em `PL/pgSQL` gerenciam assinaturas, cotas e acessos em tempo real.

---

## 📈 Motor de Precificação & Inteligência (Pasta `docs/`)

O core de inteligência de negócios da aplicação está documentado através de **ADRs (Architecture Decision Records)** dentro do diretório `/docs`.
*   **Regras de Negócio Flexíveis:** O motor de precificação processa variáveis complexas de custo, tempo de renderização/design e margem de lucro operacional.
*   **Bella IA & Agentes:** Descritos em `AGENTS.md`, os agentes autônomos auxiliam usuários na tomada de decisão, geração de layouts e análises preditivas de conversão.

---

## 🛠️ Scripts Disponíveis e Desenvolvimento

Abaixo estão os comandos configurados via `package.json` para o ciclo de desenvolvimento:

*   `bun dev`: Inicia o servidor de desenvolvimento local com Vite.
*   `bun build`: Compila o projeto otimizado para produção.
*   `bun test`: Executa os testes unitários via Vitest.
*   `bun test:e2e`: Executa a suíte de testes de ponta a ponta com Playwright.
*   `supabase start`: Inicializa o ambiente Docker local do Supabase.

---

## 🛠️ Práticas de Contribuição e Qualidade

1. **Padrões de Código:** Uso de `Prettier` e `ESLint` configurados (`.prettierrc`, `eslint.config.js`) para garantir consistência estilística em TypeScript.
2. **Mudanças Arquiteturais:** Qualquer alteração no motor de precificação ou fluxos críticos deve ser precedida por uma nova ADR na pasta `/docs`.
3. **Testes Obrigatórios:** Funcionalidades críticas do core da aplicação necessitam de cobertura correspondente em `tests/`.
