import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag, Package, Truck, Calculator, History, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Panel, Section, StatStack } from "@/components/design";

export const Route = createFileRoute("/")({
  component: SprintPurchasesPage,
});

function SprintPurchasesPage() {
  return (
    <PageLayout
      icon={ShoppingBag}
      title="Nova Compra"
      description="Implementação da funcionalidade de entrada de mercadorias no módulo de Compras."
      actions={
        <Button asChild>
          <Link to="/compras/novo">
            Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Section 
            title="OBJETIVO" 
            description="Implementar a funcionalidade \"Nova Compra\" no módulo Compras."
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground leading-relaxed">
                Criar o fluxo de cadastro de uma compra de fornecedor, garantindo a atualização 
                automática de estoque e custos sem complexidade excessiva nesta fase inicial.
              </p>
            </div>
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Panel className="p-4 border-primary/20 bg-primary/5">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                Campos Obrigatórios
              </h3>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">• Fornecedor</li>
                <li className="flex items-center gap-2">• Número do pedido</li>
                <li className="flex items-center gap-2">• Data da compra</li>
                <li className="flex items-center gap-2">• Frete</li>
                <li className="flex items-center gap-2">• Outros custos (opcional)</li>
              </ul>
            </Panel>

            <Panel className="p-4 border-primary/20 bg-primary/5">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-primary" />
                Resumo Automático
              </h3>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">• Valor das mercadorias</li>
                <li className="flex items-center gap-2">• Frete</li>
                <li className="flex items-center gap-2">• Outros custos</li>
                <li className="flex items-center gap-2 font-medium text-foreground">• Total da compra</li>
              </ul>
            </Panel>
          </div>

          <Section title="Fluxo de Confirmação" description="O que acontece ao clicar em \"Confirmar Entrada\"">
            <StatStack 
              items={[
                { label: "Estoque", value: "Atualizado", icon: Package, status: "success" },
                { label: "Custo Médio", value: "Recalculado", icon: Calculator, status: "info" },
                { label: "Movimentação", value: "Registrada", icon: History, status: "neutral" }
              ]}
            />
          </Section>

          <Panel className="border-destructive/20 bg-destructive/5 p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              IMPORTANTE — Fora de Escopo
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Estes itens NÃO serão implementados nesta sprint:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <div>• Rateio automático de frete</div>
              <div>• Recálculo Motor V2</div>
              <div>• Importação PDF/XML</div>
              <div>• Integração Marketplaces</div>
              <div>• Alterações no Asaas</div>
              <div>• Alterações no Caixa</div>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Section title="Bella IA" description="Monitoramento em modo READ">
            <Panel className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-semibold">Assistente de Compras</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    A Bella permanece somente em modo **READ**. Ela fornecerá insights sobre os custos e 
                    sugerirá melhorias na margem sem realizar ações automáticas.
                  </p>
                </div>
              </div>
            </Panel>
          </Section>

          <Section title="Regras de Integridade">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold">1</span>
                </div>
                <p className="text-xs text-muted-foreground">Manter cadastro único de produto e estoque único.</p>
              </div>
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold">2</span>
                </div>
                <p className="text-xs text-muted-foreground">A compra pertence ao fornecedor, não ao produto.</p>
              </div>
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold">3</span>
                </div>
                <p className="text-xs text-muted-foreground">Estrutura preparada para futuro rateio automático.</p>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </PageLayout>
  );
}

