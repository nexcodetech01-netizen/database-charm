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
{`DIAGNÓSTICO TÉCNICO — SPRINT BELLA CONTADORA

1. CONEXÃO BELLA CONTADORA:
   - STATUS: Concluído.
   - COMPONENTE: BellaDailyBriefCard e BellaInsightBuilder integrados.
   - DADOS: Consumo de eventos fiscal.* e finance.revenue.*.
   - MÉTRICAS: Lucro Bruto, Líquido e Ponto de Equilíbrio derivados de indicadores de performance financeira.

2. ESCOPO DE DADOS (CONTADORA):
   - DRE RESUMIDA: Mapeada via agregação de eventos de faturamento e despesas elevadas.
   - ALERTAS CONTÁBEIS: Injeção de eventos fiscal.nfe.rejected e finance.expense.out_of_pattern.
   - MARGEM: Cálculo determinístico baseado em variações de receita reportadas pelo registry.

3. ARQUIVOS ALTERADOS:
   - src/features/bella-ai/dashboard/BellaDailyBrief.ts (Lógica contábil/fiscal)
   - src/features/bella-ai/dashboard/BellaInsightBuilder.ts (Novas regras de insights contábeis)
   - src/routes/index.tsx (Atualização do Diagnóstico Técnico)

4. VALIDAÇÃO:
   - Nenhuma nova tabela ou regra de cálculo criada.
   - Uso integral da infraestrutura legada (BellaEventRegistry).
   - Estabilidade SSR e performance mantidas.`}
          </pre>
        </div>
      </div>
    </div>
  );
}