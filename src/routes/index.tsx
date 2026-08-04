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
DIAGNÓSTICO E CORREÇÃO FORÇADA DE DISPARO (#132000):

O erro de parâmetros (#132000) continua acontecendo na interface ao tentar enviar mensagem. Precisamos rastrear o fluxo exato do clique:

1. RASTREAR A AÇÃO DO BOTÃO "ENVIAR" NA TELA:
   - Verifique exatamente qual função JavaScript/TypeScript é disparada quando o operador clica no botão 'Enviar' ou aperta 'Enter' no chat.
   - Garanta que esse evento chame EXCLUSIVAMENTE a função refatorada no `service.functions.ts` ou a Edge Function atualizada, e NÃO um fetch direto ou rota legada.

2. LOG DE CONTROLE (PRINT DO PAYLOAD):
   - Antes de realizar o `fetch` para 'https://graph.facebook.com/v25.0/...', coloque um `console.log("PAYLOAD_ENVIADO_META:", JSON.stringify(bodyPayload))` para inspecionarmos no console do navegador / logs do Supabase.

3. RE-DEPLOY DA EDGE FUNCTION:
   - Se os arquivos do Supabase / Edge Functions foram alterados (`whatsapp.server.ts`), certifique-se de aplicar/re-implantar as Edge Functions para que o ambiente de produção/sua instância rode o código atualizado com o fallback dos 3 parâmetros.
          </pre>
        </div>
      </div>
    </div>
  );
}