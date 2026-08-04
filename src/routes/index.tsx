import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    // 1. Executar supabase.auth.getSession() (via getUser para segurança extra do token)
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      // 2. Se existir sessão válida: Redirecionar para o Dashboard
      throw redirect({ to: "/dashboard" });
    }

    // 3. Se NÃO existir sessão: Redirecionar para o fluxo de Login
    throw redirect({ to: "/auth" });
  },
  component: () => (
    <div className="min-h-screen bg-background p-8 font-mono text-xs leading-relaxed whitespace-pre-wrap max-w-4xl mx-auto">
      EPIC RC.FINAL — ENTERPRISE RELEASE AUDIT

      MODO READ ONLY

      É EXPRESSAMENTE PROIBIDO:

      - alterar qualquer arquivo;
      - criar arquivos;
      - remover arquivos;
      - alterar banco;
      - alterar migrations;
      - alterar policies;
      - alterar RLS;
      - alterar UI;
      - alterar componentes;
      - alterar hooks;
      - alterar services;
      - alterar testes;
      - alterar configurações.

      Esta auditoria é EXCLUSIVAMENTE de leitura.

      NÃO IMPLEMENTAR ABSOLUTAMENTE NADA.

      ====================================================

      OBJETIVO

      Realizar uma auditoria completa do NexOS ERP.

      Descobrir:

      - tudo o que já existe;
      - tudo o que falta;
      - bugs;
      - riscos;
      - inconsistências;
      - funcionalidades incompletas;
      - código morto;
      - dívidas técnicas;
      - gargalos;
      - oportunidades de melhoria.

      Agir como um CTO preparando o produto para RELEASE.

      ====================================================

      FASE 1

      INVENTÁRIO COMPLETO

      Mapear TODOS os módulos.

      Exemplo:

      Dashboard

      Bella

      Financeiro

      Fiscal

      Produtos

      Clientes

      Compras

      Vendas

      PDV

      Caixa

      Relatórios

      WhatsApp

      Meta

      Mercado Livre

      Shopee

      Integrações

      Usuários

      Permissões

      Configurações

      BI

      Automações

      API

      etc.

      Para cada módulo informar:

      Status:

      Não iniciado

      Parcial

      Completo

      Enterprise

      ====================================================

      FASE 2

      FUNCIONALIDADES

      Para cada módulo listar:

      Funcionalidades existentes

      Funcionalidades incompletas

      Funcionalidades planejadas

      Funcionalidades duplicadas

      Funcionalidades mortas

      ====================================================

      FASE 3

      BUG HUNT

      Procurar:

      TODO

      FIXME

      HACK

      XXX

      console.log

      console.error

      alert()

      comentários temporários

      código comentado

      flags de desenvolvimento

      mock

      fake

      placeholder

      hardcoded

      valores fixos

      feature flags esquecidas

      rotas órfãs

      componentes órfãos

      hooks órfãos

      imports mortos

      ====================================================

      FASE 4

      ARQUITETURA

      Auditar:

      estrutura

      módulos

      dependências

      acoplamento

      duplicações

      camadas

      Design System

      SaleEngine

      Bella

      Providers

      Context

      Hooks

      ====================================================

      FASE 5

      PERFORMANCE

      Auditar:

      Bundle

      Lazy

      Code Splitting

      React.memo

      useMemo

      useCallback

      Queries

      Supabase

      Renderizações

      Loading

      Cache

      ====================================================

      FASE 6

      SEGURANÇA

      Reexecutar o Enterprise Security Gate.

      Verificar novamente:

      Multi Tenant

      RLS

      Policies

      RPC

      SECURITY DEFINER

      Storage

      Server Functions

      JWT

      Auth

      Preview

      ====================================================

      FASE 7

      BANCO

      Auditar:

      Tabelas

      Índices

      Views

      Triggers

      Functions

      RPCs

      Constraints

      FK

      Migrações

      ====================================================

      FASE 8

      UX

      Auditar:

      Dashboard

      Bella

      PDV

      Produtos

      Clientes

      Financeiro

      Fiscal

      Compras

      Vendas

      Relatórios

      Configurações

      ====================================================

      FASE 9

      TESTES

      Mapear:

      Cobertura

      Módulos sem testes

      Testes duplicados

      Testes frágeis

      ====================================================

      FASE 10

      DOCUMENTAÇÃO

      Verificar:

      README

      Arquitetura

      Design System

      Roadmap

      Documentação técnica

      APIs

      ====================================================

      FASE 11

      RELEASE

      Responder:

      O sistema está pronto para produção?

      O que impede um lançamento?

      Quais são os riscos?

      Quais bugs são críticos?

      Quais bugs são médios?

      Quais bugs são cosméticos?

      ====================================================

      FASE 12

      ROADMAP FINAL

      Gerar um roadmap dividido em:

      CRÍTICO

      ALTO

      MÉDIO

      BAIXO

      Separar:

      Correções

      Performance

      UX

      Novas funcionalidades

      Refatorações

      ====================================================

      FASE 13

      NOTAS

      Dar nota de 0 a 10 para:

      Arquitetura

      Código

      Design System

      UI

      UX

      Performance

      Segurança

      Financeiro

      Fiscal

      PDV

      Bella

      Produtos

      Clientes

      Compras

      Vendas

      Caixa

      Integrações

      Testes

      Documentação

      Escalabilidade

      Manutenibilidade

      ====================================================

      FASE 14

      ENTERPRISE SCORE

      Gerar nota geral.

      Explicar detalhadamente.

      ====================================================

      FASE 15

      CHECKLIST DE RELEASE

      Gerar checklist com:

      ☐ obrigatório

      ☐ recomendado

      ☐ opcional

      ====================================================

      IMPORTANTE

      Não implementar.

      Não alterar.

      Não alterar.

      Não sugerir código.

      Somente auditoria técnica.

      O relatório deve ser extremamente detalhado.

      Agir como uma empresa externa contratada para validar um ERP antes do lançamento.
    </div>
  ),

});
