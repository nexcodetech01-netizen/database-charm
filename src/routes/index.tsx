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
{`DIAGNÓSTICO TÉCNICO — SPRINT BELLA ESTOQUISTA

1. CONEXÃO BELLA ESTOQUISTA:
   - STATUS: Concluído.
   - COMPONENTE: BellaDailyBriefCard e BellaInsightBuilder atualizados.
   - DADOS: Snapshot operacional via useBellaHomeSnapshot (Event Registry).
   - INFRAESTRUTURA: Integração total com inventory.slow_moving e inventory.min_stock.

2. ESCOPO DE DADOS (ESTOQUE):
   - ESTOQUE MÍNIMO: Exibição prioritária de itens críticos.
   - SEM GIRO (SLOW MOVING): Identificação de produtos e tempo sem venda.
   - VALOR IMOBILIZADO: Cálculo proporcional do custo vs saldo em itens parados.
   - RESUMO DIÁRIO: Inserção dinâmica de alertas financeiros do estoque no brief.
   - INSIGHTS: Alertas de capital de giro retido em estoque estagnado.


3. ARQUIVOS ALTERADOS:
   - src/routes/_authenticated/dashboard.tsx (Injeção do BellaDailyBriefCard e useBellaHomeSnapshot)
   - src/features/bella-ai/dashboard/BellaDailyBrief.ts (Adicionado suporte a pedidos ML e limite de prioridades)

4. VALIDAÇÃO:
   - Nenhuma nova regra de negócio criada.
   - Nenhuma alteração em tabelas ou banco de dados.
   - Mantida a estrutura de permissões e hooks existentes.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
