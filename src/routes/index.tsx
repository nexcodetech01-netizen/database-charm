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
{`DIAGNÓSTICO TÉCNICO — SPRINT BELLA COMERCIAL

1. CONEXÃO BELLA COMERCIAL:
   - STATUS: Concluído.
   - COMPONENTE: BellaDailyBriefCard integrado à infraestrutura comercial legada.
   - DADOS: Consumo de eventos sales.goal_reached, sales.decline e sales.average_ticket.drop.
   - MÉTRICAS: Conexão determinística com faturamento e ticket médio derivados do Event Registry.

2. ESCOPO DE DADOS (COMERCIAL):
   - FATURAMENTO DIA: Mapeado via payload de eventos de venda aprovada/faturada.
   - TICKET MÉDIO: Exibição baseada em alertas de variação (ticket médio caiu).
   - MAIS VENDIDO/LUCRATIVO: Identificação via payloads de eventos prioritários.
   - RECOMENDAÇÕES: Injeção de closingLine contextual ( incentivos vs. revisões de preço).

3. ARQUIVOS ALTERADOS:
   - src/features/bella-ai/dashboard/BellaDailyBrief.ts (Lógica de recomendações comerciais)
   - src/routes/index.tsx (Atualização do Diagnóstico Técnico)

4. VALIDAÇÃO:
   - Nenhuma nova regra de negócio ou tabela criada.
   - Reaproveitamento total dos detectores de vendas (sales.detectors.ts).
   - Estabilidade SSR preservada.`}
          </pre>
        </div>
      </div>
    </div>
  );
}