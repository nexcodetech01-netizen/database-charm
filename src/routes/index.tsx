import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { ShoppingBag, FileText, Server, Package, History, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Panel, Section } from "@/components/design";

export const Route = createFileRoute("/")({
  component: ValidationPage,
});

function ValidationPage() {
  return (
    <PageLayout
      icon={ShoppingBag}
      title="VALIDAÇÃO"
      description="Respostas técnicas sobre a implementação do módulo de Nova Compra."
    >
      <div className="max-w-3xl space-y-8">
        <Section title="Regras de Resposta">
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel className="p-4 border-destructive/20 bg-destructive/5">
              <p className="text-sm font-semibold text-destructive mb-1">PROIBIDO</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Alterar código ou interface</li>
                <li>• Alterar banco de dados</li>
                <li>• Citar src/routes/index.tsx</li>
              </ul>
            </Panel>
            <Panel className="p-4 border-primary/20 bg-primary/5">
              <p className="text-sm font-semibold text-primary mb-1">OBRIGATÓRIO</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Responder apenas com fatos</li>
                <li>• Listar caminhos completos</li>
                <li>• Responder somente no chat</li>
              </ul>
            </Panel>
          </div>
        </Section>

        <Section title="Questionário Forense">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">1. O arquivo da rota "/compras/novo" existe?</p>
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded text-primary">
                  src/routes/_authenticated/compras_.novo.tsx
                </code>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Server className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">2. Qual arquivo renderiza o formulário "Nova Compra"?</p>
                <p className="text-xs text-muted-foreground">src/features/purchases/components/purchase-form/index.tsx</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">3-6. Serviços e Lógica de Negócio</p>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between text-xs border-b pb-1">
                    <span className="text-muted-foreground">Salva Compra/Itens</span>
                    <span className="font-mono">purchasesService.create</span>
                  </div>
                  <div className="flex justify-between text-xs border-b pb-1">
                    <span className="text-muted-foreground">Atualiza Estoque/Custo</span>
                    <span className="font-mono">RPC receive_purchase</span>
                  </div>
                  <div className="flex justify-between text-xs border-b pb-1">
                    <span className="text-muted-foreground">Movimentação</span>
                    <span className="font-mono">Trigger trg_inventory_log</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <History className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">7. Arquivos Alterados (Fluxo Real)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    "src/features/purchases/services/purchases.service.ts",
                    "src/routes/_authenticated/compras_.novo.tsx",
                    "src/features/purchases/types.ts",
                    "supabase/migrations/[timestamp]_add_purchase_rpc.sql"
                  ].map(file => (
                    <span key={file} className="text-[10px] bg-muted px-2 py-1 rounded border">
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        <div className="pt-4">
          <Button asChild className="w-full">
            <Link to="/compras/novo">
              Validar Operação no PDV <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}