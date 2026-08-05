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
{`REVISÃO FINAL DA INTEGRAÇÃO META CLOUD API WHATSAPP

Por favor, faça uma checagem geral na função de envio de templates do WhatsApp para garantir os seguintes pontos:

1. IDIOMA E NOME:
   - Utilizar template.name = "boas_vindas" (ou o template selecionado no fluxo).
   - Definir obrigatoriamente template.language.code = "pt_BR".

2. PARÂMETROS DE VARIÁVEIS (BODY):
   - Mapear a variável {{1}} do template enviando o nome do cliente no array de parâmetros do body:
     "components": [{ "type": "body", "parameters": [{ "type": "text", "text": clienteNome }] }]

3. TRATAMENTO DE ERROS:
   - Exibir no console/log o status retornado pela API da Meta para facilitar identificação de eventuais falhas de envio.`}
          </pre>
        </div>
      </div>
    </div>
  );
}