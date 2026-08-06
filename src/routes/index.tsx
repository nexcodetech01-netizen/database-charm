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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">NexOS Enterprise</h1>
        <p className="text-muted-foreground">Sistema de gestão profissional integrado ao Mercado Livre.</p>
        <div className="mt-8 p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-emerald-600">🚀 INTEGRAÇÃO MERCADO LIVRE V2</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-medium text-primary">1. WEBHOOKS E SINCRONIZAÇÃO:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                <li>Sincronização bidirecional de estoque e preços (NexOS ↔ ML).</li>
                <li>Recebimento de vendas via Webhook (topic: orders_v2) com baixa automática.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-medium text-primary">2. GESTÃO RÁPIDA NO DASHBOARD:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                <li>Botões de ação rápida na tabela de produtos (Pausar, Reativar, Sincronizar).</li>
                <li>Suporte nativo a variações de produto (Cor/Tamanho) no payload.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}