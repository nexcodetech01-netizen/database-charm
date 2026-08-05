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
{`AJUSTAR ATALHO DE ENVIO DE MENSAGEM NO CHAT (ENTER PARA ENVIAR)

No componente de input do chat (caixa de texto de resposta):

1. Modifique o evento 'onKeyDown' da caixa de texto (textarea) para:
   - Se a tecla pressionada for 'Enter' E NÃO estiver segurando 'Shift' (e.key === 'Enter' && !e.shiftKey):
     - Executar 'e.preventDefault()' para não pular linha.
     - Disparar a função de envio da mensagem ('handleSendMessage').
   - Se pressionar 'Shift + Enter':
     - Permitir o comportamento padrão (pular linha no texto).

2. Atualize a legenda explicativa abaixo do botão de envio de "Ctrl/⌘ + Enter para enviar" para "Pressione Enter para enviar • Shift + Enter para quebra de linha".`}
          </pre>
        </div>
      </div>
    </div>
  );
}