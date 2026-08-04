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
{`IMPLEMENTAÇÃO — SPRINT 1

Objetivo:

Implementar a importação MANUAL de pedidos do Mercado Livre.

Escopo:

1. Criar a tabela \`external_orders\`.
   Campos mínimos:
   - id (UUID)
   - provider ('mercadolivre')
   - external_order_id (UNIQUE)
   - payload (JSONB)
   - status
   - sale_id (nullable)
   - imported_at
   - created_at
   - updated_at

2. Alterar o webhook do Mercado Livre para persistir o pedido em \`external_orders\`.

3. NÃO criar venda automaticamente.

4. NÃO criar cliente.

5. NÃO criar financeiro.

6. Criar a tela "Pedidos Mercado Livre".

7. Exibir:
   - Número do pedido
   - Cliente
   - Valor
   - Status
   - Data
   - Botão "Importar"

8. Ao clicar em "Importar":
   - Criar a venda.
   - Vincular \`sale_id\` em \`external_orders\`.
   - Preencher \`imported_at\`.

IMPORTANTE

Não alterar o fluxo atual de sincronização de preço.

Não alterar o fluxo atual de sincronização de estoque.

Não alterar o PDV.

Não alterar o Financeiro.

Implementar somente esta Sprint.`}
          </pre>
        </div>
      </div>
    </div>
  );
}