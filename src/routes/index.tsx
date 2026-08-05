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
{`VERIFICAÇÃO E RECEPÇÃO DE WEBHOOK DO WHATSAPP META

Por favor, revise a rota/função de Webhook do WhatsApp no backend:

1. ROTA GET (Validação Meta):
   - Deve responder ao desafio de verificação da Meta (hub.challenge) confirmando o 'hub.verify_token'.

2. ROTA POST (Recebimento de Mensagens):
   - Deve processar o payload 'entry[0].changes[0].value.messages[0]'.
   - Quando uma mensagem de cliente for recebida:
     a) Salvar a mensagem no banco de dados vinculada à conversa do cliente.
     b) ATUALIZAR O STATUS DA JANELA DA CONVERSA para "ABERTA" (janela de 24h ativada).
     c) Adicionar console.log("Mensagem recebida do Webhook:", JSON.stringify(body)) para depuração.`}
          </pre>
        </div>
      </div>
    </div>
  );
}