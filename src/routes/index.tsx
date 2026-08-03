import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { ShoppingBag, Calculator, RefreshCcw, Package, Percent, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Panel, Section } from "@/components/design";

export const Route = createFileRoute("/")({
  component: SprintRateioPage,
});

function SprintRateioPage() {
  return (
    <PageLayout
      icon={ShoppingBag}
      title="SPRINT"
      description="Pode alterar código."
    >
      <div className="max-w-4xl space-y-8">
        <Section title="OBJETIVO">
          <Panel className="p-6 border-primary/20 bg-primary/5">
            <h2 className="text-xl font-bold text-primary mb-2">Rateio Automático de Frete e Custos</h2>
            <p className="text-muted-foreground">
              Implementar a inteligência de distribuição proporcional de custos adicionais (frete e outros) 
              sobre os itens da compra, garantindo que o custo efetivo do produto reflita a realidade operacional.
            </p>
          </Panel>
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="REGRAS">
            <div className="space-y-4">
              <Panel className="p-4 border-l-4 border-l-amber-500">
                <p className="text-sm font-semibold mb-1">Pertencimento</p>
                <p className="text-xs text-muted-foreground italic">O frete pertence à compra. Nunca ao produto.</p>
              </Panel>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Após confirmar a compra:</p>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Percent className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Distribuir frete e outros custos proporcionalmente ao valor total de cada item.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Calculator className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Atualizar o custo efetivo de cada produto no catálogo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RefreshCcw className="h-3 w-3 mt-0.5 text-primary" />
                    <span>Recalcular automaticamente o Motor Comercial V2 para proteger margens.</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          <Section title="CENÁRIOS DE TESTE">
            <div className="grid grid-cols-2 gap-3">
              {[
                "Frete Zero",
                "Único Produto",
                "Múltiplos Produtos",
                "Valores Diferentes",
                "Arredondamento"
              ].map((cenario) => (
                <div key={cenario} className="flex items-center gap-2 p-2 rounded border bg-card">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium">{cenario}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="RESTRIÇÕES (Não alterar)">
          <div className="flex flex-wrap gap-2">
            {["Mercado Livre", "Asaas", "Caixa", "Financeiro", "Canais de Venda"].map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-secondary text-[10px] font-bold">
                {tag.toUpperCase()}
              </span>
            ))}
          </div>
        </Section>

        <div className="pt-4">
          <Button asChild size="lg" className="w-full">
            <Link to="/compras/novo">
              Implementar Rateio <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}