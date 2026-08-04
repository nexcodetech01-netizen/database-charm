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
{`ve se faça o q eu mando:
CORREÇÃO CRÍTICA DE DISPARO DE WHATSAPP (METACLOUD API):

O sistema ainda está disparando o template hardcoded 'hello_world'. Refatore o código de envio com as seguintes alterações obrigatórias:

1. BUSCA DE CÓDIGO HARDCODED:
   - Procure em todo o projeto (especialmente em supabase/functions/ send-whatsapp ou handlers de envio) pela string 'hello_world'.
   - Remova qualquer fallback ou valor padrão fixo 'hello_world'.

2. ATUALIZAR PAYLOAD DO TEMPLATE:
   - Substitua o nome do template no payload da API da Meta para: "jaspers_market_order_confirmation_v1"
   - Configure o idioma para "en_US" (conforme definido na Meta para este template).
   - Inclua obrigatoriamente os 3 parâmetros no corpo (body) para evitar erro de assinatura:
     components: [
       {
         type: "body",
         parameters: [
           { type: "text", text: "Cliente Teste" },
           { type: "text", text: "12345" },
           { type: "text", text: "04/08/2026" }
         ]
       }
     ]

3. VERIFICAÇÃO:
   - Imprima no console da Edge Function (console.log) o JSON exato do payload enviado para https://graph.facebook.com para podermos validar o corpo da requisição.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
