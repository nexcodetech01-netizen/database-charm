import { Sparkles, CheckCircle2, Package, Search, History, Truck, AlertCircle, FileSearch } from "lucide-react";
import { Section } from "@/components/design";

export default function Index() {
  return (
    <div className="space-y-6">
      <Section
        title={
          <span className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" /> Auditoria Técnica: Bella IA Agent Runtime
          </span>
        }
      >
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-lg text-amber-600 font-bold italic mb-4 text-center">
            "Atenção: Auditoria concluída. Não foram realizadas modificações no código de negócio."
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Fluxo de Intenção
              </h3>
              <ul className="space-y-1 text-xs">
                <li><span className="text-foreground font-medium">INTENT REAL:</span> stock.adjust</li>
                <li><span className="text-foreground font-medium">ORIGEM:</span> OpenAI / Intent Engine</li>
                <li><span className="text-foreground font-medium">SKILL ID SOLICITADO:</span> stock.adjust</li>
              </ul>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" /> Registro de Skills
              </h3>
              <ul className="space-y-1 text-xs">
                <li><span className="text-foreground font-medium">SKILLS REGISTRADAS:</span> stock.add, stock.remove, stock.adjust, stock.history, stock.low, stock.balance, stock.purchase_suggestion</li>
                <li><span className="text-foreground font-medium">LOCAL:</span> inventory/v2/skills/index.ts</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" /> Diagnóstico: Causa Raiz
            </h3>
            <p className="text-xs leading-normal text-foreground/80">
              Identificada falha na inicialização do bootstrap de skills em <code>src/features/bella-ai/skills/index.ts</code>. 
              Devido a uma dependência circular entre o Agente e o módulo de Inventário, o bloco de registro de side-effects não está sendo executado completamente antes da primeira solicitação ao <code>BellaSkillRegistry</code>.
            </p>
            <div className="text-[10px] font-mono bg-background/50 p-2 rounded border">
              ARQUIVO EXATO: src/features/bella-ai/skills/index.ts<br/>
              CORREÇÃO MÍNIMA: Ajustar o import side-effect no entry point do Agente.
            </div>
          </div>

          <div className="p-4 bg-muted/30 border rounded-lg">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Próximo Passo Recomendado</h4>
            <p className="text-xs">
              Mover a lógica de registro estático para um método <code>bootstrap()</code> explícito ou garantir que o import de <code>@/features/bella-ai/skills</code> ocorra no topo do ciclo de vida da aplicação para garantir a população do Map de Skills.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
