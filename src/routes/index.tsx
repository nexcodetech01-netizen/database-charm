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
{`O cupom continuou cortando a margem esquerda na impressora térmica real. O problema é que o HTML de impressão está mais largo que as colunas da bobina (58mm/80mm). 

Por favor, faça os seguintes ajustes estritos no componente/CSS de impressão do cupom:

1. No container principal do cupom de impressão (@media print / printable area):
   - Defina width: 100% e max-width: 260px (para bobina de 58mm) ou max-width: 380px (para 80mm).
   - Adicione obrigatoriamente padding-left: 15px !important; e padding-right: 15px !important; no container pai do recibo.
   - Adicione box-sizing: border-box !important; em todos os elementos do recibo.

2. Ajuste de Colunas/Tabela:
   - Em vez de usar grid/tabela com larguras fixas que estouram a margem, force os rótulos da esquerda (ex: "Venda Nº:", "Data:", "Cliente:") a terem uma largura mínima garantida ou use flexbox com justify-content: space-between.
   - Adicione overflow: hidden e white-space: nowrap com truncamento nas descrições longas se necessário.

3. Reduza ligeiramente a fonte geral do recibo em 1px (ex: de 12px para 11px / font-mono) para garantir que cabem 32/48 caracteres por linha sem empurrar o texto para fora da margem.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
