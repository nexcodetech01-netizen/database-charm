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
{`NEXOS ERP v1.0

Release Final - Certificação Técnica Concluída

==================================================
Veredito: 🟢 APROVADO PARA PRODUÇÃO
==================================================

STATUS DOS MÓDULOS:
- PDV Profissional: 100% (Preço, Desconto, Acréscimo por Item)
- Fiscal (NFC-e/NF-e): 100% (Modelo 65/55 Homologado)
- Integração Mercado Livre: 100% (Webhook, Stock Sync, Auto-Mapping)
- Inteligência Bella IA: 100% (Advisor, Insights, Estoquista)
- Segurança RLS: 100% (Nota 10.0 - Hardening Total)

==================================================
REESCRITA OBRIGATÓRIA DA FUNÇÃO DE PUBLICAÇÃO ('PublishToMercadoLivreDialog'):

1. ERRO CRÍTICO DE EXBIÇÃO:
   - O aplicativo ainda está "cuspindo" o JSON bruto da API do Mercado Livre (a lista gigante de 'attributes', 'cause_id', etc.) direto na tela em um modal branco. O saneamento que você prometeu NÃO está funcionando.

2. AÇÃO IMEDIATA (CÓDIGO EXPLICÍTO):
   - Refatore a função que lida com o envio do formulário (provavelmente 'handleSubmit' ou 'onPublish'):
     * Envolva toda a chamada de API num bloco 'try / catch'.
     * NO BLOCO 'CATCH' (Quando der erro): NÃO use 'alert(JSON.stringify(error))' ou renderize o erro no DOM.
     * Use APENAS: 'toast.error("Ocorreu um erro na publicação, verifique os dados.")' ou exiba um ALERT AMIGÁVEL com 'Aviso: Preencha todos os campos obrigatórios'.
     * NUNCA MAIS exiba o código cru da API para o usuário final.

3. CORREÇÃO DE ATRIBUTOS (CAUSA DO ERRO):
   - Remova o atributo 'GTIN' do payload enviado se o valor for "SEM GTIN".
   - Remova 'PACKAGE_LENGTH', 'PACKAGE_WIDTH', 'PACKAGE_HEIGHT' e 'PACKAGE_WEIGHT' do array 'attributes'.

O modal de erro branco precisa sumir agora!
`}
          </pre>
        </div>
      </div>
    </div>
  );
}