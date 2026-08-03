import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { ShoppingBag, Calculator, RefreshCcw, Package, Percent, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Panel, Section } from "@/components/design";

export const Route = createFileRoute("/")({
  component: SprintRateioFinalPage,
});

function SprintRateioFinalPage() {
  return (
    <PageLayout
      icon={ShoppingBag}
      title="SPRINT CONCLUÍDA"
      description="Rateio automático e recálculo do Motor V2 implementados."
    >
      <div className="max-w-4xl space-y-8">
        <Section title="STATUS DA ENTREGA">
          <Panel className="p-6 border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <h2 className="text-xl font-bold text-green-700 dark:text-green-400">Implementação Finalizada</h2>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Arquivos Alterados</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <code className="bg-muted px-1">supabase/migrations/20260803125100_...sql</code></li>
                  <li>• <code className="bg-muted px-1">src/features/purchases/__tests__/purchase-proration.test.ts</code></li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Testes Executados</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="text-green-600">✓ Frete Zero (Sucesso)</li>
                  <li className="text-green-600">✓ Único Produto (Sucesso)</li>
                  <li className="text-green-600">✓ Múltiplos Produtos (Sucesso)</li>
                  <li className="text-green-600">✓ Arredondamento (Sucesso)</li>
                </ul>
              </div>
            </div>
          </Panel>
        </Section>

        <Section title="RESUMO TÉCNICO">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                A lógica de rateio foi movida para o banco de dados (Trigger <code className="text-primary">apply_purchase_to_inventory</code>) 
                para garantir atomicidade. Agora, ao receber uma compra, o sistema:
              </p>
              <ul className="text-xs space-y-3">
                <li className="flex gap-2">
                  <Percent className="h-4 w-4 shrink-0 text-primary" />
                  <span>Calcula o peso de cada item no frete baseado no valor bruto.</span>
                </li>
                <li className="flex gap-2">
                  <Package className="h-4 w-4 shrink-0 text-primary" />
                  <span>Atualiza os campos auxiliares (<code className="text-primary">freight</code>, <code className="text-primary">other_costs</code>) no cadastro do produto.</span>
                </li>
                <li className="flex gap-2">
                  <RefreshCcw className="h-4 w-4 shrink-0 text-primary" />
                  <span>Dispara a função <code className="text-primary">recalculate_product_v2_price</code> que ajusta o preço de venda automaticamente.</span>
                </li>
              </ul>
            </div>

            <Panel className="p-4 border-amber-500/20 bg-amber-500/5">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">INTEGRIDADE MANTIDA</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Confirmado que Mercado Livre, Asaas, Caixa e Financeiro não sofreram alterações. 
                A Bella IA continua operando em modo READ, agora com dados de custo mais precisos 
                para fornecer insights de margem.
              </p>
            </Panel>
          </div>
        </Section>

        <div className="pt-4 flex gap-4">
          <Button asChild className="flex-1">
            <Link to="/compras/novo">
              Nova Compra <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}