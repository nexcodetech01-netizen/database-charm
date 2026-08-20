import { Sparkles, CheckCircle2, Package, Search, History, Truck } from "lucide-react";
import { Section } from "@/components/design";

export default function Index() {
  return (
    <div className="space-y-6">
      <Section
        title={
          <span className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> SuperFrete UI Restructuring
          </span>
        }
      >
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Reestruturação completa da interface da Calculadora de Frete seguindo o design do SuperFrete no Dark Mode.
          </p>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Mudanças de Layout e UX
            </h3>
            
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="font-medium text-foreground">1. Origem:</span>
                Botões "Salvar" e "Limpar" bem definidos com texto e ícones à direita do CEP.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">2. Inputs Material:</span>
                Labels em caixa alta e borda inferior (border-b) para um visual limpo e profissional.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">3. Cards Contrastantes:</span>
                Containers <code>bg-card</code> com bordas discretas e cantos arredondados (rounded-xl).
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">4. Navegação de Destino:</span>
                Abas "Novo" e "Recentes" com indicador visual verde e link "PESQUISAR CEP" em destaque.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">5. Call to Action:</span>
                Botão "CALCULAR FRETE COM DESCONTO" em largura total (w-full) em verde vibrante.
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">6. Resultados:</span>
                Painel lateral centralizado para exibição das cotações no mesmo container escuro.
              </li>
            </ul>
          </div>

          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-500 italic">
            "A interface agora segue rigorosamente a hierarquia visual do SuperFrete, otimizada para o tema escuro do NexOS."
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="flex flex-col gap-1 p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2 font-medium text-foreground text-xs">
                Implementar validação e máscaras para peso, largura e comprimento, com mensagens de erro claras quando os valores estiverem inválidos.
              </div>
            </div>
            <div className="flex flex-col gap-1 p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2 font-medium text-foreground text-xs">
                Ajustar o layout da Calculadora de Frete para funcionar perfeitamente em telas menores, garantindo que o painel de resultados e o formulário fiquem bem distribuídos.
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}


