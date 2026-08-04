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
{`DIAGNÓSTICO TÉCNICO — AUDITORIA DE IMPLEMENTAÇÃO SPRINT 1

1. TABELA EXTERNAL_ORDERS:
   - CRIADA: Sim.
   - COLUNAS: id (UUID), company_id (UUID), marketplace (Text), external_order_id (Text), payload (JSONB), status (Text), imported_at (TZ), sale_id (UUID), timestamps.
   - CONSTRAINTS: PRIMARY KEY (id), UNIQUE (company_id, marketplace, external_order_id), FKs para companies e sales.

2. WEBHOOK ML:
   - STATUS: Operacional em src/lib/mercadolivre-webhook.server.ts.
   - PERSISTÊNCIA: Implementada via upsert no tópico 'orders_v2' (linhas 157-170).

3. ARQUIVOS ALTERADOS/CRIADOS:
   - src/lib/mercadolivre-webhook.server.ts (Refatoração do webhook)
   - src/lib/external-orders.functions.ts (Novas Server Functions: get/import)
   - src/routes/_authenticated/importacoes.mercado-livre.tsx (Nova tela de listagem)
   - src/routes/_authenticated/importacoes.tsx (Link na central)
   - src/features/imports/types.ts & icons.ts (Definições de UI)
   - supabase/migrations/*_create_external_orders.sql (Schema)

4. TELA /importacoes/mercado-livre:
   - EXISTE: Sim, totalmente funcional com Table, Badge e Hooks de dados.

5. BOTÃO "IMPORTAR":
   - FUNCIONAMENTO: Chama a Server Function 'importExternalOrder' via useMutation (Linha 33 de importacoes.mercado-livre.tsx).

6. FLUXO DE VENDA:
   - CONVERSÃO: A venda interna (sales/sale_items) é gerada APENAS quando o usuário clica em "Importar" no frontend, disparando o handler no backend.

7. ESTOQUE AUTOMÁTICO (LEGADO):
   - MANUTENÇÃO: O fluxo antigo de inventory_movements direto no webhook foi PRESERVADO (linhas 180-212 do webhook) para evitar quebra de compatibilidade durante a transição.

8. BUGS E RISCOS:
   - RISCO IDENTIFICADO: Duplicidade de estoque se o usuário importar manualmente um pedido que já sofreu baixa automática no webhook (ambos fluxos estão ativos).
   - AÇÃO RECOMENDADA: Condicionar a baixa de estoque do webhook à flag de importação automática ou desativar o legado após homologação.

9. CONCLUSÃO:
   - STATUS: SPRINT 1 CONCLUÍDA. Infraestrutura de staging, UI de gestão e motor de importação manual operacionais.`}
          </pre>
        </div>
      </div>
    </div>
  );
}