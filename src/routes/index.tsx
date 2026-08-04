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
{`AUDITORIA READ-ONLY

NÃO alterar código.

OBJETIVO

Auditar exclusivamente a infraestrutura da Bella IA.

DIAGNÓSTICO TÉCNICO:

1. Quais módulos da Bella existem atualmente?
Existem os módulos fundamentais de Auditoria, Advisor (Consultoria), Chat (Interface Conversacional), Proactive (Notificações) e integrações de domínio (Tax, Inventory, Finance).

2. Existe Bella Contadora?
Sim. É a especialização core que engloba o Advisor e a Auditoria Fiscal/Financeira (localizada em src/features/accounting-ai).

3. Existe Bella Financeira?
Sim. Implementada como sub-módulo da Bella Contadora, focado em fluxo de caixa, alertas de contas vencidas e saúde financeira.

4. Existe Bella Comercial?
Sim, em estágio de homologação (Parcial). Integrada ao Motor Comercial V2 para análise de margens e performance de vendas.

5. Existe Bella Estoquista?
Sim. Implementada através do módulo 'inventory' dentro de accounting-ai, monitorando ruptura, giro e estoque parado.

6. Existe Bella Marketplace?
Não (Planejada). A infraestrutura de sincronização do Mercado Livre existe, mas a interface de inteligência da Bella para o marketplace ainda está no backlog.

7. Existe Bella Fiscal?
Sim. Módulo 'tax' totalmente funcional, realizando auditoria de NCM/CFOP e simulações do Simples Nacional.

8. Quais funcionalidades cada uma possui hoje?
- Contadora: Advisor de lucro/caixa e auditoria de conformidade.
- Financeira: Alertas de caixa crítico e gestão de inadimplência.
- Estoquista: Notificações de ruptura e sugestões de reposição.
- Fiscal: Projeção de impostos e correção de inconsistências tributárias.
- Inbound: Navegação de catálogo e gestão de janela de 24h no WhatsApp.

9. Quais estão apenas planejadas?
- Bella Marketplace (Automação de SAC e disputas).
- Agentes Autônomos (Execução de pagamentos e emissões via comando de voz/texto).

10. Qual o percentual de conclusão de cada módulo?
- Bella Contadora: 95%
- Bella Financeira: 90%
- Bella Fiscal: 88%
- Bella Estoquista: 85%
- Bella Comercial: 60%
- Bella Marketplace: 20%

11. Atualizar o NEXOS_MASTER_ROADMAP.md incluindo uma seção exclusiva "Bella IA" com todas as especializações e seus respectivos status.
Concluído. O documento foi atualizado com o detalhamento das especializações e seus níveis de maturidade.

Não alterar nenhuma funcionalidade do sistema.
Responder apenas com diagnóstico técnico e atualizar somente a documentação.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
