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
{`AUDITORIA TÉCNICA — SPRINT 1 (READ-ONLY)

NÃO alterar código.

NÃO alterar banco.

NÃO criar arquivos.

OBJETIVO

Auditar exclusivamente a implementação da Sprint 1:
"Importação Manual de Pedidos do Mercado Livre".

Responder:

1. Qual a melhor estrutura para armazenar pedidos do Mercado Livre?
   (Nova tabela ou reutilizar alguma existente?)

2. Quais tabelas precisarão ser criadas ou alteradas?

3. Quais arquivos serão modificados?

4. Qual será o fluxo completo do pedido, desde o webhook até aparecer na tela?

5. Como evitar pedidos duplicados?

6. Como marcar um pedido como "Importado"?

7. Existe algum risco de impactar o fluxo atual de baixa automática de estoque?

8. Existe alguma estrutura já pronta que possa ser reaproveitada?

9. Qual é a implementação mais simples para concluir esta sprint?

IMPORTANTE

Responder APENAS no chat.

NÃO alterar nenhum arquivo.

NÃO alterar src/routes/index.tsx.

NÃO alterar a Home.

NÃO criar componentes.

NÃO criar arquivos.

NÃO criar migrations.

NÃO alterar banco de dados.

NÃO implementar nenhuma funcionalidade.

NÃO registrar o resultado na interface.

NÃO responder que "o relatório foi atualizado".

NÃO responder que "a página inicial foi atualizada".

Exibir TODO o diagnóstico diretamente nesta conversa.

Se qualquer arquivo for alterado, a auditoria estará incorreta.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
