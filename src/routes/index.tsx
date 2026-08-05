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
{`Por favor, corrija o layout de impressão do Cupom Não Fiscal (ESC/POS e web print no PDV):

1. Margens e Alinhamento: Adicione uma margem interna à esquerda (padding-left/margin-left de pelo menos 8px a 12px) no container da bobina para que nenhum texto fique cortado na borda papel.
2. Largura da Bobina: Ajuste o container de impressão para respeitar a largura padrão de cupom térmico (58mm/80mm ou approx. 48 caracteres por linha no ESC/POS).
3. Quebra de Linha (Word Wrap): Adicione 'word-break: break-word' ou garanta que os rótulos de tabela (ex: Venda Nº, Data, Hora, Cliente, Itens, Forma de Pagamento) fiquem em colunas bem dimensionadas.
4. Alinhamento dos Totais: Mantenha as descrições dos produtos alinhadas à esquerda com margem suficiente e os valores (R$) alinhados à direita.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
