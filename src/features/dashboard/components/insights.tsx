import { TrendingUp } from "lucide-react";
import { DashboardSection } from "./dashboard-section";

export function Insights() {
  return (
    <DashboardSection
      title="Insights"
      description="Análises inteligentes do seu negócio"
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          <TrendingUp className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium">Ainda preparando seus insights</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Assim que você registrar algumas movimentações, mostraremos padrões e oportunidades aqui.
        </p>
      </div>
    </DashboardSection>
  );
}
