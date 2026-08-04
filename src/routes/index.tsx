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
{`DIAGNÓSTICO TÉCNICO — SPRINT BELLA FINANCEIRA

1. CONEXÃO BELLA FINANCEIRA:
   - STATUS: Concluído.
   - COMPONENTE: BellaDailyBriefCard e BellaInsightBuilder atualizados para o módulo finance.
   - DADOS: Snapshot operacional via useBellaHomeSnapshot (Event Registry).
   - INFRAESTRUTURA: Integração total com finance.invoice.overdue e finance.cashflow.negative.

2. ESCOPO DE DADOS (FINANCEIRO):
   - CONTAS VENCIDAS: Exibição quantitativa de invoices em atraso.
   - VENCENDO HOJE: Filtro temporal sobre os payloads de invoices para destaque diário.
   - FLUXO DE CAIXA: Detecção de caixa negativo e projeção baseada em eventos.
   - MAIOR DESPESA: Insight gerado a partir do detector finance.expense.elevated.
   - RESUMO DIÁRIO: Inserção dinâmica de alertas financeiros críticos no brief principal.

3. ARQUIVOS ALTERADOS:
   - src/features/bella-ai/dashboard/BellaDailyBrief.ts (Suporte a vencimentos de hoje)
   - src/features/bella-ai/dashboard/BellaInsightBuilder.ts (Insight de despesas elevadas)
   - src/routes/index.tsx (Diagnóstico da Sprint Financeira)

4. VALIDAÇÃO:
   - Nenhuma nova regra de negócio criada.
   - Nenhuma alteração em tabelas ou serviços de base.
   - Utilização exclusiva da infraestrutura de eventos e detectores existentes.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
