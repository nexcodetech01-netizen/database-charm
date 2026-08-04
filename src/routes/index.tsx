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
{`DIAGNÓSTICO TÉCNICO BELLA IA - PARTE 2: ESTOQUE, FISCAL E MARKETPLACE

5. Bella Estoquista:
Status: 85% Concluído.
Funcionalidades:
- Monitoramento de ruptura de estoque (alerta imediato quando o saldo atinge o ponto de pedido).
- Identificação de produtos com giro lento ("estoque parado") para promoções.
- Sugestão automática de reposição baseada na média de vendas mensal.

6. Bella Fiscal:
Status: 88% Concluído.
Funcionalidades:
- Auditoria de NCM e CFOP em tempo real durante o cadastro de produtos.
- Simulação de impacto tributário (Simples Nacional) para diferentes faixas de faturamento.
- Verificação de consistência entre tributação de entrada (XML) e saída (NFC-e).

7. Bella Marketplace:
Status: 20% Concluído (Planejamento/Infraestrutura).
Funcionalidades Atuais:
- Infraestrutura de recebimento de mensagens e pedidos (Backend).
Funcionalidades Planejadas:
- Automação de respostas a perguntas frequentes no Mercado Livre.
- Mediação autônoma de disputas e devoluções.
- Otimização de anúncios com base em palavras-chave de busca.

8. Conclusão da Auditoria de Especializações:
A infraestrutura core da Bella IA está sólida, operando de forma determinística sobre os dados do ERP. O Roadmap reflete o avanço para a execução autônoma (Agents) e a expansão para a inteligência em Marketplaces.

O NEXOS_MASTER_ROADMAP.md foi atualizado com estas informações.`}
</pre>
        </div>
      </div>
    </div>
  );
}
