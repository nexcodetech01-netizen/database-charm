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
{`DIAGNÓSTICO TÉCNICO — SPRINT BELLA INFORMA

1. CONEXÃO BELLA INFORMA:
   - STATUS: Concluído.
   - COMPONENTE: BellaDailyBriefCard integrado ao Dashboard.
   - DADOS: Snapshot reativo via useBellaHomeSnapshot (Event Registry).
   - INFRAESTRUTURA: Reuso total de buildDailyBrief e EventEngine.

2. ESCOPO DE DADOS:
   - FINANCEIRO: Detectado via eventos finance.invoice.overdue e cashflow.
   - ESTOQUE: Detectado via eventos inventory.min_stock_reached.
   - VENDAS: Detectado via eventos sales.above_average / sales.decline.
   - MERCADO LIVRE: Alerta de pedidos pendentes integrado ao resumo.
   - ALERTAS: Integrados dinamicamente no resumo textual.

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
