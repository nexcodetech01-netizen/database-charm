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
{`CORRIGIR DISPARO DINÂMICO DE TEMPLATES DA META (SEM HELLO_WORLD):

1. REMOVER FIXAÇÃO DO HELLO_WORLD:
   - Na Edge Function ou serviço que faz a chamada HTTP para a API do WhatsApp (Meta Cloud API), remova qualquer fallback ou valor fixo 'hello_world'.
   - O parâmetro \`template.name\` DEVE ser lido dinamicamente a partir do objeto/registro do modelo de mensagem selecionado no banco de dados (\`modelos_mensagem.template_name\` ou similar).

2. TRATAMENTO DE NOME E PARÂMETROS:
   - Garanta que o nome do template seja formatado em minúsculas e sem espaços (ex: se o usuário selecionou o modelo 'Boas-vindas padrão', envie o \`template_name\` correspondente cadastrado).
   - Defina o idioma como \`pt_BR\`:
     template: {
       name: templateSelecionado.template_name,
       language: { code: "pt_BR" },
       components: [...]
     }

3. INTERFACE DE MODELOS:
   - Na tela de 'Modelos de Mensagem', certifique-se de que cada card/modelo tenha um campo interno onde o usuário possa visualizar ou vincular o nome exato do template aprovado na Meta.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
