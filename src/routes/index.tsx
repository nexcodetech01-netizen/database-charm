import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isPreviewHostname } from "@/hooks/version-check.utils";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // No servidor (SSR), o process.env.LOVABLE_PREVIEW_HOST está disponível se estivermos no ambiente de preview.
    const isPreview = Boolean(process.env['LOVABLE_PREVIEW_HOST']);
    const host = typeof window !== "undefined" 
      ? window.location.hostname 
      : (process.env['LOVABLE_PREVIEW_HOST'] || "");

    if (isPreview || isPreviewHostname(host)) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/auth" });
    }
  },
  component: IndexComponent,
});

function IndexComponent() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (typeof window !== "undefined" && isPreviewHostname(window.location.hostname)) {
      const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate({ to: "/dashboard" });
        } else {
          navigate({ to: "/auth" });
        }
      };
      void checkSession();
    }
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground">
      <div className="max-w-4xl w-full space-y-8">
        <div className="p-8 border rounded-xl bg-card shadow-2xl space-y-6 font-mono text-sm leading-relaxed overflow-auto max-h-[80vh]">
          <pre className="whitespace-pre-wrap">
{`NEXOS ERP v1.0

RELEASE CANDIDATE

AUDITORIA GERAL DO SAAS

MODO:

READ ONLY

SOMENTE LEITURA

==================================================

É PROIBIDO

- alterar arquivos
- alterar banco
- alterar migrations
- alterar SQL
- alterar RPCs
- alterar APIs
- alterar Services
- alterar Engines
- alterar React
- alterar componentes
- alterar hooks
- alterar providers
- alterar queries
- alterar regras
- alterar configurações
- instalar dependências
- corrigir problemas

Esta auditoria é exclusivamente de certificação.

==================================================

OBJETIVO

Auditar absolutamente todo o NexOS ERP.

Quero um diagnóstico profissional de arquitetura, código, banco, UX, performance, segurança e qualidade.

Não quero sugestões genéricas.

Quero fatos encontrados durante a leitura do projeto.

==================================================

FASE 1

ARQUITETURA

Auditar

- organização das features
- modularização
- dependências
- imports
- barrels
- acoplamento
- responsabilidade dos módulos
- engines
- services
- providers
- selectors
- hooks
- adapters
- composição
- circular dependencies
- code smells

Dar nota.

==================================================

FASE 2

BANCO

Auditar

- tabelas
- relacionamentos
- foreign keys
- índices
- triggers
- RPCs
- funções
- constraints
- RLS
- policies
- views
- cron jobs
- secrets
- storage

Verificar inconsistências.

Dar nota.

==================================================

FASE 3

PRODUTOS

Auditar

cadastro

edição

categorias

imagens

SKU

importação

exportação

estoque

marketplace

duplicações

fluxos

nota.

==================================================

FASE 4

ESTOQUE

Auditar

ledger

inventário

reconciliação

movimentações

compra

venda

PDV

cancelamento

devolução

reserva

saldo

nota.

==================================================

FASE 5

COMPRAS

Auditar

pedidos

recebimento

custos

fornecedores

entrada

integração

nota.

==================================================

FASE 6

VENDAS

Auditar

venda

pedido

desconto

acréscimo

cancelamento

frete

documento

PDV

integração

nota.

==================================================

FASE 7

PDV

Auditar

scanner

atalhos

UX

teclado

pagamento

NFC-e

cupom

impressão

caixa

concorrência

performance

nota.

==================================================

FASE 8

FINANCEIRO

Auditar

receber

pagar

parcelas

fluxo

DRE

baixa

estorno

conciliação

relatórios

nota.

==================================================

FASE 9

CAIXA

Auditar

abertura

fechamento

sangria

suprimento

sessão

recebimentos

PDF

nota.

==================================================

FASE 10

FISCAL

Auditar

NFe

NFCe

XML

DANFE

cancelamento

numeração

CSC

certificado

Focus

timeline

artefatos

nota.

==================================================

FASE 11

MARKETPLACE

Auditar

OAuth

refresh

cron

fila

DLQ

sincronização

estoque

preço

webhooks

Mercado Livre

nota.

==================================================

FASE 12

BELLA

Auditar

Advisor

Insights

Proactive

Providers

Summary

Selectors

Chat

Planner

Router

Dashboard

Finance

Fiscal

Inventory

Sales

Purchases

CRM

Business readiness

nota.

==================================================

FASE 13

SEGURANÇA

Auditar

JWT

RLS

Policies

Secrets

Logs

Auditoria

Service Role

Permissões

Vazamentos

nota.

==================================================

FASE 14

PERFORMANCE

Auditar

React

Memo

React Query

Bundle

Lazy Loading

Cache

Queries

Render

Re-render

Memory

nota.

==================================================

FASE 15

QUALIDADE

Auditar

Duplicações

Código morto

Arquivos órfãos

TODO

FIXME

Complexidade

Arquivos gigantes

Imports

Padrões

Consistência

nota.

==================================================

FASE 16

UX

Auditar

Desktop

Notebook

Tablet

Mobile

Scanner

Teclado

Fluxo

Menus

Consistência

Acessibilidade

nota.

==================================================

FASE 17

TESTES

Auditar

Cobertura

Unitários

Integração

Render

Regressão

Arquivos

Módulos

nota.

==================================================

RELATÓRIO FINAL

Quero:

1. Resumo executivo

2. Mapa completo do sistema

3. Mapa da arquitetura

4. Mapa dos módulos

5. Fluxo dos motores

6. Fluxo Bella IA

7. Dependências

8. Duplicações

9. Código morto

10. Problemas encontrados

Classificar

P0

P1

P2

P3

P4

11. Pontos fortes

12. Pontos fracos

13. Riscos

14. Escalabilidade

15. Segurança

16. Performance

17. Manutenibilidade

18. Nota de cada módulo

19. Nota geral

20. Veredito

Escolher apenas um:

🟢 APROVADO PARA PRODUÇÃO

🟡 PRODUÇÃO COM RESSALVAS

🔴 NÃO APROVADO

==================================================

IMPORTANTE

Não corrigir absolutamente nada.

Não modificar nenhum arquivo.

Não alterar nenhuma linha de código.

Não gerar patches.

Não gerar migrations.

Não gerar SQL.

Somente auditar.

A auditoria deve ser baseada exclusivamente na leitura do projeto e apresentar apenas evidências encontradas.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
