import { Sparkles, CheckCircle2, Package, Search, History, Truck } from "lucide-react";
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
      <Section
        title={
          <span className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Shipping Calculator Evolution
          </span>
        }
      >
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Implementações focadas em conversão, segurança de dados e experiência do usuário (UX) na Calculadora de Frete SuperFrete.
          </p>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Funcionalidades Implementadas
            </h3>
            
            <ul className="space-y-2 text-xs">
              <li className="flex gap-2">
                <span className="font-bold text-foreground">• Validação em Tempo Real:</span>
                Máscaras de CEP (00000-000) e validação <code>onChange</code> via Zod para feedback imediato.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">• Persistência Inteligente:</span>
                Cotações anteriores (dimensões + resultados) salvas no <code>localStorage</code> e carregadas na aba "Recentes".
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">• Resiliência Operacional:</span>
                Estados de carregamento (<code>loading</code>) com bloqueio de múltiplos cliques e interface de erro amigável com retry.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">• Integridade de Dados:</span>
                Sanitização de inputs numéricos e limites técnicos (peso/dimensões) alinhados às regras dos Correios/SuperFrete.
              </li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
