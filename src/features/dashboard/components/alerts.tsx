import { CheckCircle2 } from "lucide-react";
import { DashboardSection } from "./dashboard-section";

export function Alerts() {
  return (
    <DashboardSection
      title="Alertas"
      description="Situações que precisam da sua atenção"
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium">Nenhum alerta no momento</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Vamos te avisar aqui quando algo precisar de decisão.
        </p>
      </div>
    </DashboardSection>
  );
}
