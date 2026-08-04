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
{`AUDITORIA GERAL DO NEXOS (FORENSE)

MODO: READ-ONLY

PROIBIDO:

- Alterar código
- Alterar banco
- Alterar migrations
- Alterar componentes
- Alterar Home
- Alterar Dashboard
- Criar arquivos
- Corrigir bugs

OBJETIVO

Gerar um relatório completo do estado atual do NexOS.

A auditoria deve analisar TODO o sistema.

=========================
1. DASHBOARD
=========================

Informar:

- O que está implementado.
- O que está parcialmente implementado.
- O que ainda falta.

=========================
2. PDV
=========================

Informar:

- Fluxos implementados.
- Pagamento Pendente.
- Caixa.
- Impressão.
- Descontos.
- Recebimento posterior.

O que ainda falta.

=========================
3. PRODUTOS
=========================

Informar:

- Cadastro
- Fotos
- Categorias
- Marcas
- Materiais
- NCM
- GTIN
- Canais de venda

O que existe.

O que falta.

=========================
4. COMPRAS
=========================

Informar:

- Cadastro
- Recebimento
- Rateio
- Atualização de custo
- Motor Comercial V2

O que falta.

=========================
5. ESTOQUE
=========================

Informar:

- Entradas
- Saídas
- Inventário
- Ajustes
- Histórico

O que existe.

O que falta.

=========================
6. FINANCEIRO
=========================

Contas a Receber

Contas a Pagar

Fluxo de Caixa

Caixa

Conciliação

Cobranças

O que existe.

O que falta.

=========================
7. CLIENTES
=========================

Cadastro

Histórico

Limite

Crediário

Observações

O que existe.

O que falta.

=========================
8. FORNECEDORES
=========================

Informar tudo.

=========================
9. MERCADO LIVRE
=========================

Separar:

Infraestrutura

Publicação

Sincronização

Pedidos

Financeiro

Expedição

Percentual de conclusão.

=========================
10. SHOPEE
=========================

Existe alguma infraestrutura?

=========================
11. BELLA IA
=========================

Modo READ

O que existe.

O que falta.

=========================
12. FISCAL
=========================

NCM

CFOP

CSOSN

CST

Tributação

NFe

NFCe

SAT

O que existe.

O que falta.

=========================
13. RELATÓRIOS
=========================

Todos os relatórios existentes.

O que falta.

=========================
14. DASHBOARDS
=========================

Todos os dashboards existentes.

O que falta.

=========================
15. AUTOMAÇÕES
=========================

Listar todas.

=========================
16. INTEGRAÇÕES
=========================

Listar todas.

Mercado Livre

Asaas

WhatsApp

Outras.

=========================
17. SEGURANÇA
=========================

Autenticação

Permissões

Logs

Auditoria

Backup

=========================
18. BANCO DE DADOS
=========================

Listar:

Tabelas

RPCs

Triggers

Queues

Workers

Cron Jobs

=========================
19. CÓDIGO
=========================

Arquivos mais importantes.

Arquitetura.

=========================
20. ROADMAP
=========================

Separar em:

✅ Concluído

🟡 Parcial

🔴 Não iniciado

=========================
21. PRIORIZAÇÃO
=========================

Ordenar tudo por prioridade operacional.

Primeiro o que realmente impacta a operação da loja.

=========================
22. PERCENTUAL
=========================

Informar:

ERP Geral

Marketplace

Financeiro

Fiscal

Compras

PDV

Produtos

Clientes

Estoque

Dashboard

Em percentual.

=========================

Responder em formato de relatório técnico.

Não modificar absolutamente nada.

Não resumir.

Não omitir módulos.

Não registrar resultados na Home.

Responder apenas com o diagnóstico técnico.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
