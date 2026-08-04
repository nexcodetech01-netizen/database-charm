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
{`ATUALIZAR CONFIGURAÇÃO DO TEMPLATE DA META:

1. BANCO DE DADOS / MODELOS:
   - Para o modelo 'Confirmação de Pedido', defina o \`template_name\` como: "jaspers_market_order_confirmation_v1".

2. PAYLOAD DA META CLOUD API:
   - Ao disparar o template 'jaspers_market_order_confirmation_v1':
     * Envie 'template.name': "jaspers_market_order_confirmation_v1"
     * Envie 'language.code': "en_US" (ou "pt_BR", conforme aceito pela Meta para este template).
     * Preencha EXATAMENTE 3 parâmetros dentro de 'components':
       components: [
         {
           type: "body",
           parameters: [
             { type: "text", text: nomeCliente || "Cliente" },
             { type: "text", text: numeroPedido || "001" },
             { type: "text", text: dataPedido || "Hoje" }
           ]
         }
       ]

3. TRATAMENTO DE ERROS:
   - Garanta que nunca sejam enviados mais ou menos do que 3 parâmetros para este modelo específico, evitando o erro #132000 da Meta.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
