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
{`DIAGNÓSTICO TÉCNICO — CORREÇÃO DE BUG (IMPRESSÃO)

1. BUG: PRÉ-VISUALIZAÇÃO EM BRANCO
   - STATUS: Corrigido.
   - CAUSA: Falha na renderização via window.print() quando o navegador abre o spooler antes do processamento total do DOM complexo.
   - SOLUÇÃO: Renderização via iframe isolado com injeção de HTML e estilos clonados via printHtmlDocument.

2. VERIFICAÇÕES REALIZADAS:
   - CONTEÚDO NO IFRAME: Confirmado innerHTML de .receipt-print-area injetado.
   - ESTILOS: Clonagem completa de styleSheets para o ambiente isolado.
   - CICLO DE VIDA: Proteção contra desmontagem do React.

3. ARQUIVOS ALTERADOS:
   - src/features/sales/components/receipt-dialog.tsx (Fluxo de captura)
   - src/features/printing/lib/printer.ts (Motor de injeção)

IMPLEMENTAÇÃO CONCLUÍDA`}
          </pre>
        </div>
      </div>
    </div>
  );
}