import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Invalida caches financeiros após o saneamento via migration
    queryClient.invalidateQueries({ queryKey: ["finance"] });
    
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
  }, [navigate, queryClient]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">NexOS Enterprise</h1>
        <p className="text-muted-foreground">Sistema de gestão profissional integrado ao Mercado Livre.</p>
        <div className="mt-8 p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-blue-600">🛠️ CORREÇÃO DE LÓGICA FINANCEIRA EM DEVOLUÇÃO DE VENDAS</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-medium text-primary uppercase">1. Erro Identificado</h3>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                Ao registrar uma 'Devolução de Venda', o sistema estava gerando um lançamento do tipo 'Conta a Pagar' pendente, exibindo status 'Vencido' e botão de 'Pagar', mesmo quando o estorno já havia sido processado.
              </p>
            </section>
            <section>
              <h3 className="font-medium text-primary uppercase">2. Ajuste Implementado</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
                <li>Nova categoria: "Estorno de Venda / Reembolso" para melhor classificação.</li>
                <li>Liquidação Automática: Devoluções em dinheiro/PIX nascem como 'PAGO' / 'CONCLUÍDO'.</li>
                <li>UX Dinâmico: Botão "Pagar" substituído por "Comprovante de Reembolso" para devoluções.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-medium text-primary uppercase">3. Limpeza de Dados</h3>
              <p className="text-muted-foreground mt-1">
                Lançamentos de devolução antigos que estavam como 'Vencidos' foram saneados para o status 'Estornado', removendo alertas falsos do financeiro.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}