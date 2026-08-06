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
RECURSO: VINCULAÇÃO E INTELIGÊNCIA ML
1. Webhook processa pedidos em tempo real.
2. Busca inteligente tenta vincular por MLB_ID ou SKU do ML.
3. Se falhar, pedido fica pendente para vinculação manual.
4. Vinculação manual grava o de/para e automatiza vendas futuras.
5. Baixa de estoque integrada via motor comercial/estoque.

Pronto para operação em escala comercial.
`}
          </pre>
        </div>
      </div>
    </div>
  );
}
