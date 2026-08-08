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
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <PrinterIcon className="h-5 w-5 text-blue-600" /> Print Manager Enterprise
          </h2>
          
          <PrintManager />
          
          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Print Hub v2.0 Online</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-2">Teste Rápido:</span>
              <PrintButton 
                size="sm"
                label={{
                  id: "test-ent-001",
                  zpl: "^XA^FO50,50^A0N,50,50^FDNexOS Enterprise^FS^FO50,120^A0N,30,30^FDPrint Manager v2^FS^XZ",
                  width: 4,
                  height: 6,
                  dpmm: 8
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 p-6 border rounded-lg bg-card text-card-foreground shadow-sm opacity-60">
          <h2 className="text-lg font-semibold mb-4 text-blue-600 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            AJUSTE FINANCEIRO: CATEGORIA 'APORTE DE SÓCIO' E EDIÇÃO DE LANÇAMENTOS
          </h2>
          <div className="space-y-2 text-sm leading-relaxed">
             <p>• <b>Funcionalidade:</b> Injeção de capital (Aporte de Sócio) agora separada da Receita de Vendas.</p>
             <p>• <b>Edição:</b> Permitida alteração de categoria e descrição em lançamentos já liquidados.</p>
             <p>• <b>Inteligência:</b> Métricas do Dashboard ignoram automaticamente aportes no faturamento bruto.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Lazy imports para os componentes de impressão
import { PrintButton } from "@/features/printing/components/PrintButton";
import { PrinterStatus } from "@/features/printing/components/PrinterStatus";
import { PrintManager } from "@/features/printing/components/enterprise/PrintManager";
import { Printer as PrinterIcon } from "lucide-react";