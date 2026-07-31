import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "./dashboard-section";

export function NextAction() {
  return (
    <DashboardSection
      title="Próxima ação"
      description="O que faz mais sentido fazer agora"
    >
      <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Cadastre seus primeiros produtos</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Assim você já consegue registrar vendas e movimentações de estoque.
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 sm:shrink-0">
          Começar agora <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </DashboardSection>
  );
}
