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
{`DIAGNÓSTICO TÉCNICO BELLA IA - PARTE 1: ARQUITETURA E ESPECIALIZAÇÕES

1. Módulos Atuais da Bella:
A Bella IA não é um chatbot genérico, mas uma camada de inteligência estruturada sobre o Motor Comercial V2. Seus módulos principais são:
- Accounting AI: O core da inteligência, processando dados financeiros, fiscais e contábeis.
- Conversational Layer: Interface via WhatsApp Cloud API e painel interno.
- Proactive Engine: Sistema de notificações baseado em eventos do banco de dados.

2. Bella Contadora (Accounting Advisor):
Status: 95% Concluído.
Funcionalidades:
- Análise de DRE em tempo real.
- Consultoria sobre margem de contribuição e ponto de equilíbrio.
- Identificação de gargalos financeiros (despesas fixas acima da média).

3. Bella Financeira:
Status: 90% Concluído.
Funcionalidades:
- Monitoramento de fluxo de caixa projetado (7/15/30 dias).
- Alertas automáticos de contas vencidas e a vencer.
- Gestão de inadimplência com indicadores de atraso por cliente.

4. Bella Comercial:
Status: 60% Concluído (Homologação).
Funcionalidades:
- Análise de performance por canal (Loja Física vs. Mercado Livre).
- Sugestão de precificação baseada em metas de margem líquida.
- Ranking de produtos "Curva A" por rentabilidade (não apenas volume).

Aguardando próxima parte.`}
</pre>
        </div>
      </div>
    </div>
  );
}
