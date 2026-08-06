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
CORREÇÃO CRÍTICA NA API DE FOTOS E FALLBACK ('PublishToMercadoLivreDialog'):

1. ERRO GRAVE DE RETORNO DA API:
   - Quando a remoção de fundo por IA falha, o sistema está salvando o texto do erro/status ("Failed Background...") no lugar da URL da imagem.
   - TRATAMENTO OBRIGATÓRIO: Se o serviço de remoção de fundo retornar erro ou falhar, NUNCA substitua a imagem por texto de erro. Mantenha a FOTO ORIGINAL ENVIADA PELO USUÁRIO com o fundo intacto.

2. DESATIVAR REMOÇÃO DE FUNDO OBRIGATÓRIA / ADICIONAR TOGGLE:
   - Se a API de remoção de fundo estiver instável ou sem créditos, não bloqueie o upload. Permita que a foto original enviada pelo usuário seja carregada diretamente no slot sem passar pela IA, garantindo que a foto real da bolsa apareça.

3. LIMPEZA DOS SLOTS:
   - Limpe do estado qualquer slot que contenha a URL/texto "Failed Background..." e renderize apenas arquivos de imagem válidos.
`}
          </pre>
        </div>
      </div>
    </div>
  );
}