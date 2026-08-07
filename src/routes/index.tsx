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
    queryClient.invalidateQueries({ queryKey: ["finance-overview"] });
    
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
          <h2 className="text-lg font-semibold mb-4 text-blue-600">🖨️ Printing Center - Sprint 1</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-medium text-primary uppercase">Módulo de Impressão Centralizado</h3>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                Implementada a arquitetura base para o Printing Center, permitindo a gestão de etiquetas ZPL, previews automáticos via Labelary e múltiplos métodos de saída (PDF, ZPL, Navegador).
              </p>
            </section>
            
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                <div className="space-y-1">
                  <p className="font-medium">Teste de Impressão (ZPL)</p>
                  <p className="text-xs text-muted-foreground">Etiqueta de Exemplo 4x6" @ 8dpmm</p>
                </div>
                <PrintButton 
                  variant="default"
                  label={{
                    id: "test-001",
                    zpl: "^XA^FO50,50^A0N,50,50^FDNexOS ERP^FS^FO50,120^A0N,30,30^FDPrinting Center Centralizado^FS^FO50,170^A0N,20,20^FDSprint 1 - Arquitetura Strategy^FS^FO50,250^GB700,3,3^FS^XZ",
                    width: 4,
                    height: 6,
                    dpmm: 8
                  }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PrinterStatus status="ONLINE" />
                <span>Central de Impressão ativa e pronta para homologação.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-6 border rounded-lg bg-card text-card-foreground shadow-sm opacity-60">
          <h2 className="text-lg font-semibold mb-4">🛠️ CORREÇÕES ANTERIORES</h2>
          <div className="space-y-2 text-sm leading-relaxed">
             <p>• Lógica Financeira em Devolução de Vendas (Saneado)</p>
             <p>• Integração Mercado Livre Enterprise (Homologado)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Lazy imports para os componentes de impressão
import { PrintButton } from "@/features/printing/components/PrintButton";
import { PrinterStatus } from "@/features/printing/components/PrinterStatus";