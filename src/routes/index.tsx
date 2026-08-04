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
{`CORRER ERRO DA META CLOUD API (#132000):

Na função de disparo de templates de WhatsApp (type: "template"):

1. TRATAMENTO DE PARÂMETROS:
   - Garanta que a lista de parameters dentro do objeto components (body) corresponda EXATAMENTE às variáveis declaradas no template da Meta.
   - Se o template selecionado NÃO possuir variáveis no texto (ex: Hello World ou templates sem {{1}}, {{2}}), envie parameters como um array vazio [] ou omita a seção de parâmetros no body.
   - Caso o template possua variáveis (ex: {{cliente}}, {{empresa}}), certifique-se de preenchê-las dinamicamente no formato correto da Meta:
     components: [
       {
         type: "body",
         parameters: [
           { type: "text", text: nomeCliente || "Cliente" }
         ]
       }
     ]

2. VALIDAÇÃO PRÉ-ENVIO:
   - Adicione um fallback simples para não quebrar a chamada de API quando um valor de variável estiver indefinido/nulo no banco de dados.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
