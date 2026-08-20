import { Sparkles, CheckCircle2, Package, Search, History } from "lucide-react";
import { Section } from "@/components/design";

export default function Index() {
  return (
    <div className="space-y-6">
      <Section
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Bella IA Operational Agent
          </span>
        }
      >
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            O ActionCard foi enriquecido com dados reais obtidos via StockService antes da confirmação.
          </p>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Fluxo auditado e corrigido
            </h3>
            
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="font-medium text-foreground">1. AgentRuntime:</span>
                Permite que o <code>runAgent</code> gerencie a interrupção para confirmação.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">2. runAgent:</span>
                O loop intercepta <code>needs_confirmation</code> e enriquece o <code>AgentPlan</code> com dados reais.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">3. BaseSkill:</span>
                Implementado <code>prepareConfirmation</code> para resolver entidades ANTES da mutação.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">4. stock.adjust:</span>
                Implementada resolução de produto e cálculo de delta/target para o card.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">5. ActionCard:</span>
                UI adaptada para exibir tabela técnica (Estoque atual, Novo, Ajuste, Operação).
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">6. Segurança:</span>
                Operação "para 10" tratada como SET absoluto, garantindo integridade.
              </li>
            </ul>
          </div>

          <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg text-primary-foreground/90 italic">
            "A Bella agora mostra EXATAMENTE o que vai acontecer antes de você confirmar qualquer alteração de estoque."
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="flex flex-col gap-1 p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Package className="h-4 w-4" /> SKU / Nome
              </div>
              <span className="text-xs">Identificação precisa do item</span>
            </div>
            <div className="flex flex-col gap-1 p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <History className="h-4 w-4" /> Saldo Real
              </div>
              <span className="text-xs">Consulta ao StockService</span>
            </div>
            <div className="flex flex-col gap-1 p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Search className="h-4 w-4" /> Auditoria
              </div>
              <span className="text-xs">Logs sanitizados e seguros</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
