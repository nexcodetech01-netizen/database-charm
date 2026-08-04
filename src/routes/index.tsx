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
{`CORREÇÃO URGENTE: ERRO DE PARÂMETROS NO DISPARO DO WHATSAPP (#132000)

O modal/botão de envio de template na interface está disparando a requisição sem passar os 3 parâmetros obrigatórios que o template 'jaspers_market_order_confirmation_v1' exige.

1. CORREÇÃO NO FRONT-END / COMPONENTE DE ENVIO:
   - Quando o operador selecionar o template 'jaspers_market_order_confirmation_v1', o payload enviado para a Edge Function DEVE obrigatoriamente incluir os dados dos parâmetros (Nome, Número do Pedido e Data).
   - Se o usuário não preencheu, utilize valores padrão seguros (ex: ["Cliente", "001", "Hoje"]) para evitar que o array vá vazio ou com tamanho incorreto.

2. VALIDAÇÃO NA EDGE FUNCTION:
   - Antes de realizar o \`fetch\` para a API da Meta, valide se \`parameters.length === 3\`. Se for diferente de 3, retorne um erro amigável no console informando que o template exige exatamente 3 parâmetros.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
