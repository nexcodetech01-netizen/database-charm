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
          <h2 className="text-lg font-semibold mb-4 text-blue-600">⚡ SPRINT 8.3 — BELLA CONTABILIDADE ENTERPRISE</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-medium text-primary uppercase">Módulo: Fechamento Mensal Inteligente</h3>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                OBJETIVO: Criar um Assistente Inteligente de Fechamento Mensal. A Bella deve auditar, validar e orientar a empresa antes do encerramento do mês, sem realizar o fechamento formal ou alterar dados.
              </p>
            </section>
            <section>
              <h3 className="font-medium text-primary">REQUISITOS DA SPRINT</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                <li>Auditoria 360: Financeiro, Estoque, Compras, Vendas, PDV e Fiscal.</li>
                <li>Nota de Saúde: Score de 0-100 com níveis de criticidade.</li>
                <li>Resumo Executivo: Conquistas, problemas, riscos e oportunidades.</li>
                <li>Timeline Mensal: Histórico visual de todos os domínios no mês.</li>
                <li>Chat (Skills): Auditoria sob demanda via linguagem natural.</li>
                <li>Bella CEO: Resumo estratégico direto no Dashboard.</li>
                <li>Arquitetura: Reuso integral dos motores existentes; proibido SQL paralelo.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}