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
          <h2 className="text-lg font-semibold mb-4 text-green-600">✅ SPRINT FINALIZADA: CORREÇÃO DE VALIDAÇÃO E DETALHAMENTO DE ERRO</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-medium text-primary">1. MENSAGENS REAIS DA API DO MERCADO LIVRE:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                <li>Toasts agora exibem a causa exata do erro retornada pelo ML (ex: "O campo Cor é obrigatório").</li>
                <li>Aumentado o tempo de exibição do toast de erro para 8 segundos para facilitar a leitura.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-medium text-primary">2. SANITIZAÇÃO E CHECKLIST DE ENVIO:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                <li><strong>Pictures:</strong> URLs diretas do Storage, sem modificação de IA.</li>
                <li><strong>Sale Terms:</strong> Removida a chave 'INSTALLMENTS' do payload.</li>
                <li><strong>GTIN/EAN:</strong> Removido se for "SEM GTIN" ou equivalente. Adicionado fallback 'EMPTY_GTIN_REASON'.</li>
                <li><strong>Atributos:</strong> Removidos campos de dimensões (PACKAGE_*) do array de atributos (enviados em shipping).</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}