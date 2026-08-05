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
{`AUDITORIA E PADRONIZAÇÃO DE UI/UX — PADRÃO SAAS PREMIUM (ULTRA-CLEAN)

O sistema atual está com poluição visual por excesso de cards, caixas aninhadas, bordas escuras e layouts poluídos. Queremos transformar o NexOS em um produto comercial de alto nível (estilo Stripe / Linear / Vercel), priorizando simplicidade, respiro e facilidade de uso.

EXECUTE UMA AUDITORIA GLOBAL DE COMPONENTES E APLIQUE O SEGUINTE DESIGN SYSTEM:

1. COMPONENTE DE TELA BASE (CleanPageLayout):
   - Crie/Padronize um wrapper único para TODAS as páginas.
   - TOPO: Título em destaque + Metricas resumidas em TEXTO DISCRETO na mesma linha (Ex: "Clientes • 17 cadastrados • Ticket Médio R$ 83,22"), sem cards retangulares em volta.
   - AÇÃO: Botão de ação primária (+ Novo) sempre no canto superior direito.

2. NAVEGAÇÃO LIMPA POR ABAS:
   - Toda página deve ter apenas 2 ou 3 abas simples no topo:
     * Aba 1: "Visão Geral" (Apenas a busca/filtros + a Tabela Principal).
     * Aba 2: "Insights & IA" (Onde ficarão guardados os painéis da Bella, gráficos e diagnósticos).

3. PADRONIZAÇÃO DE TABELAS (EnterpriseTable):
   - Remova bordas externas pesadas, sombras e fundos contrastantes.
   - Use espaçamento interno elegante (py-3 px-4).
   - Nome/Item Principal em negrito (font-medium), e dados secundários (e-mail, CPF, telefone) agrupados logo abaixo em texto menor e cinza (text-xs text-muted-foreground).
   - Status apenas como uma bolinha sutil com badge suave.

4. LIMPEZA VISUAL (ZERO RUÍDO):
   - Remova qualquer "card dentro de card".
   - Limite a 1 única tabela por aba.
   - A página NÃO pode exigir scroll na Aba 1 em telas normais.

Audite todos os arquivos de rota em /pages (clientes, estoque, compras, vendas, financeiro, fiscal, fornecedores) e aplique este CleanPageLayout unificado em cada uma delas. Mostre o resumo das telas ajustadas.`}
          </pre>
        </div>
      </div>
    </div>
  );
}