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
{`CORREÇÃO DE ENVIO NO CHAT (JANELA FECHADA E TEMPLATES REAIS)

No chat de atendimento (onde aparece a badge 'Janela Fechada'):

1. MAPEAMENTO DE TEMPLATES DO CHAT:
   - Certifique-se de que os botões de envio de template no chat usem APENAS os nomes reais aprovados na Meta: "boas_vindas" ou "cobranca_criada".
   - Remova ou substitua referências a templates inexistentes na Meta (como "Confirmação de Pedido").

2. ESTRUTURA DO PAYLOAD PARA "boas_vindas" E "cobranca_criada":
   - Mande language.code: "pt_BR".
   - Envie EXATAMENTE 1 parâmetro dentro do body (referente ao {{1}}):
     "components": [
       {
         "type": "body",
         "parameters": [
           { "type": "text", "text": clienteNome || "Cliente" }
         ]
       }
     ]

3. ALERTA DE JANELA FECHADA:
   - Se a janela estiver FECHADA ('Janela Fechada'), desabilite ou avise o operador que o campo de texto livre (como "oiii") não funcionará até que um Template (como 'boas_vindas') seja enviado e respondido/entregue.`}
          </pre>
        </div>
      </div>
    </div>
  );
}