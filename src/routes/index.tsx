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
          <h2 className="text-lg font-semibold mb-4 text-emerald-600">⚡ SPRINT 7.2 — PDV ENTERPRISE</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-medium text-primary uppercase">Foco: Velocidade Operacional</h3>
              <p className="text-muted-foreground mt-1">
                Implementação de recursos profissionais: Suspensão/Recuperação de vendas, múltiplos carrinhos, 
                atalhos globais (F6-F8, CTRL+P/C/S/R), observações por item e pesquisa instantânea multi-critério.
              </p>
            </section>
            <section>
              <h3 className="font-medium text-primary">STATUS: EM DESENVOLVIMENTO</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                <li>UX otimizada para operador de caixa (Scanner sempre ativo).</li>
                <li>Resumo financeiro detalhado com margem e lucro estimado.</li>
                <li>Campo de preço livre com suporte a decimais e sobreposição manual.</li>
                <li>Atalhos Enterprise: Enter para adicionar item e foco automático na busca.</li>
                <li>Roteamento Corrigido: Edição de compras (/editar) agora renderiza corretamente via .index.tsx separação.</li>
                <li>Validação amigável: Botão Salvar sempre ativo com alertas direcionados.</li>
                <li>Zero novas regras de negócio — Reuso total do Motor Comercial V2.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}