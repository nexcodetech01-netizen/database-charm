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
{`CORREÇÃO DE ENVIO DE TEMPLATE DE WHATSAPP:

1. NOME DO TEMPLATE:
   - Certifique-se de que a função de envio via Meta Cloud API esteja enviando o parâmetro \`template.name\` com o nome exato do modelo selecionado pelo usuário (ex: 'boas_vindas' ou 'boas_vindas_padrao'), e NÃO o valor 'hello_world'.

2. IDIOMA E COMPONENTES:
   - Defina o idioma padrão do template como 'pt_BR' no payload:
     template: {
       name: templateNome,
       language: { code: "pt_BR" },
       components: [...]
     }

3. MAPEAMENTO DE MODELOS:
   - No painel/banco de dados, certifique-se de que a coluna \`name\` ou \`template_name\` da tabela de modelos de mensagem corresponda exatamente ao nome do modelo aprovado no Gerenciador da Meta.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
