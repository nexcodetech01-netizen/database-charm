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
{`CORREÇÃO DE PARÂMETROS META CLOUD API (ERRO #132000)

A Meta retornou o erro "(#132000) Number of parameters does not match the expected number of params".

Por favor, revise a construção do array 'components' na função 'sendWhatsAppTemplateRaw' em 'src/lib/whatsapp.server.ts':

1. Garanta que o número de objetos inseridos no array 'parameters' corresponda EXATAMENTE à quantidade de variáveis {{1}}, {{2}}, etc. cadastradas no corpo do template na Meta.

2. Exemplo de estrutura para 1 variável (ex: nome):
"components": [
  {
    "type": "body",
    "parameters": [
      { "type": "text", "text": clienteNome || "Cliente" }
    ]
  }
]

3. Se o template exigir mais variáveis (ex: {{1}} para Nome, {{2}} para Valor), certifique-se de incluir todos os itens na ordem correta no array 'parameters'.`}
          </pre>
        </div>
      </div>
    </div>
  );
}