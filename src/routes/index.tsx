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
      <div className="max-w-4xl w-full space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">BOM DIA</h1>
        <div className="p-8 border rounded-xl bg-card shadow-2xl space-y-6 font-mono text-sm text-left leading-relaxed overflow-auto max-h-[80vh]">
          <pre className="whitespace-pre-wrap">
{`DIAGNÓSTICO TÉCNICO BELLA IA - PARTE 3: VISÃO GERAL DAS ESPECIALIZAÇÕES

1. Bella IA (Master):
Status: 100% (Arquitetura Core e Orquestração).
Especialização: Inteligência central que gerencia os agentes subjacentes e integra todos os módulos do ERP.

2. Bella Contadora:
Status: 95% Concluído.
Especialização: Análise de DRE, Advisor de lucro, Ponto de Equilíbrio e Auditoria contábil.

3. Bella Financeira:
Status: 90% Concluído.
Especialização: Fluxo de caixa projetado, Gestão de recebíveis e Alertas de inadimplência.

4. Bella Comercial:
Status: 60% Concluído (Homologação).
Especialização: Performance por canal, Curva ABC de rentabilidade e Conversão de vendas.

5. Bella Estoquista:
Status: 85% Concluído.
Especialização: Monitoramento de ruptura, Sugestão de reposição e Giro de estoque.

6. Bella Fiscal:
Status: 88% Concluído.
Especialização: Auditoria de NCM/CFOP, Simulador tributário e Cruzamento de dados fiscais.

7. Bella Marketplace:
Status: 20% Concluído (Infraestrutura).
Especialização: Logs de integração ML/Shopee e Planejamento para Automação de SAC/Disputas.

Conclusão:
A plataforma Bella IA consolidou a base determinística necessária para operar como o cérebro do NexOS ERP. O Roadmap de evolução foca agora na maturidade dos agentes de Marketplace e na autonomia completa de execução.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
